import type { PlayerActivityContent, PlayerAnswer } from "./activity-player";
import type { SubmissionResponse, SubmissionError } from "@/app/api/submissions/route";

export type { SubmissionResponse, SubmissionError };

export function buildSubmissionAnswer(content: PlayerActivityContent, answer: PlayerAnswer | undefined) {
  if (content.type === "video") return { watched: true };
  if (content.type === "worksheet") {
    const answers = answer && typeof answer === "object" ? answer : {};
    const complete = content.questions.length > 0 && content.questions.every((question) => {
      const value = answers[question.id];
      return question.kind === "mcq"
        ? typeof value === "number" && Number.isInteger(value) && value >= 0 && value < question.options.length
        : typeof value === "string" && value.trim().length > 0;
    });
    if (!complete) throw new Error("Answer every worksheet question before submitting.");
    return { answers };
  }
  const choice = content.type === "check" ? Boolean(content.options?.length) : content.kind === "mcq";
  if (choice) {
    const options = content.options ?? [];
    if (typeof answer !== "number" || !Number.isInteger(answer) || answer < 0 || answer >= options.length) throw new Error("Choose an answer before submitting.");
    return { choice: answer };
  }
  if (typeof answer !== "string" || !answer.trim()) throw new Error("Write an answer before submitting.");
  return { text: answer };
}

export async function postActivitySubmission(activityId: string, startedAt: string, answer: ReturnType<typeof buildSubmissionAnswer>, request: typeof fetch = fetch) {
  const response = await request("/api/submissions", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activityId, startedAt, answer }) });
  const data: SubmissionResponse | SubmissionError | null = await response.json().catch(() => null);
  if (response.status === 401) return { kind: "unauthorized" as const };
  if (!response.ok) throw new Error(data && "error" in data ? data.error : "Submission failed. Try again.");
  if (!data || !("nextHref" in data) || typeof data.nextHref !== "string" || !/^\/learn(?:\/|$)/.test(data.nextHref)) throw new Error("The server returned an invalid confirmation. Try again.");
  return { kind: "saved" as const, data };
}
