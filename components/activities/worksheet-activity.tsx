"use client";

import { useId, useRef, useState } from "react";
import { PythonRunner } from "./python-runner";

export type WorksheetQuestion =
  | {
      id: string;
      kind: "mcq";
      prompt: string;
      options: string[];
    }
  | {
      id: string;
      kind: "short" | "long" | "code";
      prompt: string;
      options?: string[];
    };

export type WorksheetContent = {
  type: "worksheet";
  questions: WorksheetQuestion[];
};

export type WorksheetAnswer = string | number;
export type WorksheetAnswers = Record<string, WorksheetAnswer>;

type WorksheetActivityProps = {
  content: WorksheetContent;
  initialAnswers?: WorksheetAnswers;
  onChange?: (answers: WorksheetAnswers) => void;
};

function getQuestionTitle(kind: WorksheetQuestion["kind"]) {
  switch (kind) {
    case "mcq":
      return "Multiple choice";
    case "short":
      return "Short answer";
    case "long":
      return "Longer reflection";
    case "code":
      return "Write code";
  }
}

function isAnswered(question: WorksheetQuestion, answer: WorksheetAnswer | undefined) {
  if (question.kind === "mcq") return typeof answer === "number";
  return typeof answer === "string" && answer.trim().length > 0;
}

export function WorksheetActivity({ content, initialAnswers, onChange }: WorksheetActivityProps) {
  const instanceId = useId();
  const [answers, setAnswers] = useState<WorksheetAnswers>(() => initialAnswers ?? {});
  const answersRef = useRef<WorksheetAnswers>(initialAnswers ?? {});
  const answeredCount = content.questions.filter((question) =>
    isAnswered(question, answers[question.id]),
  ).length;

  function updateAnswer(questionId: string, value: WorksheetAnswer) {
    const nextAnswers = { ...answersRef.current, [questionId]: value };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    onChange?.(nextAnswers);
  }

  return (
    <section
      aria-labelledby={`${instanceId}-title`}
      className="w-full rounded-[1.75rem] border border-border-strong bg-card p-4 shadow-[0_14px_40px_rgba(77,37,26,0.10),inset_0_0_0_3px_rgba(255,255,255,0.65)] sm:p-6 lg:p-8"
    >
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Your practice sheet
          </p>
          <h2
            id={`${instanceId}-title`}
            className="font-serif text-2xl font-semibold leading-tight text-primary sm:text-3xl"
          >
            Work through each question
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Take your time. Your answers stay on this page while you work.
          </p>
        </div>
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-success-surface px-4 py-2 text-sm font-medium text-success"
        >
          <span aria-hidden="true" className="size-2 rounded-full bg-success" />
          {answeredCount} of {content.questions.length} answered
        </p>
      </header>

      {content.questions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong bg-surface p-5 text-sm text-muted-foreground">
          This worksheet has no questions yet.
        </p>
      ) : (
        <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-2">
          {content.questions.map((question, index) => {
            const questionDomId = `${instanceId}-question-${index}`;
            const answered = isAnswered(question, answers[question.id]);

            return (
              <li
                key={question.id}
                className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-[0_3px_0_rgba(120,73,51,0.08)] sm:p-5"
              >
                <div className="mb-4 flex min-w-0 flex-wrap items-center gap-3 border-b border-border pb-4">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-double border-accent bg-primary font-serif text-lg font-semibold text-primary-foreground shadow-[0_2px_0_rgba(76,30,29,0.2)]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="min-w-0 flex-1 font-serif text-xl font-semibold leading-tight text-primary sm:text-2xl">
                    {getQuestionTitle(question.kind)}
                  </h3>
                  <span
                    className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${
                      answered
                        ? "bg-success-surface text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span aria-hidden="true">{answered ? "✓" : "○"}</span>
                    {answered ? "Answered" : "Not yet"}
                  </span>
                </div>

                {question.kind === "mcq" ? (
                  <fieldset className="min-w-0 space-y-3 border-0 p-0">
                    <legend className="block w-full break-words font-serif text-base leading-6 text-foreground sm:text-lg">
                      {question.prompt}
                    </legend>
                    <div className="space-y-2.5">
                      {question.options.map((option, optionIndex) => {
                        const optionId = `${questionDomId}-option-${optionIndex}`;
                        const selected = answers[question.id] === optionIndex;

                        return (
                          <label
                            key={optionId}
                            htmlFor={optionId}
                            className={`flex min-h-12 min-w-0 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm leading-5 transition-colors sm:px-4 ${
                              selected
                                ? "border-primary bg-accent text-primary"
                                : "border-border bg-surface-raised text-foreground hover:border-border-strong hover:bg-card"
                            }`}
                          >
                            <input
                              id={optionId}
                              type="radio"
                              name={`${instanceId}-question-${index}`}
                              value={optionIndex}
                              checked={selected}
                              onChange={() => updateAnswer(question.id, optionIndex)}
                              className="mt-0.5 size-5 shrink-0 accent-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            />
                            <span className="min-w-0 break-words">{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ) : question.kind === "code" ? (
                  // The embedded runner renders the prompt itself, so it is not repeated here.
                  <PythonRunner
                    embedded
                    prompt={question.prompt}
                    code={typeof answers[question.id] === "string" ? (answers[question.id] as string) : ""}
                    onChange={(code) => updateAnswer(question.id, code)}
                  />
                ) : (
                  <div className="min-w-0 space-y-3">
                    <label
                      htmlFor={questionDomId}
                      className="block break-words font-serif text-base leading-6 text-foreground sm:text-lg"
                    >
                      {question.prompt}
                    </label>
                    {question.kind === "short" ? (
                      <input
                        id={questionDomId}
                        type="text"
                        value={typeof answers[question.id] === "string" ? answers[question.id] : ""}
                        onChange={(event) => updateAnswer(question.id, event.target.value)}
                        placeholder="Write your answer here…"
                        className="min-h-12 w-full min-w-0 rounded-xl border border-border-strong bg-surface-raised px-4 py-3 text-base text-foreground placeholder:italic placeholder:text-muted-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      />
                    ) : (
                      <textarea
                        id={questionDomId}
                        rows={5}
                        value={typeof answers[question.id] === "string" ? answers[question.id] : ""}
                        onChange={(event) => updateAnswer(question.id, event.target.value)}
                        placeholder="Type your reflection here…"
                        className="w-full min-w-0 resize-y rounded-xl border border-border-strong bg-surface-raised px-4 py-3 text-base leading-6 text-foreground placeholder:italic placeholder:text-muted-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
