import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, type StaffRole } from "@/lib/auth/roles";

export type StaffProfile = { full_name: string; role: StaffRole };

/**
 * The signed-in user and their staff profile, once per request.
 * `profile` is null for anyone without a profiles row (students, or an
 * email that signed in but was never invited). Profiles are never created here.
 */
export const getStaffSession = cache(async () => {
  // Request-time only: Supabase auth reads Date.now(), which can't run while
  // Next prerenders. Callers must sit inside <Suspense>.
  await connection();
  const supabase = await createClient();
  // getUser() asks Supabase Auth to validate the token, so it can't be forged
  // with a hand-edited cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile: StaffProfile | null =
    data && isStaffRole(data.role) ? { full_name: data.full_name, role: data.role } : null;
  return { user, profile };
});

/**
 * Server-side guard for staff pages (AUTH-5). Not signed in → /login.
 * Signed in without an allowed role → /no-access. proxy.ts already answers
 * those requests with a 403; this is the second check, on the server.
 */
export async function requireRole(allowed: readonly StaffRole[]) {
  const { user, profile } = await getStaffSession();
  if (!user) redirect("/login");
  if (!profile || !allowed.includes(profile.role)) redirect("/no-access");
  return { user, profile };
}
