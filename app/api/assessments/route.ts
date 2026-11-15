import { NextResponse } from "next/server";
import { z } from "zod";
import { getStudentSession } from "@/lib/auth/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextStepInModule } from "@/lib/rules";
import { loadAssessmentQuestions, testState } from "@/lib/student/assessment";
import { findModule, loadStudentProgress, nextStepHref } from "@/lib/student/progress";
import { scoreAssessment } from "@/lib/student/scoring";

// ASM-1..3: take a module's pretest or post-test once, scored on the server.

const requestSchema = z.object({
  moduleId: z.uuid(),
  kind: z.enum(["pre", "post"]),
  /** questionId → chosen option index. */
  answers: z.record(z.string().max(100), z.int().min(0)),
});

export type AssessmentResponse = {
  score: number;
  correct: number;
  total: number;
  nextHref: string;
};

const fail = (error: string, status: number) =>
  NextResponse.json<{ error: string }>({ error }, { status });

const ALREADY_TAKEN = "You already took this test. Each test can be taken once.";

export async function POST(request: Request) {
  const session = await getStudentSession();
  if (!session) return fail("Your session expired. Join your class again.", 401);

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid request.", 400);
  const { moduleId, kind, answers } = parsed.data;

  try {
    const progress = await loadStudentProgress(session.studentId);
    const mod = findModule(progress, moduleId);
    if (!mod) return fail("Module not found.", 404);

    const state = testState(mod, kind);
    if (state.state === "missing") return fail("This module has no test yet.", 404);
    if (state.state === "taken") return fail(ALREADY_TAKEN, 409);
    if (state.state === "locked") return fail(state.reason, 403);

    const questions = await loadAssessmentQuestions(state.assessmentId);
    const result = scoreAssessment(questions, answers);
    if (!result.ok) return fail(result.error, 400);

    // The primary key (student_id, assessment_id) makes this insert-once even
    // if two tabs submit at the same moment.
    const { error } = await createAdminClient().from("assessment_results").insert({
      student_id: session.studentId,
      assessment_id: state.assessmentId,
      answers: result.stored,
      score: result.score,
    });
    if (error?.code === "23505") return fail(ALREADY_TAKEN, 409);
    if (error) {
      console.error("assessments: insert failed", error.code);
      return fail("Something went wrong. Try again in a moment.", 500);
    }

    const after =
      kind === "pre"
        ? { ...mod, pretestTaken: true, pretestScore: result.score }
        : { ...mod, posttestTaken: true, posttestScore: result.score };
    const nextHref = nextStepHref({ ...after, next: nextStepInModule(after) });

    return NextResponse.json<AssessmentResponse>({
      score: result.score,
      correct: result.correct,
      total: result.total,
      nextHref,
    });
  } catch (err) {
    console.error("assessments: failed", err instanceof Error ? err.message : err);
    return fail("Something went wrong. Try again in a moment.", 500);
  }
}
