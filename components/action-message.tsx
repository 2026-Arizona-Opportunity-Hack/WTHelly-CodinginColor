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
          <p id={id} className="rounded-lg border border-border bg-muted px-4 py-3 text-sm font-medium">
            {result.message}
          </p>
        )}
      </div>
      <div role="alert">
        {result && !result.ok && (
          <p id={id} className="text-sm font-medium text-destructive">
            {result.message}
          </p>
        )}
      </div>
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";
