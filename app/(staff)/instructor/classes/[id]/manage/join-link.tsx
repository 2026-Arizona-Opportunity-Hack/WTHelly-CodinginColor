"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage, inputClass } from "@/components/action-message";
import type { ActionResult } from "@/lib/class-setup/roster";

const subscribe = () => () => {};

/** CLS-5: show the class code and copy a link that pre-fills it on /join. */
export function JoinLink({ code }: { code: string }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const link = `${origin}/join?code=${encodeURIComponent(code)}`;
  const [result, setResult] = useState<ActionResult | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setResult({ ok: true, message: "Join link copied. Paste it in your class chat or slides." });
    } catch {
      setResult({ ok: false, message: "Couldn't copy automatically. Select the link above and copy it." });
    }
  }

  return (
    <div className="space-y-4">
      <p>
        <span className="block text-sm text-muted-foreground">Class code</span>
        <strong className="font-mono text-5xl tracking-[0.3em]">{code}</strong>
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor="join-link" className="text-sm font-medium">
          Join link
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="join-link"
            readOnly
            value={link}
            aria-describedby={result ? "join-link-message" : undefined}
            onFocus={(e) => e.currentTarget.select()}
            className={`${inputClass} max-w-xl flex-1 font-mono text-sm`}
          />
          <Button type="button" onClick={copy} aria-describedby={result ? "join-link-message" : undefined} className="h-10 px-4 text-base">
            Copy join link
          </Button>
        </div>
      </div>
      <ActionMessage result={result} id="join-link-message" />
    </div>
  );
}
