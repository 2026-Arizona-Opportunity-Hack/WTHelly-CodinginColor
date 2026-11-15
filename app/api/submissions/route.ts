import { NextResponse } from "next/server";
import { z } from "zod";
import { getStudentSession } from "@/lib/auth/student-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { activityAfter, isActivityUnlocked, isPosttestUnlocked } from "@/lib/rules";
import { findModuleForActivity, loadStudentProgress } from "@/lib/student/progress";
import { scoreActivity, type ActivityType } from "@/lib/student/scoring";

// STU-4 / PRG-1: save one activity submission, scored on the server.
// The student comes from the session cookie, never from the body. The answer
// key is read with the service role and never returned.

const MAX_TIME_ON_TASK_SEC = 4 * 60 * 60;

const requestSchema = z.object({
  activityId: z.uuid(),
  /** When the student opened the activity (ISO 8601). Used for time on task. */
  startedAt: z.iso.datetime({ offset: true }).optional(),
  /** Shape depends on the activity type; see lib/student/scoring.ts. */
  answer: z.unknown(),
});

export type SubmissionResponse = {
  /** true/false for auto-scored items; null when only marked complete. */
  correct: boolean | null;
  /** 0–100, or null when not auto-scored. */
  score: number | null;
  /** The next activity in this module, or null after the last one. */
  nextActivityId: string | null;
  /** Where the Next button should go: next activity, the post-test, or /learn. */
  nextHref: string;
  /** Worksheets only: questionId → right/wrong for auto-scored questions. */
  questionResults?: Record<string, boolean>;
};

export type SubmissionError = { error: string };

const fail = (error: string, status: number) =>
  NextResponse.json<SubmissionError>({ error }, { status });

export async function POST(request: Request) {
  const session = await getStudentSession();
  if (!session) return fail("Your session expired. Join your class again.", 401);

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid request.", 400);
  const { activityId, startedAt, answer } = parsed.data;

  try {
    const progress = await loadStudentProgress(session.studentId);
    const mod = findModuleForActivity(progress, activityId);
    // Not in a published module assigned to this student's class.
    if (!mod) return fail("Activity not found.", 404);
    if (!isActivityUnlocked(mod, mod.unlocked, activityId)) {
      return fail("This activity is locked. Finish the steps before it first.", 403);
    }

    const admin = createAdminClient();
    const { data: activity, error: loadError } = await admin
      .from("activities")
      .select("id, type, content")
      .eq("id", activityId)
      .single();
    if (loadError || !activity) {
      console.error("submissions: load activity failed", loadError?.code);
      return fail("Something went wrong. Try again in a moment.", 500);
    }

    const result = scoreActivity(activity.type as ActivityType, activity.content, answer);
    if (!result.ok) return fail(result.error, 400);

    const now = new Date();
    const timing = timeOnTask(startedAt, now);
    const { error: saveError } = await admin.from("submissions").upsert(
      {
        student_id: session.studentId,
        activity_id: activityId,
        answer: result.stored,
        score: result.score,
        started_at: timing.startedAt,
        submitted_at: now.toISOString(),
        time_spent_sec: timing.seconds,
      },
      { onConflict: "student_id,activity_id" },
    );
    if (saveError) {
      console.error("submissions: upsert failed", saveError.code);
      return fail("Something went wrong. Try again in a moment.", 500);
    }

    const after = { ...mod, submitted: new Set([...mod.submitted, activityId]) };
    const nextActivityId = activityAfter(after, activityId);
    const nextHref = nextActivityId
      ? `/learn/${mod.moduleId}/${nextActivityId}`
      : isPosttestUnlocked(after, mod.unlocked) && !after.posttestTaken
        ? `/learn/${mod.moduleId}/posttest`
        : "/learn";

    return NextResponse.json<SubmissionResponse>({
      correct: result.correct,
      score: result.score,
      nextActivityId,
      nextHref,
      ...(result.questionResults ? { questionResults: result.questionResults } : {}),
    });
  } catch (err) {
    console.error("submissions: failed", err instanceof Error ? err.message : err);
    return fail("Something went wrong. Try again in a moment.", 500);
  }
}

/** Clamp the client's start time to [now − 4 h, now]; missing → no timing. */
function timeOnTask(startedAt: string | undefined, now: Date) {
  if (!startedAt) return { startedAt: null, seconds: null };
  const ms = Math.min(
    Math.max(now.getTime() - new Date(startedAt).getTime(), 0),
    MAX_TIME_ON_TASK_SEC * 1000,
  );
  return {
    startedAt: new Date(now.getTime() - ms).toISOString(),
    seconds: Math.round(ms / 1000),
  };
}
