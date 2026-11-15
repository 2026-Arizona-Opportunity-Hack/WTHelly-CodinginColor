"use client";

import { useId, useRef, useState } from "react";

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
      className="w-full rounded-[1.75rem] border border-[#b98b70] bg-[#fffaf1] p-4 shadow-[0_14px_40px_rgba(77,37,26,0.10),inset_0_0_0_3px_rgba(255,255,255,0.65)] sm:p-6 lg:p-8"
    >
      <header className="mb-6 flex flex-col gap-4 border-b border-[#e7d6c4] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8b4c40]">
            Your practice sheet
          </p>
          <h2
            id={`${instanceId}-title`}
            className="font-serif text-2xl font-semibold leading-tight text-[#5d2028] sm:text-3xl"
          >
            Work through each question
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#765d51]">
            Take your time. Your answers stay on this page while you work.
          </p>
        </div>
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-full border border-[#d9c4a5] bg-[#f2edda] px-4 py-2 text-sm font-medium text-[#4e5035]"
        >
          <span aria-hidden="true" className="size-2 rounded-full bg-[#7b7448]" />
          {answeredCount} of {content.questions.length} answered
        </p>
      </header>

      {content.questions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#c9a993] bg-[#fffdf8] p-5 text-sm text-[#765d51]">
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
                className="min-w-0 rounded-2xl border border-[#d7b89f] bg-[#fffdf8] p-4 shadow-[0_3px_0_rgba(120,73,51,0.08)] sm:p-5"
              >
                <div className="mb-4 flex min-w-0 flex-wrap items-center gap-3 border-b border-[#eee0d1] pb-4">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-double border-[#f1c9ae] bg-[#762e32] font-serif text-lg font-semibold text-[#fff7e9] shadow-[0_2px_0_rgba(76,30,29,0.2)]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="min-w-0 flex-1 font-serif text-xl font-semibold leading-tight text-[#5d2028] sm:text-2xl">
                    {getQuestionTitle(question.kind)}
                  </h3>
                  <span
                    className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${
                      answered
                        ? "bg-[#e8e8d0] text-[#465038]"
                        : "bg-[#f3ebe0] text-[#806d5c]"
                    }`}
                  >
                    <span aria-hidden="true">{answered ? "✓" : "○"}</span>
                    {answered ? "Answered" : "Not yet"}
                  </span>
                </div>

                {question.kind === "mcq" ? (
                  <fieldset className="min-w-0 space-y-3 border-0 p-0">
                    <legend className="block w-full break-words font-serif text-base leading-6 text-[#382a26] sm:text-lg">
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
                                ? "border-[#8c3d3b] bg-[#f7e8df] text-[#4e2527]"
                                : "border-[#e5d7c7] bg-[#fffefa] text-[#43332d] hover:border-[#c29179] hover:bg-[#fcf5eb]"
                            }`}
                          >
                            <input
                              id={optionId}
                              type="radio"
                              name={`${instanceId}-question-${index}`}
                              value={optionIndex}
                              checked={selected}
                              onChange={() => updateAnswer(question.id, optionIndex)}
                              className="mt-0.5 size-5 shrink-0 accent-[#752a32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#752a32]"
                            />
                            <span className="min-w-0 break-words">{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ) : (
                  <div className="min-w-0 space-y-3">
                    <label
                      htmlFor={questionDomId}
                      className="block break-words font-serif text-base leading-6 text-[#382a26] sm:text-lg"
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
                        className="min-h-12 w-full min-w-0 rounded-xl border border-[#b98770] bg-[#fffefa] px-4 py-3 text-base text-[#382a26] placeholder:italic placeholder:text-[#9b8578] outline-none transition focus-visible:ring-2 focus-visible:ring-[#7a2932] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8]"
                      />
                    ) : (
                      <>
                        <textarea
                          id={questionDomId}
                          rows={question.kind === "code" ? 7 : 5}
                          value={typeof answers[question.id] === "string" ? answers[question.id] : ""}
                          onChange={(event) => updateAnswer(question.id, event.target.value)}
                          placeholder={question.kind === "code" ? "# Write your code here…" : "Type your reflection here…"}
                          spellCheck={question.kind !== "code"}
                          autoCapitalize={question.kind === "code" ? "off" : undefined}
                          autoCorrect={question.kind === "code" ? "off" : undefined}
                          aria-describedby={question.kind === "code" ? `${questionDomId}-hint` : undefined}
                          className={`w-full min-w-0 resize-y rounded-xl border border-[#b98770] bg-[#fffefa] px-4 py-3 text-base leading-6 text-[#382a26] placeholder:italic placeholder:text-[#9b8578] outline-none transition focus-visible:ring-2 focus-visible:ring-[#7a2932] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] ${
                            question.kind === "code" ? "font-mono text-sm placeholder:not-italic" : ""
                          }`}
                        />
                        {question.kind === "code" && (
                          <p id={`${questionDomId}-hint`} className="text-xs leading-5 text-[#806b5e]">
                            Python code entry only. It will not run in this worksheet.
                          </p>
                        )}
                      </>
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
