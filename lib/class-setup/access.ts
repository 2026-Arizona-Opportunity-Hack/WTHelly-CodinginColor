import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const idSchema = z.guid();

/**
 * Role check for class-setup server actions: the caller must be a signed-in
 * instructor or admin. Returns the user's own Supabase client, so every write
 * still goes through RLS. Null when not allowed.
 */
export async function getStaffWriter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "instructor" && profile?.role !== "admin") return null;
  return { supabase, user, role: profile.role as "instructor" | "admin" };
}

/**
 * The class, if the caller may manage it: instructors only their own,
 * admins any. RLS enforces the same rule; this check lets us return a clear
 * error instead of a silent no-op.
 */
export async function getManagedClass(classId: string) {
  if (!idSchema.safeParse(classId).success) return null;
  const staff = await getStaffWriter();
  if (!staff) return null;
  const { data: cls } = await staff.supabase
    .from("classes")
    .select("id, name, join_code, instructor_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return null;
  if (staff.role !== "admin" && cls.instructor_id !== staff.user.id) return null;
  return { ...staff, cls };
}

export type ManagedClass = NonNullable<Awaited<ReturnType<typeof getManagedClass>>>;
