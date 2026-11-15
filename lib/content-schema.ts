import { z } from "zod";

// Module content shapes for the admin editor (CNT-1 to CNT-9, ASM-1).
// Two levels of checking:
//   - modulePayloadSchema: what any save accepts (drafts may be incomplete).
//   - publishProblems(): what a published module must satisfy.
// Shapes match docs/mvp.md and what lib/student/scoring.ts reads.

export const MAX_QUESTIONS = 30;
export const MAX_OPTIONS = 8;
export const MAX_TAGS = 20;

const questionId = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "Invalid question id.");
const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
// Raw editor lines (blank lines allowed while typing); the cleaned count is checked on publish.
const options = z.array(z.string().max(500, "Keep each option under 500 characters.")).max(
  MAX_OPTIONS * 2,
  `Use at most ${MAX_OPTIONS} options.`,
);
const answerIndex = z.int().min(0).nullable();

export const testQuestionSchema = z.object({
  id: questionId,
  prompt: text(2000),
  options,
  answer: answerIndex,
});
export type TestQuestion = z.infer<typeof testQuestionSchema>;

export const WORKSHEET_KINDS = ["mcq", "short", "long", "code"] as const;
export const worksheetQuestionSchema = z.object({
  id: questionId,
  kind: z.enum(WORKSHEET_KINDS),
  prompt: text(2000),
  options,
  answer: answerIndex,
});
export type WorksheetQuestion = z.infer<typeof worksheetQuestionSchema>;

export const activityContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("video"), url: text(500), notes: text(5000) }),
  z.object({ type: z.literal("check"), prompt: text(2000), options, answer: answerIndex }),
  z.object({
    type: z.literal("worksheet"),
    questions: z.array(worksheetQuestionSchema).max(MAX_QUESTIONS, `Use at most ${MAX_QUESTIONS} questions.`),
  }),
  z.object({
    type: z.literal("exit"),
    prompt: text(2000),
    kind: z.enum(["mcq", "short"]),
    options,
    answer: z.null(),
  }),
  // Code activities (RUN-*) aren't edited here yet: only title and position change.
  z.object({ type: z.literal("code") }).loose(),
]);
export type ActivityContent = z.infer<typeof activityContentSchema>;

export const modulePayloadSchema = z.object({
  title: text(200),
  description: text(2000),
  conceptTags: z.string().max(1000),
  pretest: z.array(testQuestionSchema).max(MAX_QUESTIONS, `Use at most ${MAX_QUESTIONS} questions.`),
  posttest: z.array(testQuestionSchema).max(MAX_QUESTIONS, `Use at most ${MAX_QUESTIONS} questions.`),
  // Array order is the order students see (CNT-1).
  activities: z
    .array(z.object({ id: z.guid(), title: text(200), content: activityContentSchema }))
    .max(50),
});
export type ModulePayload = z.infer<typeof modulePayloadSchema>;

/** "Loops, Variables ,loops" → ["loops", "variables"], or an error message. */
export function parseTags(raw: string): { tags: string[] } | { error: string } {
  const tags = [
    ...new Set(
      raw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (tags.length > MAX_TAGS) return { error: `Use at most ${MAX_TAGS} concept tags.` };
  if (tags.some((t) => t.length > 40)) return { error: "Keep each concept tag under 40 characters." };
  return { tags };
}

/**
 * Drop blank option lines and keep the correct answer pointing at the same
 * text. The editor keeps raw lines (so typing a newline works); this runs
 * before every save.
 */
export function cleanOptions(raw: string[], answer: number | null) {
  const kept: string[] = [];
  let newAnswer: number | null = null;
  raw.forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    if (i === answer) newAnswer = kept.length;
    kept.push(t);
  });
  return { options: kept, answer: newAnswer };
}

/** Normalise a parsed payload: clean options, clear fields a kind doesn't use. */
export function normalizePayload(p: ModulePayload): ModulePayload {
  const q = (x: TestQuestion): TestQuestion => ({ ...x, ...cleanOptions(x.options, x.answer) });
  return {
    ...p,
    pretest: p.pretest.map(q),
    posttest: p.posttest.map(q),
    activities: p.activities.map((a) => ({ ...a, content: normalizeContent(a.content) })),
  };
}

function normalizeContent(c: ActivityContent): ActivityContent {
  switch (c.type) {
    case "check":
      return { ...c, ...cleanOptions(c.options, c.answer) };
    case "worksheet":
      return {
        ...c,
        questions: c.questions.map((q) =>
          q.kind === "mcq" ? { ...q, ...cleanOptions(q.options, q.answer) } : { ...q, options: [], answer: null },
        ),
      };
    case "exit":
      return { ...c, options: c.kind === "mcq" ? cleanOptions(c.options, null).options : [], answer: null };
    default:
      return c;
  }
}

/** The content as stored in activities.content (video notes omitted when blank). */
export function storedContent(c: ActivityContent): Record<string, unknown> {
  if (c.type === "video") return c.notes ? { type: "video", url: c.url, notes: c.notes } : { type: "video", url: c.url };
  return c;
}

export const ACTIVITY_LABEL: Record<string, string> = {
  video: "Video",
  check: "Quick check",
  worksheet: "Worksheet",
  exit: "Exit question",
  code: "Code",
};

function isHttpsUrl(raw: string) {
  try {
    return new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}

function mcqProblems(label: string, prompt: string, opts: string[], answer: number | null, needsAnswer: boolean) {
  const out: string[] = [];
  if (!prompt) out.push(`${label}: write the question.`);
  if (opts.length < 2) out.push(`${label}: add at least 2 options (one per line).`);
  else if (opts.length > MAX_OPTIONS) out.push(`${label}: use at most ${MAX_OPTIONS} options.`);
  else if (needsAnswer && (answer === null || answer >= opts.length)) out.push(`${label}: choose the correct option.`);
  return out;
}

/**
 * Everything that blocks publishing (ASM-1, required fields, content checks).
 * Takes a normalised payload. Empty list = OK to publish.
 */
export function publishProblems(p: ModulePayload, tags: string[]): string[] {
  const out: string[] = [];
  if (!p.title) out.push("Details: add a module title.");
  if (!tags.length) out.push("Details: add at least one concept tag.");

  if (!p.pretest.length) out.push("Pretest: add at least one question.");
  if (!p.posttest.length) out.push("Post-test: add at least one question.");
  if (p.pretest.length !== p.posttest.length) {
    out.push(
      `The pretest has ${p.pretest.length} questions and the post-test has ${p.posttest.length}. They must have the same number.`,
    );
  }
  p.pretest.forEach((q, i) => out.push(...mcqProblems(`Pretest question ${i + 1}`, q.prompt, q.options, q.answer, true)));
  p.posttest.forEach((q, i) => out.push(...mcqProblems(`Post-test question ${i + 1}`, q.prompt, q.options, q.answer, true)));

  if (!p.activities.length) out.push("Activities: the lesson has no activities.");
  p.activities.forEach((a, i) => {
    const label = `Activity ${i + 1} (${ACTIVITY_LABEL[a.content.type]})`;
    if (!a.title) out.push(`${label}: add a title.`);
    const c = a.content;
    switch (c.type) {
      case "video":
        if (!isHttpsUrl(c.url)) out.push(`${label}: add a video or slides link starting with https://.`);
        break;
      case "check":
        out.push(...mcqProblems(label, c.prompt, c.options, c.answer, true));
        break;
      case "worksheet":
        if (!c.questions.length) out.push(`${label}: add at least one question.`);
        c.questions.forEach((q, j) => {
          const ql = `${label}, question ${j + 1}`;
          if (q.kind === "mcq") out.push(...mcqProblems(ql, q.prompt, q.options, q.answer, true));
          else if (!q.prompt) out.push(`${ql}: write the question.`);
        });
        break;
      case "exit":
        if (c.kind === "mcq") out.push(...mcqProblems(label, c.prompt, c.options, null, false));
        else if (!c.prompt) out.push(`${label}: write the question.`);
        break;
    }
  });
  return out;
}

// --- Loading stored rows into the editor ------------------------------------

const asText = (v: unknown) => (typeof v === "string" ? v : "");
const asOptions = (v: unknown) => (Array.isArray(v) ? v.filter((o): o is string => typeof o === "string") : []);
const asAnswer = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

/** Stored questions JSON → editor questions, filling any missing fields. */
export function editorTestQuestions(raw: unknown): TestQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((q, i) => ({
    id: typeof q?.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(q.id) ? q.id : `q${i + 1}`,
    prompt: asText(q?.prompt),
    options: asOptions(q?.options),
    answer: asAnswer(q?.answer),
  }));
}

/** Stored activity content → editor content for its type, filling any missing fields. */
export function editorContent(type: string, raw: unknown): ActivityContent {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  switch (type) {
    case "video":
      return { type: "video", url: asText(c.url), notes: asText(c.notes) };
    case "check":
      return { type: "check", prompt: asText(c.prompt), options: asOptions(c.options), answer: asAnswer(c.answer) };
    case "worksheet":
      return {
        type: "worksheet",
        questions: (Array.isArray(c.questions) ? c.questions : []).map((q, i) => ({
          id: typeof q?.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(q.id) ? q.id : `q${i + 1}`,
          kind: (WORKSHEET_KINDS as readonly string[]).includes(q?.kind) ? q.kind : "short",
          prompt: asText(q?.prompt),
          options: asOptions(q?.options),
          answer: asAnswer(q?.answer),
        })),
      };
    case "exit":
      return {
        type: "exit",
        prompt: asText(c.prompt),
        kind: c.kind === "mcq" ? "mcq" : "short",
        options: asOptions(c.options),
        answer: null,
      };
    default:
      return { type: "code" };
  }
}

// --- Default template (CNT-3) ------------------------------------------------

export function newQuestionId(prefix = "q") {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export function emptyTestQuestion(prefix: string): TestQuestion {
  return { id: newQuestionId(prefix), prompt: "", options: [], answer: null };
}

/** pretest → lesson (video, check, worksheet, exit) → post-test. */
export function defaultTemplate() {
  return {
    pretest: Array.from({ length: 5 }, () => emptyTestQuestion("pre")),
    posttest: Array.from({ length: 5 }, () => emptyTestQuestion("post")),
    activities: [
      { type: "video", title: "Watch", content: { type: "video", url: "" } },
      { type: "check", title: "Quick check", content: { type: "check", prompt: "", options: [], answer: null } },
      {
        type: "worksheet",
        title: "Practice worksheet",
        content: {
          type: "worksheet",
          questions: [{ id: newQuestionId("ws"), kind: "mcq", prompt: "", options: [], answer: null }],
        },
      },
      {
        type: "exit",
        title: "Exit ticket",
        content: { type: "exit", prompt: "", kind: "short", options: [], answer: null },
      },
    ] as const,
  };
}

/** Readable label for a zod issue path, e.g. ["pretest", 2, "prompt"] → "Pretest question 3". */
export function issueLabel(path: PropertyKey[]): string {
  const [section, index, field, sub] = path;
  if ((section === "pretest" || section === "posttest") && typeof index === "number") {
    return `${section === "pretest" ? "Pretest" : "Post-test"} question ${index + 1}`;
  }
  if (section === "activities" && typeof index === "number") {
    if (field === "content" && sub === "questions" && typeof path[4] === "number") {
      return `Activity ${index + 1}, question ${path[4] + 1}`;
    }
    return `Activity ${index + 1}`;
  }
  if (section === "title" || section === "description" || section === "conceptTags") return "Details";
  return "Form";
}
