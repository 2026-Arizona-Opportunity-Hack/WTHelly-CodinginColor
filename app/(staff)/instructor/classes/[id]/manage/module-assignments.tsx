"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/action-message";
import type { ActionResult } from "@/lib/class-setup/roster";
import { assignModule, moveModule, unassignModule } from "./actions";

export type ModuleOption = { id: string; title: string };

/** CLS-4: assign published modules, unassign, and reorder with buttons. */
export function ModuleAssignments({
  classId,
  assigned,
  available,
}: {
  classId: string;
  assigned: ModuleOption[];
  available: ModuleOption[];
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const messageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // After a move, keep focus on the moved module's button (or its other move
  // button when it reaches the top or bottom and this one is disabled).
  const focusAfter = useRef<{ id: string; dir: "up" | "down" } | null>(null);

  useEffect(() => {
    const target = focusAfter.current;
    if (!target || pending) return;
    focusAfter.current = null;
    const q = (dir: string) =>
      listRef.current?.querySelector<HTMLButtonElement>(`[data-move="${target.id}-${dir}"]:not(:disabled)`);
    (q(target.dir) ?? q(target.dir === "up" ? "down" : "up"))?.focus();
  }, [assigned, pending]);

  function run(action: () => Promise<ActionResult>, after?: () => void) {
    startTransition(async () => {
      const res = await action();
      setResult(res);
      after?.();
    });
  }

  return (
    <div className="space-y-4">
      <ActionMessage result={result} ref={messageRef} />
      <div ref={listRef}>
        <h3 className="mb-2 font-medium">Assigned, in the order students see them</h3>
        {assigned.length ? (
          <ol className="divide-y rounded-xl border">
            {assigned.map((m, i) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                  {m.title}
                </span>
                <span className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    data-move={`${m.id}-up`}
                    disabled={pending || i === 0}
                    aria-label={`Move ${m.title} up`}
                    onClick={() => {
                      focusAfter.current = { id: m.id, dir: "up" };
                      run(() => moveModule(classId, m.id, "up"));
                    }}
                  >
                    Move up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    data-move={`${m.id}-down`}
                    disabled={pending || i === assigned.length - 1}
                    aria-label={`Move ${m.title} down`}
                    onClick={() => {
                      focusAfter.current = { id: m.id, dir: "down" };
                      run(() => moveModule(classId, m.id, "down"));
                    }}
                  >
                    Move down
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pending}
                    aria-label={`Unassign ${m.title}`}
                    onClick={() => run(() => unassignModule(classId, m.id), () => messageRef.current?.focus())}
                  >
                    Unassign
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
            No modules assigned yet. Students won&apos;t see any lessons until you assign one.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-medium">Published modules you can assign</h3>
        {available.length ? (
          <ul className="divide-y rounded-xl border">
            {available.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>{m.title}</span>
                <Button
                  type="button"
                  disabled={pending}
                  aria-label={`Assign ${m.title}`}
                  onClick={() => run(() => assignModule(classId, m.id), () => messageRef.current?.focus())}
                >
                  Assign
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Every published module is already assigned.</p>
        )}
      </div>
    </div>
  );
}
