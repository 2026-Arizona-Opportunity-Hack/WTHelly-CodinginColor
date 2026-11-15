import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type StudentSession = {
  studentId: string;
  displayName: string;
  className: string;
};

/**
 * The student linked to this browser's anonymous user, once per request, or
 * null. Reads through RLS as the student (no service role): current_student_id()
 * resolves the student from student_devices, and the students/classes policies
 * let a student read only their own row and class.
 */
export const getStudentSession = cache(async (): Promise<StudentSession | null> => {
  // Request-time only (Supabase auth reads Date.now()). Callers sit inside <Suspense>.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: studentId } = await supabase.rpc("current_student_id");
  if (typeof studentId !== "string") return null;

  const { data } = await supabase
    .from("students")
    .select("display_name, classes(name)")
    .eq("id", studentId)
    .maybeSingle();
  if (!data) return null;

  const cls = data.classes as { name: string } | { name: string }[] | null;
  const className = (Array.isArray(cls) ? cls[0]?.name : cls?.name) ?? "";
  return { studentId, displayName: data.display_name, className };
});

/** Server-side guard for /learn pages. proxy.ts checks first; this is the second check. */
export async function requireStudent() {
  const session = await getStudentSession();
  if (!session) redirect("/join");
  return session;
}
