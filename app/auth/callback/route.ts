import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, ROLE_HOME } from "@/lib/auth/roles";

// Magic-link landing (AUTH-1). Exchanges the one-time code for a session,
// then sends the user to their role's home. Never creates a profile: a user
// without one goes to /no-access.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  // Supabase sends errors back as query params (e.g. an expired link).
  const errorCode = searchParams.get("error_code");
  if (errorCode) {
    return to(`/login?error=${errorCode === "otp_expired" ? "expired" : "link"}`);
  }

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let failed = true;
  if (code) {
    // Default PKCE flow: works in the browser that requested the link.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && type) {
    // Works if the email template is changed to send token_hash links.
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    failed = Boolean(error);
  }
  if (failed) return to("/login?error=link");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return to("/login?error=link");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return to(profile && isStaffRole(profile.role) ? ROLE_HOME[profile.role] : "/no-access");
}
