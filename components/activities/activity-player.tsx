"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WorksheetActivity } from "./worksheet-activity";
import { buildSubmissionAnswer, postActivitySubmission, type SubmissionResponse } from "./activity-player-submission";

export type PlayerWorksheetQuestion =
  | { id: string; kind: "mcq"; prompt: string; options: string[] }
  | { id: string; kind: "short" | "long" | "code"; prompt: string; options?: string[] };

export type PlayerWorksheetContent = { type: "worksheet"; questions: PlayerWorksheetQuestion[] };
export type PlayerWorksheetAnswers = Record<string, string | number>;

export type PlayerActivityContent =
  | { type: "video"; url: string; notes?: string }
  | { type: "check"; prompt: string; options?: string[] }
  | PlayerWorksheetContent
  | { type: "exit"; prompt: string; kind: "mcq" | "short"; options?: string[] };

export type PlayerActivity = { id: string; title: string; content: PlayerActivityContent };
export type PlayerAnswer = string | number | PlayerWorksheetAnswers;
export type PlayerAnswers = Record<string, PlayerAnswer>;

export type WorksheetRendererProps = {
  activityId: string;
  content: PlayerWorksheetContent;
  answers: PlayerWorksheetAnswers;
  onChange: (answers: PlayerWorksheetAnswers) => void;
};

export type ActivityPlayerProps = {
  moduleTitle: string;
  activities: readonly PlayerActivity[];
  initialActivityId?: string;
  position?: number;
  total?: number;
  backHref?: string;
  renderWorksheet?: (props: WorksheetRendererProps) => ReactNode;
  preview?: boolean;
  onChange?: (answers: PlayerAnswers) => void;
};

const inputClass = "min-h-12 w-full min-w-0 rounded-xl border border-[#b98770] bg-[#fffefa] px-4 py-3 text-base text-[#382a26] placeholder:italic placeholder:text-[#9b8578] outline-none focus-visible:ring-2 focus-visible:ring-[#7a2932] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8]";
const buttonClass = "inline-flex min-h-12 items-center justify-center rounded-xl border px-5 py-3 font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#7a2932] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";

function activityKindLabel(type: PlayerActivityContent["type"]) {
  return { video: "Lesson film", check: "Quick check", worksheet: "Practice sheet", exit: "Exit reflection" }[type];
}

function safeEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    const youtubeHosts = ["youtu.be", "youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"];
    if (youtubeHosts.includes(host)) {
      const id = host === "youtu.be" ? parts[0] : url.searchParams.get("v") ?? ( ["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : null );
      return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
      const id = parts.find((part) => /^\d+$/.test(part));
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "docs.google.com" && url.pathname.startsWith("/presentation/")) {
      const id = url.pathname.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1];
      return id ? `https://docs.google.com/presentation/d/${id}/embed` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function safeExternalUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function ChoiceInput({
  groupName,
  prompt,
  options,
  selected,
  onSelect,
}: {
  groupName: string;
  prompt: string;
  options: string[];
  selected?: number;
  onSelect: (index: number) => void;
}) {
  const groupId = useId();
  return (
    <fieldset className="min-w-0 space-y-3 border-0 p-0">
      <legend className="block w-full break-words font-serif text-lg leading-7 text-[#382a26]">{prompt}</legend>
      <div className="space-y-2.5">
        {options.map((option, index) => {
          const optionId = `${groupId}-option-${index}`;
          const checked = selected === index;
          return (
            <label key={optionId} htmlFor={optionId} className={`flex min-h-12 min-w-0 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm leading-5 transition-colors sm:px-4 ${checked ? "border-[#8c3d3b] bg-[#f7e8df] text-[#4e2527]" : "border-[#e5d7c7] bg-[#fffefa] text-[#43332d] hover:border-[#c29179] hover:bg-[#fcf5eb]"}`}>
              <input id={optionId} name={groupName} type="radio" value={index} checked={checked} onChange={() => onSelect(index)} className="mt-0.5 size-5 shrink-0 accent-[#752a32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#752a32]" />
              <span className="min-w-0 break-words">{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ShortInput({ id, prompt, value, onChange }: { id: string; prompt: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="min-w-0 space-y-3">
      <label htmlFor={id} className="block break-words font-serif text-lg leading-7 text-[#382a26]">{prompt}</label>
      <input id={id} type="text" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Write your answer here…" className={inputClass} />
    </div>
  );
}

function AnswerField({
  activityId,
  id,
  prompt,
  options,
  answer,
  instanceId,
  onAnswer,
}: {
  activityId: string;
  id: string;
  prompt: string;
  options?: string[];
  answer: PlayerAnswer | undefined;
  instanceId: string;
  onAnswer: (activityId: string, value: PlayerAnswer) => void;
}) {
  return options?.length ? (
    <ChoiceInput groupName={`${instanceId}-${activityId}`} prompt={prompt} options={options} selected={typeof answer === "number" ? answer : undefined} onSelect={(index) => onAnswer(activityId, index)} />
  ) : (
    <ShortInput id={id} prompt={prompt} value={typeof answer === "string" ? answer : ""} onChange={(value) => onAnswer(activityId, value)} />
  );
}

function ActivityContentView({
  activity,
  answer,
  instanceId,
  renderWorksheet,
  onAnswer,
}: {
  activity: PlayerActivity;
  answer: PlayerAnswer | undefined;
  instanceId: string;
  renderWorksheet?: ActivityPlayerProps["renderWorksheet"];
  onAnswer: (activityId: string, value: PlayerAnswer) => void;
}) {
  const { content } = activity;
  if (content.type === "video") {
    const embedUrl = safeEmbedUrl(content.url);
    const externalUrl = safeExternalUrl(content.url);
    return (
      <div className="space-y-4">
        {embedUrl ? (
          <div className="overflow-hidden rounded-2xl border border-[#d7b89f] bg-[#f3e6d4] shadow-[0_3px_0_rgba(120,73,51,0.08)]">
            <div className="aspect-video w-full"><iframe title={activity.title} src={embedUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="size-full border-0" /></div>
          </div>
        ) : externalUrl ? (
          <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-xl border border-[#b98770] bg-[#f7e8df] px-4 py-3 font-medium text-[#64252e] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#752a32]">Open lesson resource in a new tab</a>
        ) : <p className="rounded-xl border border-dashed border-[#c9a993] bg-[#fffdf8] p-4 text-sm text-[#765d51]">This lesson resource is unavailable.</p>}
        {content.notes && <p className="rounded-xl border border-[#e5d4c2] bg-[#fffdf8] p-4 text-sm leading-6 text-[#5e4a40]">{content.notes}</p>}
      </div>
    );
  }
  if (content.type === "worksheet") {
    // Answers are { [questionId]: optionIndex | text }, the shape buildSubmissionAnswer expects.
    const worksheetAnswers: PlayerWorksheetAnswers = answer && typeof answer === "object" ? answer : {};
    const onWorksheetChange = (value: PlayerWorksheetAnswers) => onAnswer(activity.id, value);
    return renderWorksheet
      ? renderWorksheet({ activityId: activity.id, content, answers: worksheetAnswers, onChange: onWorksheetChange })
      : <WorksheetActivity key={activity.id} content={content} initialAnswers={worksheetAnswers} onChange={onWorksheetChange} />;
  }
  const options = content.type === "check" || content.kind === "mcq" ? content.options : undefined;
  return <AnswerField activityId={activity.id} id={`${instanceId}-answer`} prompt={content.prompt} options={options} answer={answer} instanceId={instanceId} onAnswer={onAnswer} />;
}

export function ActivityPlayer({ moduleTitle, activities, initialActivityId, position, total, backHref, renderWorksheet, preview = false, onChange }: ActivityPlayerProps) {
  const router = useRouter();
  const instanceId = useId();
  const [currentIndex, setCurrentIndex] = useState(Math.max(0, activities.findIndex((activity) => activity.id === initialActivityId)));
  const [answers, setAnswers] = useState<PlayerAnswers>({});
  const answersRef = useRef<PlayerAnswers>({});
  const [confirmedSubmissions, setConfirmedSubmissions] = useState<Record<string, SubmissionResponse>>({});
  const startedAt = useRef<Record<string, string>>({});
  const revisions = useRef<Record<string, number>>({});
  const pending = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const activity = activities[currentIndex];
  const confirmation = activity ? confirmedSubmissions[activity.id] : undefined;

  useEffect(() => {
    if (activity && !startedAt.current[activity.id]) startedAt.current[activity.id] = new Date().toISOString();
  }, [activity]);

  function updateAnswer(activityId: string, answer: PlayerAnswer) {
    revisions.current[activityId] = (revisions.current[activityId] ?? 0) + 1;
    const nextAnswers = { ...answersRef.current, [activityId]: answer };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    onChange?.(nextAnswers);
    setConfirmedSubmissions((current) => {
      if (!current[activityId]) return current;
      const next = { ...current };
      delete next[activityId];
      return next;
    });
    setSubmitError("");
  }

  async function submitCurrentActivity() {
    if (!activity || preview || pending.current || confirmation) return;
    let answer: ReturnType<typeof buildSubmissionAnswer>;
    try { answer = buildSubmissionAnswer(activity.content, answersRef.current[activity.id]); }
    catch (error) { setSubmitError(error instanceof Error ? error.message : "Check your answer."); return; }
    const submittedRevision = revisions.current[activity.id] ?? 0;
    pending.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await postActivitySubmission(activity.id, startedAt.current[activity.id] ?? new Date().toISOString(), answer);
      if (result.kind === "unauthorized") { router.push("/learn"); return; }
      if ((revisions.current[activity.id] ?? 0) !== submittedRevision) throw new Error("Your answer changed while submitting. Submit again to save the latest version.");
      setConfirmedSubmissions((current) => ({ ...current, [activity.id]: result.data }));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Submission failed. Try again.");
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  function moveTo(index: number) {
    setCurrentIndex(index);
    setSubmitError("");
  }

  if (!activity) return <section className="mx-auto w-full max-w-4xl rounded-[1.75rem] border border-[#b98b70] bg-[#fffaf1] p-5 shadow-[0_14px_40px_rgba(77,37,26,0.10)] sm:p-8"><p className="font-serif text-xl font-semibold text-[#5d2028]">No activities are available yet.</p></section>;

  const shownPosition = position ?? currentIndex + 1;
  const shownTotal = total ?? activities.length;
  const progress = (shownPosition / shownTotal) * 100;
  return (
    <section aria-labelledby={`${instanceId}-module-title`} className="mx-auto w-full max-w-4xl rounded-[1.75rem] border border-[#b98b70] bg-[#fffaf1] p-4 shadow-[0_14px_40px_rgba(77,37,26,0.10),inset_0_0_0_3px_rgba(255,255,255,0.65)] sm:p-6 lg:p-8">
      <header className="mb-6 border-b border-[#e7d6c4] pb-5">
        <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#8b4c40]">The Study Nook · Module</p>
        <h1 id={`${instanceId}-module-title`} className="font-serif text-2xl font-semibold leading-tight text-[#5d2028] sm:text-3xl">{moduleTitle}</h1>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[#765d51]"><span>Position in this module</span><span>Activity {shownPosition} of {shownTotal}</span></div>
        <div role="progressbar" aria-label="Activity position in module" aria-valuemin={1} aria-valuemax={shownTotal} aria-valuenow={shownPosition} aria-valuetext={`Activity ${shownPosition} of ${shownTotal}`} className="mt-2 h-2 overflow-hidden rounded-full bg-[#ead8c5]">
          <div className="h-full rounded-full bg-[#7a2932] transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <article className="min-w-0 rounded-2xl border border-[#d7b89f] bg-[#fffdf8] p-4 shadow-[0_3px_0_rgba(120,73,51,0.08)] sm:p-6">
        <div className="mb-5 flex min-w-0 flex-wrap items-center gap-3 border-b border-[#eee0d1] pb-4">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-double border-[#f1c9ae] bg-[#762e32] font-serif text-lg font-semibold text-[#fff7e9] shadow-[0_2px_0_rgba(76,30,29,0.2)]">{String(shownPosition).padStart(2, "0")}</span>
          <div className="min-w-0 flex-1"><p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#8b4c40]">{activityKindLabel(activity.content.type)}</p><h2 className="break-words font-serif text-xl font-semibold leading-tight text-[#5d2028] sm:text-2xl">{activity.title}</h2></div>
          <span className={`inline-flex min-h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold ${confirmation ? "bg-[#e8e8d0] text-[#465038]" : "bg-[#f3ebe0] text-[#806d5c]"}`}>{confirmation ? "Confirmed" : "In progress"}</span>
        </div>
        <ActivityContentView activity={activity} answer={answers[activity.id]} instanceId={instanceId} renderWorksheet={renderWorksheet} onAnswer={updateAnswer} />
        {confirmation && (
          <div role="status" className="mt-5 rounded-xl border border-[#d9c4a5] bg-[#f2edda] p-4 text-sm leading-6 text-[#465038]">
            <p className="font-semibold">Saved ✓{confirmation.score !== null ? ` · Score: ${confirmation.score}%` : ""}</p>
            {confirmation.correct !== null && <p>{confirmation.correct ? "Correct answer" : "Not quite right"}</p>}
            {activity.content.type === "worksheet" && (
              <ul className="mt-2 list-inside list-disc">
                {activity.content.questions.map((question, index) => {
                  const result = confirmation.questionResults?.[question.id];
                  return <li key={question.id}>Question {index + 1}: {result === undefined ? "Ungraded" : result ? "Correct" : "Incorrect"}</li>;
                })}
              </ul>
            )}
          </div>
        )}
      </article>

      <nav aria-label="Activity controls" className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => backHref ? router.push(backHref) : moveTo(currentIndex - 1)} disabled={(!backHref && currentIndex === 0) || submitting} className={`${buttonClass} border-[#b98770] bg-[#fffdf8] text-[#64252e] hover:bg-[#f7e8df]`}>← Back</button>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={submitCurrentActivity} disabled={preview || submitting || Boolean(confirmation)} aria-describedby={preview ? `${instanceId}-submit-help` : undefined} className={`${buttonClass} border-[#7a2932] bg-[#762e32] text-[#fff7e9] hover:bg-[#64252e]`}>{submitting ? "Submitting…" : "Submit"}</button>
          <button type="button" onClick={() => { if (confirmation) router.push(confirmation.nextHref); }} disabled={!confirmation || submitting} className={`${buttonClass} border-[#7a2932] bg-[#762e32] text-[#fff7e9] hover:bg-[#64252e]`}>Next →</button>
        </div>
      </nav>

      <div className="mt-3 min-h-6 text-sm leading-6 text-[#765d51]" aria-live="polite">
        {preview && <p id={`${instanceId}-submit-help`}>Preview only. Open a student activity to submit.</p>}
        {!preview && !confirmation && <p>Submit this activity to continue after the server confirms it.</p>}
        {confirmation && <p>Saved by the server. You may continue.</p>}
        {submitError && <p role="alert" className="font-medium text-[#8c3037]">{submitError}</p>}
      </div>
    </section>
  );
}
