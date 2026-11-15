import type { Ref } from "react";
import type { ActionResult } from "@/lib/class-setup/roster";

/**
 * Announces the result of an action: success via role="status", errors via
 * role="alert". The wrapper is always rendered so screen readers pick up
 * changes. Give it a ref to move focus here after a row disappears.
 */
export function ActionMessage({
  result,
  id,
  ref,
}: {
  result: ActionResult | null;
  id?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      <div role="status" aria-live="polite">
        {result?.ok && (
          <p id={id} className="rounded-xl border border-border bg-success-surface px-4 py-3 text-sm font-medium text-success">
            {result.message}
          </p>
        )}
      </div>
      <div role="alert">
        {result && !result.ok && (
          <p id={id} className="rounded-xl border border-destructive/40 bg-error-surface px-4 py-3 text-sm font-medium text-destructive">
            {result.message}
          </p>
        )}
      </div>
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded-xl border border-input bg-surface-raised px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";
