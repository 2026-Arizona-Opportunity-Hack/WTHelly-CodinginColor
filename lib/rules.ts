export type ProgressModule = {
  id: string;
  title: string;
  requiredActivityIds: string[];
};

export type ProgressSubmission = {
  student_id: string;
  activity_id: string;
  submitted_at: string;
};

export type ProgressAssessment = {
  student_id: string;
  module_id: string;
  kind: "pre" | "post";
  score: number;
  taken_at?: string;
};

export function isModuleComplete(module: ProgressModule, submissions: ProgressSubmission[], assessments: ProgressAssessment[], studentId: string) {
  const doneActivityIds = new Set(submissions.filter((row) => row.student_id === studentId).map((row) => row.activity_id));
  const tests = assessments.filter((row) => row.student_id === studentId && row.module_id === module.id);
  return tests.some((row) => row.kind === "pre") && tests.some((row) => row.kind === "post") &&
    module.requiredActivityIds.every((activityId) => doneActivityIds.has(activityId));
}

export function getModuleCompletionPct(
  module: ProgressModule,
  students: { id: string }[],
  submissions: ProgressSubmission[],
  assessments: ProgressAssessment[],
) {
  if (!students.length) return 0;
  const complete = students.filter((student) => isModuleComplete(module, submissions, assessments, student.id)).length;
  return Math.round((complete / students.length) * 100);
}

export function getOverallCompletionPct(
  modules: ProgressModule[],
  students: { id: string }[],
  submissions: ProgressSubmission[],
  assessments: ProgressAssessment[],
) {
  if (!students.length || !modules.length) return 0;
  const complete = modules.reduce((sum, module) => sum + students.filter((student) => isModuleComplete(module, submissions, assessments, student.id)).length, 0);
  return Math.round((complete / (students.length * modules.length)) * 100);
}

export function getStudentProgress(
  modules: ProgressModule[],
  submissions: ProgressSubmission[],
  assessments: ProgressAssessment[],
  studentId: string,
  now = new Date(),
  stuckAfterDays = 3,
) {
  const studentSubmissions = submissions.filter((row) => row.student_id === studentId);
  const completedModules = new Set(modules.filter((module) => isModuleComplete(module, submissions, assessments, studentId)).map((module) => module.id));

  const currentModule = modules.find((module) => !completedModules.has(module.id));
  const reportModule = currentModule ?? modules.at(-1);
  const currentModuleSubmissions = currentModule
    ? studentSubmissions.filter((row) => currentModule.requiredActivityIds.includes(row.activity_id))
    : [];
  const studentAssessments = assessments.filter((row) => row.student_id === studentId);
  const lastActive = [...studentSubmissions.map((row) => row.submitted_at), ...studentAssessments.flatMap((row) => row.taken_at ? [row.taken_at] : [])].reduce<string | null>(
    (latest, timestamp) => !latest || timestamp > latest ? timestamp : latest,
    null,
  );
  const scores = reportModule ? studentAssessments.filter((row) => row.module_id === reportModule.id) : [];
  const pre = scores.find((row) => row.kind === "pre")?.score ?? null;
  const post = scores.find((row) => row.kind === "post")?.score ?? null;
  const currentTests = currentModule ? studentAssessments.filter((row) => row.module_id === currentModule.id) : [];

  return {
    currentModule,
    completionPct: currentModule
      ? Math.round(((currentModuleSubmissions.length + currentTests.length) / (currentModule.requiredActivityIds.length + 2)) * 100)
      : 100,
    pre,
    post,
    gain: pre !== null && post !== null ? Math.round((post - pre) * 10) / 10 : null,
    lastActive,
    notStarted: studentSubmissions.length === 0 && studentAssessments.length === 0,
    stuck: Boolean(currentModule && (currentModuleSubmissions.length || currentTests.length) && lastActive &&
      now.getTime() - new Date(lastActive).getTime() >= stuckAfterDays * 86400000),
    activitiesDone: studentSubmissions.length,
  };
}

