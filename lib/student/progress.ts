import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  currentModuleIndex,
  isModuleUnlocked,
  moduleStatus,
  nextStepInModule,
  type ActivityRef,
  type ModuleProgressInput,
  type ModuleStatus,
  type NextStep,
} from "@/lib/rules";

// Loads one student's assigned modules and what they've done, then runs
// lib/rules.ts over it. Uses the service role because students can't read
// modules/lessons/activities/assessments through RLS (those rows hold answers).
// Callers must pass the studentId from the verified student session, never
// from the request. Only ids, titles, positions and scores are selected here:
// no activity `content` and no assessment `questions`.

export type StudentActivity = ActivityRef & { title: string };

export type StudentModule = Omit<ModuleProgressInput, "activities"> & {
  index: number;
  title: string;
  description: string | null;
  activities: StudentActivity[];
  pretestId: string | null;
  posttestId: string | null;
  pretestScore: number | null;
  posttestScore: number | null;
  unlocked: boolean;
  status: ModuleStatus;
  next: NextStep;
};

export type StudentProgress = {
  studentId: string;
  classId: string;
  modules: StudentModule[];
  /** Index into `modules` of the current module, or -1 when all are complete. */
  currentIndex: number;
};

type ActivityRow = {
  id: string;
  type: ActivityRef["type"];
  title: string;
  position: number;
  required: boolean;
};
type LessonRow = { id: string; module_id: string; position: number; activities: ActivityRow[] };
type ModuleRow = { id: string; title: string; description: string | null };

export async function loadStudentProgress(studentId: string): Promise<StudentProgress> {
  const admin = createAdminClient();

  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id, class_id")
    .eq("id", studentId)
    .single();
  if (studentError || !student) throw new Error(`load student failed: ${studentError?.code}`);

  // CNT-6: students see published modules only. Assignment order is module order.
  const { data: assignmentRows, error: assignmentError } = await admin
    .from("assignments")
    .select("module_id, position, modules!inner(id, title, description, status)")
    .eq("class_id", student.class_id)
    .eq("modules.status", "published")
    .order("position", { ascending: true });
  if (assignmentError) throw new Error(`load assignments failed: ${assignmentError.code}`);

  const assigned = (assignmentRows ?? []).map((row) => {
    const mod = row.modules as unknown as ModuleRow | ModuleRow[];
    return Array.isArray(mod) ? mod[0] : mod;
  });
  const moduleIds = assigned.map((m) => m.id);
  if (moduleIds.length === 0) {
    return { studentId, classId: student.class_id, modules: [], currentIndex: -1 };
  }

  const [lessonsRes, assessmentsRes, submissionsRes, resultsRes] = await Promise.all([
    admin
      .from("lessons")
      .select("id, module_id, position, activities(id, type, title, position, required)")
      .in("module_id", moduleIds),
    admin.from("assessments").select("id, module_id, kind").in("module_id", moduleIds),
    admin.from("submissions").select("activity_id").eq("student_id", studentId),
    admin.from("assessment_results").select("assessment_id, score").eq("student_id", studentId),
  ]);
  for (const res of [lessonsRes, assessmentsRes, submissionsRes, resultsRes]) {
    if (res.error) throw new Error(`load progress failed: ${res.error.code}`);
  }

  const lessons = (lessonsRes.data ?? []) as unknown as LessonRow[];
  const assessments = assessmentsRes.data ?? [];
  const submitted = new Set((submissionsRes.data ?? []).map((s) => s.activity_id as string));
  const scoreByAssessment = new Map(
    (resultsRes.data ?? []).map((r) => [r.assessment_id as string, Number(r.score)]),
  );

  const inputs = assigned.map((mod) => {
    const activities: StudentActivity[] = lessons
      .filter((l) => l.module_id === mod.id)
      .sort((a, b) => a.position - b.position)
      .flatMap((l) =>
        [...(l.activities ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((a) => ({ id: a.id, type: a.type, required: a.required, title: a.title })),
      );
    const pre = assessments.find((a) => a.module_id === mod.id && a.kind === "pre");
    const post = assessments.find((a) => a.module_id === mod.id && a.kind === "post");
    const mine = new Set(activities.filter((a) => submitted.has(a.id)).map((a) => a.id));
    return {
      moduleId: mod.id,
      title: mod.title,
      description: mod.description,
      activities,
      hasPretest: !!pre,
      hasPosttest: !!post,
      pretestTaken: !!pre && scoreByAssessment.has(pre.id),
      posttestTaken: !!post && scoreByAssessment.has(post.id),
      submitted: mine,
      pretestId: pre?.id ?? null,
      posttestId: post?.id ?? null,
      pretestScore: pre ? (scoreByAssessment.get(pre.id) ?? null) : null,
      posttestScore: post ? (scoreByAssessment.get(post.id) ?? null) : null,
    };
  });

  const modules: StudentModule[] = inputs.map((m, index) => {
    const unlocked = isModuleUnlocked(inputs, index);
    return { ...m, index, unlocked, status: moduleStatus(m, unlocked), next: nextStepInModule(m) };
  });

  return {
    studentId,
    classId: student.class_id,
    modules,
    currentIndex: currentModuleIndex(modules),
  };
}

/** Link for a module's next step; locked or finished modules go back home. */
export function nextStepHref(m: StudentModule): string {
  if (!m.unlocked) return "/learn";
  switch (m.next.kind) {
    case "pretest":
      return `/learn/${m.moduleId}/pretest`;
    case "activity":
      return `/learn/${m.moduleId}/${m.next.activityId}`;
    case "posttest":
      return `/learn/${m.moduleId}/posttest`;
    case "done":
      return "/learn";
  }
}

export function findModule(p: StudentProgress, moduleId: string): StudentModule | undefined {
  return p.modules.find((m) => m.moduleId === moduleId);
}

export function findModuleForActivity(
  p: StudentProgress,
  activityId: string,
): StudentModule | undefined {
  return p.modules.find((m) => m.activities.some((a) => a.id === activityId));
}
