"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  pinSchema,
  type ClassLookup,
  type JoinRequest,
  type JoinResponse,
  type RosterStudent,
} from "@/lib/student/join-schema";
import { lookupClass } from "./actions";

type FoundClass = Extract<ClassLookup, { status: "found" }>;
type Step =
  | { step: "code" }
  | { step: "name"; cls: FoundClass }
  | { step: "pin"; cls: FoundClass; student: RosterStudent };

const inputClass =
  "h-12 w-full rounded-lg border border-input bg-background px-3 text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";
const headingClass = "text-2xl font-semibold tracking-tight outline-none";

/** AUTH-2 / AUTH-3: class code → pick your name → set or enter your PIN. */
/**
 * `initialCode` comes from the join link (/join?code=ABC123, CLS-5) and is
 * "" otherwise. The page keys this form by it, so a different code is a fresh form.
 */
export function JoinForm({ initialCode }: { initialCode: string }) {
  const [state, setState] = useState<Step>({ step: "code" });
  const [classCode, setClassCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new step's heading so keyboard and screen-reader users
  // start at the top of each step.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [state.step]);

  // When this form is hidden (cacheComponents keeps it alive in <Activity>
  // after navigating away) or unmounted, forget the class, name and step, so
  // the next person on a shared device starts over. Reset to the URL's code,
  // not to blank: this cleanup also runs on Strict Mode's dev remount and on
  // every Activity hide, and a blank here wiped the join-link pre-fill.
  // /join with no ?code= has initialCode "", so it still resets fully blank.
  useEffect(
    () => () => {
      setState({ step: "code" });
      setClassCode(initialCode);
      setError("");
    },
    [initialCode],
  );

  function go(next: Step) {
    setError("");
    setState(next);
  }

  if (state.step === "code") {
    const onSubmit = (e: FormEvent) => {
      e.preventDefault();
      setError("");
      startTransition(async () => {
        const result = await lookupClass(classCode);
        if (result.status === "found") go({ step: "name", cls: result });
        else setError(result.message);
      });
    };
    return (
      <section aria-labelledby="join-heading" className="flex flex-col gap-6">
        <div>
          <h1 id="join-heading" ref={headingRef} tabIndex={-1} className={headingClass}>
            Join your class
          </h1>
          <p className="mt-2 text-muted-foreground">Your teacher will give you a class code.</p>
        </div>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="class-code" className="text-sm font-medium">
              Class code
            </label>
            <input
              id="class-code"
              name="classCode"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={8}
              placeholder="ABC123"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "code-error" : undefined}
              className={`${inputClass} font-mono tracking-widest uppercase`}
            />
            {error && (
              <p id="code-error" role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={pending} className="h-12 text-base">
            {pending ? "Finding your class…" : "Next"}
          </Button>
        </form>
      </section>
    );
  }

  if (state.step === "name") {
    const { cls } = state;
    return (
      <section aria-labelledby="join-heading" className="flex flex-col gap-6">
        <div>
          <h1 id="join-heading" ref={headingRef} tabIndex={-1} className={headingClass}>
            Pick your name
          </h1>
          <p className="mt-2 text-muted-foreground">{cls.className}</p>
        </div>
        {cls.students.length === 0 ? (
          <p role="alert" className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
            This class has no students yet. Ask your teacher to add you.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {cls.students.map((s) => (
              <li key={s.id}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full justify-start px-4 text-base"
                  onClick={() => go({ step: "pin", cls, student: s })}
                >
                  {s.name}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="ghost"
          className="h-11 self-start"
          onClick={() => go({ step: "code" })}
        >
          ← Use a different class code
        </Button>
      </section>
    );
  }

  return (
    <PinStep
      key={state.student.id}
      cls={state.cls}
      student={state.student}
      headingRef={headingRef}
      onBack={() => go({ step: "name", cls: state.cls })}
    />
  );
}

function PinStep({
  cls,
  student,
  headingRef,
  onBack,
}: {
  cls: FoundClass;
  student: RosterStudent;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
}) {
  const router = useRouter();
  const isNew = !student.hasPin;
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const pinRef = useRef<HTMLInputElement>(null);

  const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  function clearPins() {
    setPin("");
    setConfirm("");
  }

  // Never keep a typed PIN around once this step is hidden or gone.
  useEffect(() => clearPins, []);

  function fail(message: string) {
    setError(message);
    clearPins();
    pinRef.current?.focus();
  }

  function back() {
    clearPins();
    setError("");
    onBack();
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!pinSchema.safeParse(pin).success) return fail("Your PIN is 4 numbers.");
    if (isNew && pin !== confirm) return fail("The two PINs don't match. Type them again.");

    startTransition(async () => {
      const supabase = createClient();
      // Reuse this browser's anonymous user if it has one; otherwise make one.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !user.is_anonymous) {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) {
          return fail(
            authError.status === 429
              ? "Too many students are joining right now. Wait a minute, then try again."
              : "We couldn't start your session. Reload the page and try again.",
          );
        }
      }

      const body: JoinRequest = { classCode: cls.classCode, studentId: student.id, pin };
      let result: JoinResponse;
      try {
        const res = await fetch("/api/student/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        result = await res.json();
      } catch {
        return fail("We couldn't reach the server. Check your internet and try again.");
      }

      if (!result.ok) return fail(result.error);
      clearPins();
      router.replace("/learn");
    });
  };

  const describedBy = (hintId: string) => (error ? `${hintId} pin-error` : hintId);

  return (
    <section aria-labelledby="join-heading" className="flex flex-col gap-6">
      <div>
        <h1 id="join-heading" ref={headingRef} tabIndex={-1} className={headingClass}>
          Hi, {student.name}
        </h1>
        <p className="mt-2 text-muted-foreground">{cls.className}</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="pin" className="text-sm font-medium">
            {isNew ? "Choose a 4-digit PIN" : "Your 4-digit PIN"}
          </label>
          <p id="pin-hint" className="text-sm text-muted-foreground">
            {isNew
              ? "You'll use this PIN every time you join. Keep it secret."
              : "The PIN you chose the first time you joined."}
          </p>
          <input
            ref={pinRef}
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="one-time-code"
            autoFocus
            value={pin}
            onChange={(e) => setPin(digitsOnly(e.target.value))}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy("pin-hint")}
            className={`${inputClass} max-w-40 font-mono tracking-[0.5em]`}
          />
        </div>
        {isNew && (
          <div className="flex flex-col gap-2">
            <label htmlFor="pin-confirm" className="text-sm font-medium">
              Type your PIN again
            </label>
            <input
              id="pin-confirm"
              name="pinConfirm"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="one-time-code"
              value={confirm}
              onChange={(e) => setConfirm(digitsOnly(e.target.value))}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "pin-error" : undefined}
              className={`${inputClass} max-w-40 font-mono tracking-[0.5em]`}
            />
          </div>
        )}
        {error && (
          <p id="pin-error" role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-12 text-base">
          {pending ? "Joining…" : isNew ? "Set PIN and join" : "Join"}
        </Button>
      </form>
      <Button type="button" variant="ghost" className="h-11 self-start" onClick={back}>
        ← That&apos;s not me
      </Button>
    </section>
  );
}
