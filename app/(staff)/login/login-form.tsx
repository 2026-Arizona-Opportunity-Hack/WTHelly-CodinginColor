"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { sendMagicLink, type MagicLinkState } from "@/lib/auth/actions";

const initialState: MagicLinkState = { status: "idle", message: "", email: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);
  const hasError = state.status === "error";

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
          key={state.email}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? "email-error" : undefined}
          className="h-11 w-full rounded-xl border border-input bg-surface-raised px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
        />
        {hasError && (
          <p id="email-error" role="alert" className="text-sm font-medium text-destructive">
            {state.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="h-11 text-base">
        {pending ? "Sending…" : state.status === "sent" ? "Send another link" : "Send magic link"}
      </Button>

      {/* Always in the DOM so screen readers announce the success message. */}
      <div role="status" aria-live="polite">
        {state.status === "sent" && (
          <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
