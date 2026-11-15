"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage, inputClass } from "@/components/action-message";
import type { InstructorOption } from "@/lib/class-setup/access";
import type { ActionResult } from "@/lib/class-setup/roster";
import { changeInstructor } from "./actions";

/** Admins only: reassign the class to another instructor or admin. */
export function InstructorPicker({
  classId,
  currentId,
  instructors,
}: {
  classId: string;
  currentId: string;
  instructors: InstructorOption[];
}) {
  const [selected, setSelected] = useState(currentId);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => setResult(await changeInstructor(classId, selected)));
        }}
      >
        <label htmlFor="class-instructor" className="text-sm font-medium">
          Instructor
        </label>
        <div className="flex flex-wrap gap-2">
          <select
            id="class-instructor"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-describedby={result && !result.ok ? "instructor-action-error" : undefined}
            className={`${inputClass} max-w-sm flex-1`}
          >
            {instructors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={pending} className="h-10 px-4 text-base">
            {pending ? "Changing…" : "Change instructor"}
          </Button>
        </div>
      </form>
      <ActionMessage result={result} id="instructor-action-error" />
    </div>
  );
}
