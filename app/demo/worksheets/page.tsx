"use client";

import Link from "next/link";
import { useState } from "react";
import {
  WorksheetActivity,
  type WorksheetAnswers,
  type WorksheetContent,
} from "@/components/activities/worksheet-activity";

const demoWorksheet: WorksheetContent = {
  type: "worksheet",
  questions: [
    {
      id: "loop-purpose",
      kind: "mcq",
      prompt: "What does a for loop do in Python?",
      options: [
        "Repeats a block of code a specific number of times",
        "Stops a program from running",
        "Stores multiple values in a single variable",
        "Checks whether a condition is true or false",
      ],
    },
    {
      id: "loop-benefit",
      kind: "short",
      prompt: "In one sentence, what is the main benefit of using a loop?",
    },
    {
      id: "loop-reflection",
      kind: "long",
      prompt: "How might loops help with a real-life task or a project you would like to build?",
    },
    {
      id: "loop-code",
      kind: "code",
      prompt: "Write a Python program that prints the numbers from 1 to 5, using a loop.",
    },
  ],
};

function EngravedSprig({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 140"
      fill="none"
      className={`pointer-events-none absolute -top-1 hidden h-32 w-36 opacity-90 xl:block ${
        mirrored ? "right-0" : "left-0"
      }`}
      style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
    >
      <g stroke="var(--primary)" strokeLinecap="round" strokeLinejoin="round">
        <path strokeWidth="1.6" d="M13 127C42 104 53 78 77 54c18-18 35-27 64-40" />
        <path strokeWidth="1.2" d="M37 103c-16-2-25-11-28-25 15-1 27 6 32 18M55 83c-2-16 5-27 19-34 5 14 1 27-11 37M75 62c8-13 20-17 35-13-5 13-16 20-31 21M97 43c2-14 12-23 27-25 0 14-7 25-21 30" />
        <path strokeWidth="0.6" d="m14 80 18 13m31-44 8 29m40-49-10 29M20 79l12 8m32-34 7 22m42-42-8 21M26 78l8 5m30-29 6 17m42-37-6 15" />
        <path strokeWidth="1" d="M48 91c-5-6-11-10-19-13m37-5c-4-8-4-16-2-24m34-4c-7-4-13-5-21-4m42-14c-8-2-15 0-21 4" />
        <path strokeWidth="0.8" d="M9 78c4 1 7 3 10 6m46-33c-1 4-1 7 0 11m42-21c-4 0-7 1-10 3m37-39c-2 3-3 6-3 9" />
      </g>
    </svg>
  );
}

export default function WorksheetsDemoPage() {
  const [answers, setAnswers] = useState<WorksheetAnswers>({});

  return (
    <main
      id="main"
      className="min-h-screen overflow-hidden bg-background px-3 py-6 text-foreground sm:px-6 sm:py-10"
      style={{
        backgroundImage:
          "repeating-linear-gradient(35deg, rgba(95,54,43,0.018) 0 1px, transparent 1px 10px), repeating-linear-gradient(-35deg, rgba(95,54,43,0.014) 0 1px, transparent 1px 10px), radial-gradient(ellipse at 12% 4%, rgba(193,125,82,0.14), transparent 34%), radial-gradient(ellipse at 92% 17%, rgba(150,84,57,0.1), transparent 28%), linear-gradient(180deg, var(--background), var(--secondary))",
      }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-5">
          <Link
            className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            href="/"
          >
            ← Back to Coding in Color
          </Link>
        </div>

        <header className="relative mb-7 px-2 pb-2 pt-2 text-center sm:mb-9 sm:pt-3">
          <EngravedSprig />
          <EngravedSprig mirrored />
          <p className="flex items-center justify-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-primary sm:text-xs">
            <span aria-hidden="true" className="h-px w-8 bg-muted-foreground sm:w-16" />
            The Study Nook
            <span aria-hidden="true" className="h-px w-8 bg-muted-foreground sm:w-16" />
          </p>
          <h1 className="mx-auto mt-3 max-w-4xl font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-primary sm:text-5xl lg:text-6xl">
            Python Practice Worksheet
          </h1>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span aria-hidden="true" className="hidden h-px w-12 bg-border-strong sm:block" />
            <p className="rounded-full bg-accent/80 px-4 py-1.5 font-serif text-lg italic text-primary sm:text-xl">
              Loops &amp; Iteration
            </p>
            <span aria-hidden="true" className="hidden h-px w-12 bg-border-strong sm:block" />
          </div>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            A quiet place to practice, reflect, and try an idea in your own words.
          </p>
        </header>

        <WorksheetActivity
          content={demoWorksheet}
          onChange={(nextAnswers) => setAnswers(nextAnswers)}
        />

        <details className="mx-auto mt-5 max-w-3xl rounded-2xl border border-border bg-card/90 p-4 text-foreground shadow-[0_3px_0_rgba(120,73,51,0.06)] sm:p-5">
          <summary className="min-h-8 cursor-pointer font-serif text-base font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            See the answer data received by the parent
          </summary>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Demo only: this live preview shows the onChange callback. Answers are not saved or submitted.
          </p>
          <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-surface p-3 font-mono text-xs leading-5">
            {JSON.stringify(answers, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}
