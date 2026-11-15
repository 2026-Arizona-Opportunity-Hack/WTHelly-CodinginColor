"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage, inputClass } from "@/components/action-message";
import { NAME_MAX, SCHOOL_MAX, type ActionResult } from "@/lib/class-setup/roster";
import { addStudent, removeStudent, resetPin } from "./actions";

export type ManagedStudent = {
  id: string;
  display_name: string;
  school: string | null;
  joined: boolean;
  locked: boolean;
};

/** CLS-3: list, add, remove, reset PIN. */
export function StudentList({ classId, students }: { classId: string; students: ManagedStudent[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [errorStudentId, setErrorStudentId] = useState<string | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // After a remove, the row (and the focused button) is gone: move focus to the message.
  function done(res: ActionResult, moveFocus: boolean, studentId: string) {
    setResult(res);
    setErrorStudentId(res.ok ? null : studentId);
    if (moveFocus) messageRef.current?.focus();
  }

  return (
    <div className="space-y-4">
      <AddStudentForm classId={classId} />
      <ActionMessage result={result} id="student-action-error" ref={messageRef} />
      <div className="overflow-x-auto rounded-xl border">
        <table aria-label="Students in this class" className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {["Name", "School", "Status", "Actions"].map((h) => (
                <th key={h} scope="col" className="px-4 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {students.map((s) => (
              <StudentRow key={s.id} classId={classId} student={s} hasActionError={errorStudentId === s.id} onDone={done} />
            ))}
            {!students.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No students yet. Import a roster or add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddStudentForm({ classId }: { classId: string }) {
  const [state, formAction, pending] = useActionState(addStudent.bind(null, classId), null);
  const nameRef = useRef<HTMLInputElement>(null);
  const failed = state && !state.ok;

  // Keep focus in the name box so several students can be added in a row.
  useEffect(() => {
    if (state) nameRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <label htmlFor="add-name" className="text-sm font-medium">
            Student name
          </label>
          <input
            ref={nameRef}
            id="add-name"
            name="name"
            required
            maxLength={NAME_MAX}
            autoComplete="off"
            placeholder="Maya R"
            aria-invalid={failed || undefined}
            aria-describedby={failed ? "add-name-hint add-error" : "add-name-hint"}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="add-school" className="text-sm font-medium">
            School (optional)
          </label>
          <input id="add-school" name="school" maxLength={SCHOOL_MAX} autoComplete="off" className={inputClass} />
        </div>
        <Button type="submit" disabled={pending} className="h-10 px-4 text-base">
          {pending ? "Adding…" : "Add student"}
        </Button>
      </div>
      <p id="add-name-hint" className="text-sm text-muted-foreground">
        First name + last initial only, e.g. Maya R. No emails or full names.
      </p>
      <ActionMessage result={state} id="add-error" />
    </form>
  );
}

function StudentRow({
  classId,
  student,
  hasActionError,
  onDone,
}: {
  classId: string;
  student: ManagedStudent;
  hasActionError: boolean;
  onDone: (res: ActionResult, moveFocus: boolean, studentId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const name = student.display_name;

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  function cancel() {
    setConfirming(false);
    requestAnimationFrame(() => removeRef.current?.focus());
  }

  function run(action: typeof removeStudent, moveFocus: boolean) {
    startTransition(async () => {
      const res = await action(classId, student.id);
      setConfirming(false);
      onDone(res, moveFocus && res.ok, student.id);
    });
  }

  return (
    <tr>
      <th scope="row" className="px-4 py-2 font-medium">
        {name}
      </th>
      <td className="px-4 py-2">{student.school || "—"}</td>
      <td className="px-4 py-2">
        {student.locked ? "Locked (too many wrong PINs)" : student.joined ? "Joined" : "Not joined yet"}
      </td>
      <td className="px-4 py-2">
        {confirming ? (
          <div role="group" aria-label={`Confirm removing ${name}`} className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-destructive">
              Remove {name}? This deletes all their progress and test scores.
            </span>
            <Button
              ref={confirmRef}
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => run(removeStudent, true)}
            >
              {pending ? "Removing…" : "Yes, remove"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={cancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              aria-label={`Reset PIN for ${name}`}
              aria-describedby={hasActionError ? "student-action-error" : undefined}
              onClick={() => run(resetPin, false)}
            >
              Reset PIN
            </Button>
            <Button
              ref={removeRef}
              type="button"
              variant="destructive"
              disabled={pending}
              aria-label={`Remove ${name}`}
              aria-describedby={hasActionError ? "student-action-error" : undefined}
              onClick={() => setConfirming(true)}
            >
              Remove
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
