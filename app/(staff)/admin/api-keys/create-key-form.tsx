"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { createApiKey, type KeyActionState } from "./actions";

const INITIAL: KeyActionState = { ok: false, message: "" };

export function CreateKeyForm() {
  const [state, action, pending] = useActionState(createApiKey, INITIAL);
  const [copied, setCopied] = useState(false);

  async function copyKey() {
    if (!state.key) return;
    try {
      await navigator.clipboard.writeText(state.key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="create-key-heading">
      <div>
        <h2 id="create-key-heading" className="text-lg font-semibold">Create a read API key</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use a label to remember which integration uses this key.</p>
      </div>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1">
          <label htmlFor="key-label" className="text-sm font-medium">Key label</label>
          <input id="key-label" name="label" required maxLength={80} aria-describedby={state.message && !state.ok ? "create-key-error" : undefined} className="h-11 w-full rounded-xl border border-input bg-surface-raised px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring" placeholder="CIC organization dashboard" />
        </div>
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create key"}</Button>
      </form>
      {state.message && !state.key && <p id="create-key-error" role={state.ok ? "status" : "alert"} className="text-sm">{state.message}</p>}
      {state.key && <div role="status" className="space-y-3 rounded-xl border border-success/40 bg-success-surface p-4 text-success">
        <p className="font-medium">Your key is ready. Copy it now; you won’t see it again.</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-lg bg-surface-raised p-2 text-sm">{state.key}</code>
          <Button type="button" variant="outline" onClick={copyKey}>{copied ? "Copied" : "Copy key"}</Button>
        </div>
        {!copied && <p className="text-sm text-muted-foreground">Store it securely. The full key is not saved in the database.</p>}
      </div>}
    </section>
  );
}
