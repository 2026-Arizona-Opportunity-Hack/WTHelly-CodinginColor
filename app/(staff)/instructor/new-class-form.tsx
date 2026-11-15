"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/action-message";
import type { InstructorOption } from "@/lib/class-setup/access";
import { createClass, type NewClassState } from "./actions";

export type CohortOption = { id: string; label: string };

const initial: NewClassState = { ok: true, message: "" };

/** `instructors` is passed only for admins; instructors always own the classes they create. */
export function NewClassForm({
  cohorts,
  instructors,
  selfId,
}: {
  cohorts: CohortOption[];
  instructors?: InstructorOption[];
  selfId: string;
}) {
  const [state, formAction, pending] = useActionState(createClass, initial);
  const nameError = !state.ok && state.field === "name";
  const cohortError = !state.ok && state.field === "cohortId";
  const instructorError = !state.ok && state.field === "instructorId";

  if (!cohorts.length) {
    return (
      <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
        There are no cohorts yet. Ask an admin to create one, then you can add a class.
      </p>
    );
  }

  return (
    <form
      key={JSON.stringify(state.values ?? null)}
      action={formAction}
      noValidate
      className={`grid gap-4 sm:items-end ${instructors ? "sm:grid-cols-[1fr_1fr_1fr_auto]" : "sm:grid-cols-[1fr_1fr_auto]"}`}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="class-name" className="text-sm font-medium">
          Class name
        </label>
        <input
          id="class-name"
          name="name"
          required
          maxLength={80}
          autoComplete="off"
          placeholder="AI Academy – Period 2"
          defaultValue={state.values?.name}
          aria-invalid={nameError || undefined}
          aria-describedby={nameError ? "new-class-error" : undefined}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="class-cohort" className="text-sm font-medium">
          Cohort (program, school, term)
        </label>
        <select
          id="class-cohort"
          name="cohortId"
          required
          defaultValue={state.values?.cohortId ?? (cohorts.length === 1 ? cohorts[0].id : "")}
          aria-invalid={cohortError || undefined}
          aria-describedby={cohortError ? "new-class-error" : undefined}
          className={inputClass}
        >
          <option value="">Pick a cohort…</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {instructors && (
        <div className="flex flex-col gap-2">
          <label htmlFor="class-instructor" className="text-sm font-medium">
            Instructor
          </label>
          <select
            id="class-instructor"
            name="instructorId"
            defaultValue={state.values?.instructorId || selfId}
            aria-invalid={instructorError || undefined}
            aria-describedby={instructorError ? "new-class-error" : undefined}
            className={inputClass}
          >
            {instructors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
      )}
      <Button type="submit" disabled={pending} className="h-10 px-4 text-base">
        {pending ? "Creating…" : "Create class"}
      </Button>
      <div role="alert" className={instructors ? "sm:col-span-4" : "sm:col-span-3"}>
        {!state.ok && (
          <p id="new-class-error" className="text-sm font-medium text-destructive">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
