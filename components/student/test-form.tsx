"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import type { PublicQuestion } from "@/lib/student/assessment";

type Result = { score: number; correct: number; total: number; nextHref: string };

/** Pretest / post-test form (ASM-3): one radio group per question, scored on the server. */
export function TestForm({
  moduleId,
  kind,
  questions,
}: {
  moduleId: string;
  kind: "pre" | "post";
  questions: PublicQuestion[];
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const missing = questions.findIndex((q) => answers[q.id] === undefined);
    if (missing !== -1) {
      setError(`Answer question ${missing + 1} before you submit.`);
      document.getElementById(`q-${questions[missing].id}-0`)?.focus();
      return;
    }
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, kind, answers }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Something went wrong. Try again in a moment.");
        return;
      }
      setResult(body as Result);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch {
      setError("Couldn't reach the server. Check your internet and try again.");
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <section aria-labelledby="test-result" className="mt-8 rounded-xl border border-border p-6">
        <h2 id="test-result" ref={resultRef} tabIndex={-1} className="text-xl font-semibold outline-none">
          Test submitted
        </h2>
        <p className="mt-2 text-lg">
          You got {result.correct} of {result.total} right ({result.score}%).
        </p>
        <Link href={result.nextHref} className={buttonVariants({ className: "mt-6 h-12 w-full px-6 text-base sm:w-auto" })}>
          Continue
        </Link>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-describedby={error ? "test-form-error" : undefined} className="mt-8 flex flex-col gap-8">
      <ol className="flex flex-col gap-8">
        {questions.map((q, qi) => (
          <li key={q.id}>
            <fieldset className="flex min-w-0 flex-col gap-3">
              <legend className="mb-3 font-medium">
                <span className="text-muted-foreground">Question {qi + 1} of {questions.length}</span>
                <span className="mt-1 block whitespace-pre-wrap break-words text-base">{q.prompt}</span>
              </legend>
              {q.options.map((opt, oi) => {
                const id = `q-${q.id}-${oi}`;
                return (
                  <label
                    key={id}
                    htmlFor={id}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-2 has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring"
                  >
                    <input
                      id={id}
                      type="radio"
                      name={q.id}
                      value={oi}
                      checked={answers[q.id] === oi}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="break-words">{opt}</span>
                  </label>
                );
              })}
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-3">
        <p id="test-form-error" role="alert" className="text-sm font-medium text-destructive empty:hidden">
          {error}
        </p>
        <Button type="submit" disabled={pending} className="h-12 w-full text-base sm:w-auto sm:self-start sm:px-8">
          {pending ? "Submitting…" : "Submit test"}
        </Button>
      </div>
    </form>
  );
}
