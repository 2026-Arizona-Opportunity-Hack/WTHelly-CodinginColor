import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { assessmentQuestions } from "@/lib/student/scoring";
import { canTakePretest, isPosttestUnlocked, type AssessmentKind } from "@/lib/rules";
import type { StudentModule } from "@/lib/student/progress";

/** A test question as the browser sees it: no `answer`. */
export type PublicQuestion = { id: string; prompt: string; options: string[] };

/** Questions with their answer keys, server only. Throws if the row is missing or malformed. */
export async function loadAssessmentQuestions(assessmentId: string) {
  const { data, error } = await createAdminClient()
    .from("assessments")
    .select("questions")
    .eq("id", assessmentId)
    .single();
  if (error || !data) throw new Error(`load assessment failed: ${error?.code}`);
  const parsed = assessmentQuestions.safeParse(data.questions);
  if (!parsed.success) throw new Error("assessment questions are malformed");
  return parsed.data;
}

/** Same questions with every `answer` removed, safe to render. */
export async function loadPublicQuestions(assessmentId: string): Promise<PublicQuestion[]> {
  const questions = await loadAssessmentQuestions(assessmentId);
  return questions.map(({ id, prompt, options }) => ({ id, prompt, options }));
}

export type TestState =
  | { state: "open"; assessmentId: string }
  | { state: "taken"; score: number | null }
  | { state: "locked"; reason: string }
  | { state: "missing" };

/** Whether this student may take the module's pretest or post-test right now (ASM-2, ASM-3). */
export function testState(m: StudentModule, kind: AssessmentKind): TestState {
  const id = kind === "pre" ? m.pretestId : m.posttestId;
  if (!id) return { state: "missing" };
  if (kind === "pre") {
    if (m.pretestTaken) return { state: "taken", score: m.pretestScore };
    if (!canTakePretest(m, m.unlocked)) {
      return { state: "locked", reason: "Finish the module before this one first." };
    }
    return { state: "open", assessmentId: id };
  }
  if (m.posttestTaken) return { state: "taken", score: m.posttestScore };
  if (!m.unlocked) return { state: "locked", reason: "Finish the module before this one first." };
  if (!isPosttestUnlocked(m, m.unlocked)) {
    return {
      state: "locked",
      reason: m.pretestTaken
        ? "The post-test opens after you submit the exit question."
        : "Take the pretest first.",
    };
  }
  return { state: "open", assessmentId: id };
}
