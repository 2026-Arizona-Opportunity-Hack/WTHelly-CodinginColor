"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/action-message";
import {
  ACTIVITY_LABEL,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  WORKSHEET_KINDS,
  emptyTestQuestion,
  newQuestionId,
  type ActivityContent,
  type ModulePayload,
  type TestQuestion,
  type WorksheetQuestion,
} from "@/lib/content-schema";
import { saveModule, type SaveResult } from "../actions";

type Status = "draft" | "published";
type Locked = { pretest: string[]; posttest: string[]; activities: string[] };
type Activity = ModulePayload["activities"][number];

const textareaClass = inputClass.replace("h-10", "min-h-20 py-2");
const labelClass = "block text-sm font-medium";
const sectionClass = "space-y-4 rounded-xl border p-4 sm:p-6";

const KIND_LABEL: Record<WorksheetQuestion["kind"], string> = {
  mcq: "Multiple choice",
  short: "Short answer",
  long: "Long answer",
  code: "Code",
};

/** Swap item i with its neighbour; returns the same array if it can't move. */
function moved<T>(list: T[], i: number, dir: "up" | "down") {
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** After a move, keep focus on the moved item's button (or its other move button at an end). */
function focusMove(key: string, dir: "up" | "down") {
  setTimeout(() => {
    const q = (d: string) => document.querySelector<HTMLButtonElement>(`[data-move="${key}-${d}"]:not(:disabled)`);
    (q(dir) ?? q(dir === "up" ? "down" : "up"))?.focus();
  }, 0);
}

function focusId(id: string) {
  setTimeout(() => document.getElementById(id)?.focus(), 0);
}

/** CNT-1–6, CNT-8, CNT-9, ASM-1: one form for the whole module. */
export function ModuleEditor({
  moduleId,
  initial,
  initialStatus,
  locked,
  created,
  lessonTitle,
}: {
  moduleId: string;
  initial: ModulePayload;
  initialStatus: Status;
  locked: Locked;
  created: boolean;
  lessonTitle: string;
}) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(
    created ? { ok: true, message: "Draft created from the default template. Fill it in, then Save or Publish." } : null,
  );
  const [pending, startTransition] = useTransition();
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(patch: Partial<ModulePayload>) {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  }

  function submit(intent: "save" | "publish" | "unpublish") {
    startTransition(async () => {
      let res: SaveResult;
      try {
        res = await saveModule(moduleId, form, intent);
      } catch {
        res = { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
      }
      setResult(res);
      if (res.ok) {
        setDirty(false);
        if (res.status) setStatus(res.status);
      }
      messageRef.current?.focus();
      messageRef.current?.scrollIntoView({ block: "center" });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{form.title || "Untitled module"}</h1>
        <span
          className={
            status === "published"
              ? "rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
              : "rounded-full border border-border px-2 py-0.5 text-xs font-medium"
          }
        >
          {status === "published" ? "Published" : "Draft"}
        </span>
      </div>

      <div ref={messageRef} tabIndex={-1} className="outline-none">
        <div role="status" aria-live="polite">
          {result?.ok && (
            <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm font-medium">{result.message}</p>
          )}
        </div>
        <div role="alert">
          {result && !result.ok && (
            <div className="rounded-lg border border-destructive/40 px-4 py-3 text-sm text-destructive">
              <p className="font-medium">{result.message}</p>
              {result.problems && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <section aria-labelledby="details-heading" className={sectionClass}>
        <h2 id="details-heading" className="text-xl font-semibold">Details</h2>
        <Field id="m-title" label="Title">
          <input id="m-title" className={inputClass} value={form.title} maxLength={200} onChange={(e) => update({ title: e.target.value })} />
        </Field>
        <Field id="m-desc" label="Description">
          <textarea id="m-desc" className={textareaClass} value={form.description} maxLength={2000} onChange={(e) => update({ description: e.target.value })} />
        </Field>
        <Field id="m-tags" label="Concept tags" hint="Comma-separated, e.g. loops, variables">
          <input id="m-tags" className={inputClass} value={form.conceptTags} maxLength={1000} onChange={(e) => update({ conceptTags: e.target.value })} />
        </Field>
      </section>

      <TestSection
        scope="pre"
        title="Pretest"
        questions={form.pretest}
        locked={locked.pretest}
        onChange={(pretest) => update({ pretest })}
      />

      <section aria-labelledby="acts-heading" className={sectionClass}>
        <h2 id="acts-heading" className="text-xl font-semibold">Activities</h2>
        <p className="text-sm text-muted-foreground">
          {lessonTitle}. Students see these in this order, after the pretest and before the post-test.
        </p>
        <ol className="space-y-4">
          {form.activities.map((a, i) => (
            <li key={a.id}>
              <ActivityCard
                activity={a}
                index={i}
                count={form.activities.length}
                hasResults={locked.activities.includes(a.id)}
                onChange={(next) => update({ activities: form.activities.map((x) => (x.id === a.id ? next : x)) })}
                onMove={(dir) => {
                  update({ activities: moved(form.activities, i, dir) });
                  focusMove(a.id, dir);
                }}
              />
            </li>
          ))}
        </ol>
      </section>

      <TestSection
        scope="post"
        title="Post-test"
        questions={form.posttest}
        locked={locked.posttest}
        onChange={(posttest) => update({ posttest })}
      />

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background px-4 py-3">
        <Button type="button" size="lg" disabled={pending} onClick={() => submit("save")}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {status === "draft" ? (
          <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => submit("publish")}>
            Save and publish
          </Button>
        ) : (
          <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => submit("unpublish")}>
            Unpublish
          </Button>
        )}
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {dirty ? "Unsaved changes" : ""}
        </span>
      </div>
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

/** Options textarea (one per line) + correct-option select. Raw lines are kept until save. */
function OptionsFields({
  idBase,
  options,
  answer,
  withAnswer,
  onChange,
}: {
  idBase: string;
  options: string[];
  answer: number | null;
  withAnswer: boolean;
  onChange: (options: string[], answer: number | null) => void;
}) {
  const filled = options.map((o, i) => ({ text: o.trim(), i })).filter((o) => o.text);
  return (
    <>
      <Field id={`${idBase}-options`} label="Options" hint={`One per line, up to ${MAX_OPTIONS}.`}>
        <textarea
          id={`${idBase}-options`}
          aria-describedby={`${idBase}-options-hint`}
          className={textareaClass}
          value={options.join("\n")}
          onChange={(e) => {
            const lines = e.target.value.split("\n").slice(0, MAX_OPTIONS * 2);
            onChange(lines, answer !== null && answer < lines.length && lines[answer].trim() ? answer : null);
          }}
        />
      </Field>
      {withAnswer && (
        <Field id={`${idBase}-answer`} label="Correct option">
          <select
            id={`${idBase}-answer`}
            className={inputClass}
            value={answer === null ? "" : String(answer)}
            onChange={(e) => onChange(options, e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">Choose…</option>
            {filled.map((o, n) => (
              <option key={o.i} value={o.i}>
                {n + 1}. {o.text.slice(0, 80)}
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  );
}

function MoveButtons({
  moveKey,
  label,
  index,
  count,
  onMove,
}: {
  moveKey: string;
  label: string;
  index: number;
  count: number;
  onMove: (dir: "up" | "down") => void;
}) {
  return (
    <>
      <Button type="button" variant="outline" size="sm" data-move={`${moveKey}-up`} disabled={index === 0} onClick={() => onMove("up")} aria-label={`Move ${label} up`}>
        Move up
      </Button>
      <Button type="button" variant="outline" size="sm" data-move={`${moveKey}-down`} disabled={index === count - 1} onClick={() => onMove("down")} aria-label={`Move ${label} down`}>
        Move down
      </Button>
    </>
  );
}

function TestSection({
  scope,
  title,
  questions,
  locked,
  onChange,
}: {
  scope: "pre" | "post";
  title: string;
  questions: TestQuestion[];
  locked: string[];
  onChange: (q: TestQuestion[]) => void;
}) {
  const addId = `add-${scope}`;
  return (
    <section aria-labelledby={`${scope}-heading`} className={sectionClass}>
      <h2 id={`${scope}-heading`} className="text-xl font-semibold">
        {title} <span className="text-base font-normal text-muted-foreground">({questions.length} questions)</span>
      </h2>
      <p className="text-sm text-muted-foreground">Pretest and post-test must have the same number of questions to publish.</p>
      <ol className="space-y-4">
        {questions.map((q, i) => {
          const idBase = `${scope}-${q.id}`;
          const label = `${title} question ${i + 1}`;
          return (
            <li key={q.id}>
              <fieldset className="space-y-3 rounded-lg border p-4">
                <legend className="px-1 font-medium">Question {i + 1}</legend>
                <Field id={`${idBase}-prompt`} label="Question">
                  <textarea
                    id={`${idBase}-prompt`}
                    className={textareaClass}
                    value={q.prompt}
                    maxLength={2000}
                    onChange={(e) => onChange(questions.map((x) => (x.id === q.id ? { ...x, prompt: e.target.value } : x)))}
                  />
                </Field>
                <OptionsFields
                  idBase={idBase}
                  options={q.options}
                  answer={q.answer}
                  withAnswer
                  onChange={(options, answer) => onChange(questions.map((x) => (x.id === q.id ? { ...x, options, answer } : x)))}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <MoveButtons
                    moveKey={q.id}
                    label={label}
                    index={i}
                    count={questions.length}
                    onMove={(dir) => {
                      onChange(moved(questions, i, dir));
                      focusMove(q.id, dir);
                    }}
                  />
                  {locked.includes(q.id) ? (
                    <span className="text-sm text-muted-foreground">Students have answered this test, so this question can&apos;t be removed.</span>
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      aria-label={`Remove ${label}`}
                      onClick={() => {
                        onChange(questions.filter((x) => x.id !== q.id));
                        focusId(addId);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <Button
        id={addId}
        type="button"
        variant="outline"
        disabled={questions.length >= MAX_QUESTIONS}
        onClick={() => {
          const q = emptyTestQuestion(scope);
          onChange([...questions, q]);
          focusId(`${scope}-${q.id}-prompt`);
        }}
      >
        Add {title.toLowerCase()} question
      </Button>
    </section>
  );
}

function ActivityCard({
  activity,
  index,
  count,
  hasResults,
  onChange,
  onMove,
}: {
  activity: Activity;
  index: number;
  count: number;
  hasResults: boolean;
  onChange: (a: Activity) => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const c = activity.content;
  const idBase = `act-${activity.id}`;
  const typeLabel = ACTIVITY_LABEL[c.type];
  const setContent = (content: ActivityContent) => onChange({ ...activity, content });

  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="px-1 font-medium">
        {index + 1}. {typeLabel}
      </legend>
      <Field id={`${idBase}-title`} label="Activity title">
        <input
          id={`${idBase}-title`}
          className={inputClass}
          value={activity.title}
          maxLength={200}
          onChange={(e) => onChange({ ...activity, title: e.target.value })}
        />
      </Field>

      {c.type === "video" && (
        <>
          <Field id={`${idBase}-url`} label="Video or slides URL" hint="YouTube, Vimeo or Google Slides link starting with https://">
            <input
              id={`${idBase}-url`}
              type="url"
              aria-describedby={`${idBase}-url-hint`}
              className={inputClass}
              value={c.url}
              maxLength={500}
              onChange={(e) => setContent({ ...c, url: e.target.value })}
            />
          </Field>
          <Field id={`${idBase}-notes`} label="Notes (optional)">
            <textarea id={`${idBase}-notes`} className={textareaClass} value={c.notes} maxLength={5000} onChange={(e) => setContent({ ...c, notes: e.target.value })} />
          </Field>
        </>
      )}

      {c.type === "check" && (
        <>
          <Field id={`${idBase}-prompt`} label="Question">
            <textarea id={`${idBase}-prompt`} className={textareaClass} value={c.prompt} maxLength={2000} onChange={(e) => setContent({ ...c, prompt: e.target.value })} />
          </Field>
          <OptionsFields idBase={idBase} options={c.options} answer={c.answer} withAnswer onChange={(options, answer) => setContent({ ...c, options, answer })} />
        </>
      )}

      {c.type === "exit" && (
        <>
          <Field id={`${idBase}-prompt`} label="Question">
            <textarea id={`${idBase}-prompt`} className={textareaClass} value={c.prompt} maxLength={2000} onChange={(e) => setContent({ ...c, prompt: e.target.value })} />
          </Field>
          <Field id={`${idBase}-kind`} label="Answer type">
            <select
              id={`${idBase}-kind`}
              className={inputClass}
              value={c.kind}
              onChange={(e) => setContent({ ...c, kind: e.target.value === "mcq" ? "mcq" : "short" })}
            >
              <option value="short">Short answer</option>
              <option value="mcq">Multiple choice</option>
            </select>
          </Field>
          {c.kind === "mcq" && (
            <OptionsFields idBase={idBase} options={c.options} answer={null} withAnswer={false} onChange={(options) => setContent({ ...c, options })} />
          )}
        </>
      )}

      {c.type === "worksheet" && (
        <WorksheetFields
          idBase={idBase}
          questions={c.questions}
          hasResults={hasResults}
          onChange={(questions) => setContent({ ...c, questions })}
        />
      )}

      {c.type === "code" && <p className="text-sm text-muted-foreground">Code activities can&apos;t be edited here yet.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <MoveButtons moveKey={activity.id} label={`activity ${index + 1}, ${typeLabel}`} index={index} count={count} onMove={onMove} />
      </div>
    </fieldset>
  );
}

function WorksheetFields({
  idBase,
  questions,
  hasResults,
  onChange,
}: {
  idBase: string;
  questions: WorksheetQuestion[];
  hasResults: boolean;
  onChange: (q: WorksheetQuestion[]) => void;
}) {
  // Questions that existed when the page loaded; with results they can't be removed (CNT-9).
  const [savedIds] = useState(() => new Set(questions.map((q) => q.id)));
  const addId = `${idBase}-add`;
  const set = (id: string, patch: Partial<WorksheetQuestion>) =>
    onChange(questions.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Worksheet questions</h3>
      <ol className="space-y-3">
        {questions.map((q, i) => {
          const qBase = `${idBase}-${q.id}`;
          const label = `worksheet question ${i + 1}`;
          return (
            <li key={q.id}>
              <fieldset className="space-y-3 rounded-lg border border-dashed p-3">
                <legend className="px-1 text-sm font-medium">Question {i + 1}</legend>
                <Field id={`${qBase}-kind`} label="Question type">
                  <select
                    id={`${qBase}-kind`}
                    className={inputClass}
                    value={q.kind}
                    onChange={(e) => set(q.id, { kind: e.target.value as WorksheetQuestion["kind"] })}
                  >
                    {WORKSHEET_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id={`${qBase}-prompt`} label="Question">
                  <textarea id={`${qBase}-prompt`} className={textareaClass} value={q.prompt} maxLength={2000} onChange={(e) => set(q.id, { prompt: e.target.value })} />
                </Field>
                {q.kind === "mcq" && (
                  <OptionsFields idBase={qBase} options={q.options} answer={q.answer} withAnswer onChange={(options, answer) => set(q.id, { options, answer })} />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <MoveButtons
                    moveKey={q.id}
                    label={label}
                    index={i}
                    count={questions.length}
                    onMove={(dir) => {
                      onChange(moved(questions, i, dir));
                      focusMove(q.id, dir);
                    }}
                  />
                  {hasResults && savedIds.has(q.id) ? (
                    <span className="text-sm text-muted-foreground">Students have answered this worksheet, so this question can&apos;t be removed.</span>
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      aria-label={`Remove ${label}`}
                      onClick={() => {
                        onChange(questions.filter((x) => x.id !== q.id));
                        focusId(addId);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <Button
        id={addId}
        type="button"
        variant="outline"
        disabled={questions.length >= MAX_QUESTIONS}
        onClick={() => {
          const id = newQuestionId("ws");
          onChange([...questions, { id, kind: "mcq", prompt: "", options: [], answer: null }]);
          focusId(`${idBase}-${id}-kind`);
        }}
      >
        Add worksheet question
      </Button>
    </div>
  );
}
