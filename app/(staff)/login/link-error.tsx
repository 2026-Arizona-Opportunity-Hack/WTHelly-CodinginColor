"use client";

import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  expired: "That sign-in link has expired or was already used. Send yourself a new one below.",
  link: "We couldn't sign you in with that link. Links only work in the browser you requested them from, so send a new one here.",
};

// Shows why /auth/callback sent the user back here (?error=...).
export function LinkError() {
  const error = useSearchParams().get("error");
  const message = error ? (MESSAGES[error] ?? MESSAGES.link) : null;
  if (!message) return null;

  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {message}
    </p>
  );
}
