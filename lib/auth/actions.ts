"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

/** Sign out of the current session (staff or student) and go to /login. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
