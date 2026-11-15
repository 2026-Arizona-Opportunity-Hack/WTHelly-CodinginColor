import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { joinRequestSchema, type JoinResponse } from "@/lib/student/join-schema";

const BCRYPT_ROUNDS = 10;

// One message for "wrong PIN" and "that student isn't in this class",
// so the endpoint can't be used to probe the roster.
const NO_MATCH = "That name and PIN don't match. Try again, or ask your teacher for help.";

// Compared against when the student doesn't exist, so a miss takes as long as
// a wrong PIN and timing doesn't give it away either.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hash("not-a-real-pin", BCRYPT_ROUNDS));

function reply(body: JoinResponse, status = 200) {
  return NextResponse.json(body, { status });
}

function lockedReply(until: string) {
  const minutes = Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 60_000));
  return reply(
    {
      ok: false,
      locked: true,
      error: `Too many wrong tries, so this PIN is locked for ${minutes} more minute${minutes === 1 ? "" : "s"}. Take a break, or ask your teacher for help.`,
    },
    423,
  );
}

/**
 * AUTH-2 / AUTH-3: link this browser's anonymous Supabase user to a student.
 * Body: { classCode, studentId, pin }. First join sets the PIN; later joins
 * check it. 5 wrong PINs lock the student for 10 minutes (0004_pin_lockout.sql).
 */
export async function POST(request: Request) {
  const parsed = joinRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return reply({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
  }
  const { classCode, studentId, pin } = parsed.data;

  // The browser called signInAnonymously() first; getUser() verifies that token.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.is_anonymous) {
    return reply({ ok: false, error: "Your session expired. Reload the page and try again." }, 401);
  }

  const admin = createAdminClient();
  const { data: student, error } = await admin
    .from("students")
    .select("id, pin_hash, pin_locked_until, classes!inner(join_code)")
    .eq("id", studentId)
    .eq("classes.join_code", classCode)
    .maybeSingle();
  if (error) {
    console.error("student join: lookup failed", error.code);
    return reply({ ok: false, error: "Something went wrong. Try again in a moment." }, 500);
  }

  if (!student) {
    await compare(pin, await getDummyHash());
    return reply({ ok: false, error: NO_MATCH }, 401);
  }

  if (student.pin_locked_until && new Date(student.pin_locked_until) > new Date()) {
    return lockedReply(student.pin_locked_until);
  }

  if (student.pin_hash === null) {
    // First join: set the PIN. The `is null` filter makes this a no-op if
    // another device set a PIN a moment ago; then we fall through to checking it.
    const { data: claimed, error: setError } = await admin
      .from("students")
      .update({ pin_hash: await hash(pin, BCRYPT_ROUNDS), joined_at: new Date().toISOString() })
      .eq("id", student.id)
      .is("pin_hash", null)
      .select("id");
    if (setError) {
      console.error("student join: set PIN failed", setError.code);
      return reply({ ok: false, error: "Something went wrong. Try again in a moment." }, 500);
    }
    if (!claimed?.length) {
      const { data: fresh } = await admin
        .from("students")
        .select("pin_hash")
        .eq("id", student.id)
        .single();
      student.pin_hash = fresh?.pin_hash ?? null;
      if (!student.pin_hash || !(await compare(pin, student.pin_hash))) {
        return wrongPin(admin, student.id);
      }
    }
  } else if (!(await compare(pin, student.pin_hash))) {
    return wrongPin(admin, student.id);
  }

  // PIN verified (or just set): start the wrong-PIN count over, so old typos
  // don't carry into a later session.
  const { error: resetError } = await admin
    .from("students")
    .update({ failed_pin_attempts: 0, pin_locked_until: null })
    .eq("id", student.id);
  if (resetError) {
    console.error("student join: reset PIN attempts failed", resetError.code);
    return reply({ ok: false, error: "Something went wrong. Try again in a moment." }, 500);
  }

  // Link this anonymous user to the student. RLS resolves the student from
  // here on through current_student_id().
  const { error: linkError } = await admin
    .from("student_devices")
    .upsert({ auth_user_id: user.id, student_id: student.id, linked_at: new Date().toISOString() });
  if (linkError) {
    console.error("student join: device link failed", linkError.code);
    return reply({ ok: false, error: "Something went wrong. Try again in a moment." }, 500);
  }

  return reply({ ok: true });
}

async function wrongPin(admin: ReturnType<typeof createAdminClient>, studentId: string) {
  const { data: lockedUntil, error } = await admin.rpc("record_failed_pin", {
    p_student: studentId,
  });
  if (error) console.error("student join: record_failed_pin failed", error.code);
  if (typeof lockedUntil === "string" && new Date(lockedUntil) > new Date()) {
    return lockedReply(lockedUntil);
  }
  return reply({ ok: false, error: NO_MATCH }, 401);
}
