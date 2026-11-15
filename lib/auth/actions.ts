"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type MagicLinkState = {
  status: "idle" | "sent" | "error";
  message: string;
  email: string;
};

const emailSchema = z.email();

/** AUTH-1: email a magic link to an existing staff account. */
export async function sendMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { status: "error", email, message: "Enter your email address." };
  }
  if (!emailSchema.safeParse(email).success) {
    return {
      status: "error",
      email,
      message: "That doesn't look like an email address. Check it and try again.",
    };
  }

  const h = await headers();
  const origin =
    h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Only staff who already exist in Supabase Auth can sign in. New staff
      // are added by an admin invite, never by signing up here.
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    const specific = describeOtpError(error.code, error.status);
    if (specific) return { status: "error", email, message: specific };
    // Anything else (including "no such user") gets the same reply as success,
    // so the form can't be used to find out which emails are staff.
    if (!["otp_disabled", "signup_disabled", "user_not_found"].includes(error.code ?? "")) {
      console.error("signInWithOtp failed:", error.code, error.status);
    }
  }

  return { status: "sent", email, message: SENT_MESSAGE };
}

const SENT_MESSAGE =
  "If this email belongs to a CIC staff account, we’ve sent a sign-in link. Not getting it? Ask your CIC admin.";

/** Specific messages only for problems that don't reveal whether the account exists. */
function describeOtpError(code: string | undefined, status: number | undefined) {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many sign-in emails were sent. Wait a minute, then try again.";
    case "email_address_invalid":
      return "That doesn't look like an email address. Check it and try again.";
  }
  if (status === 429) return "Too many attempts. Wait a minute, then try again.";
  return null;
}

/**
 * "Not you? Switch student" on shared Chromebooks: sign this browser out.
 * No redirect here: the caller (SwitchStudentButton) does a full page load to
 * /join, so no React state from the previous student survives. The anonymous
 * user is deleted (which also removes its student_devices row), so nothing is
 * left linked to the student. Progress is stored on the student, not the
 * device, so nothing is lost.
 */
export async function switchStudent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user?.is_anonymous) {
    const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
    if (error) console.error("switchStudent: delete anonymous user failed", error.code);
  }
}

/**
 * Sign out of the current session. No redirect here: the caller
 * (SignOutButton) does a full page load to /login, so the previous user's
 * form state isn't kept by client-side navigation.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
