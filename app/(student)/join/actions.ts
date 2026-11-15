"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { classCodeSchema, type ClassLookup } from "@/lib/student/join-schema";

const NOT_FOUND = "Class not found. Check the code with your teacher and try again.";

/**
 * AUTH-2 step 1: look up a class by its join code and return its roster.
 * Uses the service role (students can't read the roster through RLS), and
 * returns only id, display name and whether a PIN is set — never pin_hash.
 */
export async function lookupClass(rawCode: string): Promise<ClassLookup> {
  const parsed = classCodeSchema.safeParse(rawCode);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }
  const code = parsed.data;

  const admin = createAdminClient();
  const { data: cls, error } = await admin
    .from("classes")
    .select("id, name")
    .eq("join_code", code)
    .maybeSingle();
  if (error) {
    console.error("lookupClass: class query failed", error.code);
    return { status: "error", message: "Something went wrong. Try again in a moment." };
  }
  if (!cls) return { status: "error", message: NOT_FOUND };

  const { data: rows, error: rosterError } = await admin
    .from("students")
    .select("id, display_name, pin_hash")
    .eq("class_id", cls.id)
    .order("display_name");
  if (rosterError) {
    console.error("lookupClass: roster query failed", rosterError.code);
    return { status: "error", message: "Something went wrong. Try again in a moment." };
  }

  return {
    status: "found",
    classCode: code,
    className: cls.name,
    students: (rows ?? []).map((s) => ({
      id: s.id,
      name: s.display_name,
      hasPin: s.pin_hash !== null,
    })),
  };
}
