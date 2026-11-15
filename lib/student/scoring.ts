import "server-only";
import { z } from "zod";
import { percentScore } from "@/lib/rules";

// Server-side scoring for POST /api/submissions and POST /api/assessments.
// Reads the real answer keys from activity `content` / assessment `questions`
// (loaded with the service role) and never sends them back. Only the fields
// scoring needs are parsed here; the full content schema lives with the editor.

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Please write an answer before you submit.")
    .max(max, `Answers can be up to ${max} characters.`);
const choice = z.int().min(0);

// --- Stored content (answer keys) ------------------------------------------

const checkContent = z.object({
  options: z.array(z.string()).default([]),
  answer: z.union([z.int(), z.string()]).nullish(),
});
const worksheetContent = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["mcq", "short", "long", "code"]),
      options: z.array(z.string()).default([]),
      answer: z.union([z.int(), z.string()]).nullish(),
    }),
  ),
});
const exitContent = z.object({
  kind: z.enum(["mcq", "short"]).default("short"),
  options: z.array(z.string()).default([]),
});

export const assessmentQuestions = z.array(
  z.object({
    id: z.string(),
    prompt: z.string(),
    options: z.array(z.string()),
    answer: z.int(),
  }),
);

// --- Student answers (request bodies) ---------------------------------------

/** What the browser sends as `answer`, per activity type. */
export const answerSchemas = {
  video: z.object({ watched: z.literal(true) }).nullish(),
  check: z.union([z.object({ choice }), z.object({ text: text(2000) })]),
  worksheet: z.object({ answers: z.record(z.string(), z.union([choice, z.string()])) }),
  exit: z.union([z.object({ choice }), z.object({ text: text(2000) })]),
  code: z.object({ code: z.string().max(20_000) }),
} as const;

export type ActivityType = keyof typeof answerSchemas;

export type ActivityScore =
  | {
      ok: true;
      /** Saved to submissions.answer. */
      stored: Record<string, unknown>;
      /** 0–100 for auto-scored items, null when only marked complete. */
      score: number | null;
      correct: boolean | null;
      /** Worksheets only: per auto-scored question, right or wrong. Never the right answer. */
      questionResults?: Record<string, boolean>;
    }
  | { ok: false; error: string };

const bad = (error: string): ActivityScore => ({ ok: false, error });

/**
 * Validate a student's answer against the activity and score it.
 * check / worksheet mcq: auto-scored when the content has an answer key.
 * short / long / code text and exit questions: marked complete, score null.
 */
export function scoreActivity(type: ActivityType, content: unknown, rawAnswer: unknown): ActivityScore {
  switch (type) {
    case "video": {
      const a = answerSchemas.video.safeParse(rawAnswer);
      if (!a.success) return bad("Invalid answer for a video.");
      return { ok: true, stored: { watched: true }, score: null, correct: null };
    }

    case "check": {
      const c = checkContent.safeParse(content);
      if (!c.success) return bad("This activity is set up wrong. Tell your teacher.");
      const a = answerSchemas.check.safeParse(rawAnswer);
      if (!a.success) return bad(firstIssue(a.error, "Pick an answer before you submit."));
      if (c.data.options.length > 0) {
        if (!("choice" in a.data) || a.data.choice >= c.data.options.length) {
          return bad("Pick one of the answers.");
        }
        const key = c.data.answer;
        if (typeof key !== "number") {
          return { ok: true, stored: { choice: a.data.choice }, score: null, correct: null };
        }
        const correct = a.data.choice === key;
        return { ok: true, stored: { choice: a.data.choice }, score: correct ? 100 : 0, correct };
      }
      if (!("text" in a.data)) return bad("Write an answer before you submit.");
      return { ok: true, stored: { text: a.data.text }, score: null, correct: null };
    }

    case "worksheet": {
      const c = worksheetContent.safeParse(content);
      if (!c.success) return bad("This activity is set up wrong. Tell your teacher.");
      const a = answerSchemas.worksheet.safeParse(rawAnswer);
      if (!a.success) return bad("Answer every question before you submit.");
      const stored: Record<string, number | string> = {};
      const questionResults: Record<string, boolean> = {};
      for (const [i, q] of c.data.questions.entries()) {
        const given = a.data.answers[q.id];
        const label = `Question ${i + 1}`;
        if (q.kind === "mcq") {
          if (typeof given !== "number" || given < 0 || given >= q.options.length) {
            return bad(`${label}: pick one of the answers.`);
          }
          stored[q.id] = given;
          if (typeof q.answer === "number") questionResults[q.id] = given === q.answer;
        } else {
          const max = q.kind === "short" ? 2000 : 20_000;
          const t = text(max).safeParse(given);
          if (!t.success) return bad(`${label}: ${firstIssue(t.error, "write an answer.")}`);
          stored[q.id] = t.data;
        }
      }
      const scored = Object.values(questionResults);
      if (scored.length === 0) {
        return { ok: true, stored: { answers: stored }, score: null, correct: null };
      }
      const right = scored.filter(Boolean).length;
      return {
        ok: true,
        stored: { answers: stored },
        score: percentScore(right, scored.length),
        correct: right === scored.length,
        questionResults,
      };
    }

    case "exit": {
      const c = exitContent.safeParse(content);
      if (!c.success) return bad("This activity is set up wrong. Tell your teacher.");
      const a = answerSchemas.exit.safeParse(rawAnswer);
      if (!a.success) return bad(firstIssue(a.error, "Answer the question before you submit."));
      if (c.data.kind === "mcq") {
        if (!("choice" in a.data) || a.data.choice >= c.data.options.length) {
          return bad("Pick one of the answers.");
        }
        return { ok: true, stored: { choice: a.data.choice }, score: null, correct: null };
      }
      if (!("text" in a.data)) return bad("Write an answer before you submit.");
      return { ok: true, stored: { text: a.data.text }, score: null, correct: null };
    }

    case "code": {
      // RUN-2 (hidden tests) is P1; until then a code submission is marked complete.
      const a = answerSchemas.code.safeParse(rawAnswer);
      if (!a.success) return bad("Invalid code submission.");
      return { ok: true, stored: { code: a.data.code }, score: null, correct: null };
    }
  }
}

/** Score a pretest/post-test: every question must be answered. */
export function scoreAssessment(
  questions: z.infer<typeof assessmentQuestions>,
  answers: Record<string, number>,
):
  | { ok: true; score: number; correct: number; total: number; stored: Record<string, number> }
  | { ok: false; error: string } {
  const stored: Record<string, number> = {};
  let correct = 0;
  for (const [i, q] of questions.entries()) {
    const given = answers[q.id];
    if (typeof given !== "number" || !Number.isInteger(given) || given < 0 || given >= q.options.length) {
      return { ok: false, error: `Question ${i + 1}: pick one of the answers.` };
    }
    stored[q.id] = given;
    if (given === q.answer) correct++;
  }
  return {
    ok: true,
    score: percentScore(correct, questions.length),
    correct,
    total: questions.length,
    stored,
  };
}

function firstIssue(error: z.ZodError, fallback: string): string {
  const msg = error.issues.find((i) => i.code !== "invalid_union")?.message;
  return msg && !msg.startsWith("Invalid") ? msg : fallback;
}
