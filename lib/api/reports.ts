import { getStudentProgress, isModuleComplete, type ProgressAssessment, type ProgressModule, type ProgressSubmission } from "@/lib/class-progress";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DateFilters } from "./request";

type Cohort = { id: string; name: string; program: string; school: string; term: string };
type ClassRow = { id: string; cohort_id: string | null };
type Student = { id: string; class_id: string };
type Assignment = { class_id: string; module_id: string; position: number; modules: { id: string; title: string } | null };
type Activity = { id: string; required: boolean; type: string; lessons: { module_id: string } };
type Assessment = { id: string; module_id: string; kind: "pre" | "post" };
type GainRow = { student_id: string; class_id: string; module_id: string; pre_score: number | null; post_score: number | null; gain: number | null };
type SummaryRow = { class_id: string; module_id: string; students_with_both: number; avg_pre: number | null; avg_post: number | null; avg_gain: number | null };

export type ApiModuleSummary = {
  module_id: string;
  title: string;
  completion_pct: number;
  avg_pre: number | null;
  avg_post: number | null;
  avg_gain: number | null;
  stuck_count: number;
};

function failOnError(error: { message: string } | null) {
  if (error) throw new Error("Report data could not be loaded.");
}

function pairStats(rows: GainRow[]) {
  const paired = rows.filter((row) => row.gain !== null && row.pre_score !== null && row.post_score !== null);
  const average = (field: "pre_score" | "post_score" | "gain") => paired.length
    ? Math.round((paired.reduce((sum, row) => sum + Number(row[field]), 0) / paired.length) * 10) / 10
    : null;
  return {
    avg_pre: average("pre_score"),
    avg_post: average("post_score"),
    avg_gain: average("gain"),
    students_with_both_tests: new Set(paired.map((row) => row.student_id)).size,
    pairs: paired.length,
  };
}

export async function loadReportData(filters: DateFilters) {
  const supabase = createAdminClient();
  let submissionQuery = supabase.from("submissions").select("student_id, activity_id, submitted_at");
  let resultQuery = supabase.from("assessment_results").select("student_id, assessment_id, score, taken_at");
  if (filters.from) {
    const bound = `${filters.from}T00:00:00.000Z`;
    submissionQuery = submissionQuery.gte("submitted_at", bound);
    resultQuery = resultQuery.gte("taken_at", bound);
  }
  if (filters.to) {
    const bound = `${filters.to}T23:59:59.999Z`;
    submissionQuery = submissionQuery.lte("submitted_at", bound);
    resultQuery = resultQuery.lte("taken_at", bound);
  }
  const [{ data: cohorts, error: cohortError }, { data: classes, error: classError },
    { data: students, error: studentError }, { data: assignments, error: assignmentError },
    { data: activities, error: activityError }, { data: assessments, error: assessmentError },
    { data: submissions, error: submissionError }, { data: results, error: resultError },
    { data: gains, error: gainError }, { data: summaries, error: summaryError }] = await Promise.all([
      supabase.from("cohorts").select("id, name, program, school, term").order("name"),
      supabase.from("classes").select("id, cohort_id"),
      supabase.from("students").select("id, class_id"),
      supabase.from("assignments").select("class_id, module_id, position, modules!inner(id, title)").order("position"),
      supabase.from("activities").select("id, required, type, lessons!inner(module_id)"),
      supabase.from("assessments").select("id, module_id, kind"),
      submissionQuery,
      resultQuery,
      !filters.from && !filters.to
        ? supabase.from("learning_gain").select("student_id, class_id, module_id, pre_score, post_score, gain")
        : Promise.resolve({ data: null, error: null }),
      !filters.from && !filters.to
        ? supabase.from("class_module_summary").select("class_id, module_id, students_with_both, avg_pre, avg_post, avg_gain")
        : Promise.resolve({ data: null, error: null }),
    ]);
  [cohortError, classError, studentError, assignmentError, activityError, assessmentError, submissionError, resultError, gainError, summaryError].forEach(failOnError);

  const cohortRows = (cohorts ?? []) as Cohort[];
  const classRows = (classes ?? []) as ClassRow[];
  const studentRows = (students ?? []) as Student[];
  const assignmentRows = (assignments ?? []) as unknown as Assignment[];
  const activityRows = (activities ?? []) as unknown as Activity[];
  const assessmentRows = (assessments ?? []) as Assessment[];
  const submissionRows = (submissions ?? []) as unknown as ProgressSubmission[];
  const resultRows = (results ?? []) as unknown as { student_id: string; assessment_id: string; score: number; taken_at: string }[];
  const definitions = new Map(assessmentRows.map((row) => [row.id, row]));
  const progressAssessments: ProgressAssessment[] = resultRows.flatMap((row) => {
    const definition = definitions.get(row.assessment_id);
    return definition ? [{ student_id: row.student_id, module_id: definition.module_id, kind: definition.kind, score: Number(row.score), taken_at: row.taken_at }] : [];
  });
  const progressModulesByClass = new Map<string, ProgressModule[]>();
  for (const row of assignmentRows) {
    if (!row.modules) continue;
    const assigned = progressModulesByClass.get(row.class_id) ?? [];
    assigned.push({
      id: row.module_id,
      title: row.modules.title,
      requiredActivityIds: activityRows.filter((activity) => activity.lessons.module_id === row.module_id && activity.required).map((activity) => activity.id),
    });
    progressModulesByClass.set(row.class_id, assigned);
  }
  const gainRows = (gains ?? []) as unknown as GainRow[];
  const dateFilteredPairs: GainRow[] = [];
  if (filters.from || filters.to) {
    const byStudentModule = new Map<string, { student_id: string; class_id: string; module_id: string; pre_score: number | null; post_score: number | null }>();
    for (const row of progressAssessments) {
      const student = studentRows.find((s) => s.id === row.student_id);
      if (!student) continue;
      const pairKey = `${row.student_id}:${row.module_id}`;
      const pair = byStudentModule.get(pairKey) ?? { student_id: row.student_id, class_id: student.class_id, module_id: row.module_id, pre_score: null, post_score: null };
      if (row.kind === "pre") pair.pre_score = row.score;
      else pair.post_score = row.score;
      byStudentModule.set(pairKey, pair);
    }
    for (const pair of byStudentModule.values()) {
      dateFilteredPairs.push({ ...pair, gain: pair.pre_score !== null && pair.post_score !== null ? pair.post_score - pair.pre_score : null });
    }
  }
  const allPairs = filters.from || filters.to ? dateFilteredPairs : gainRows;
  const summariesByClassModule = new Map<string, SummaryRow>(((summaries ?? []) as unknown as SummaryRow[]).map((row) => [`${row.class_id}:${row.module_id}`, row]));

  function classRowsForCohort(cohortId: string) {
    return classRows.filter((row) => row.cohort_id === cohortId);
  }
  function studentsForClasses(classIds: string[]) {
    const ids = new Set(classIds);
    return studentRows.filter((student) => ids.has(student.class_id));
  }
  function completion(classIds: string[]) {
    const ids = new Set(classIds);
    let done = 0;
    let possible = 0;
    for (const classId of classIds) {
      const members = studentRows.filter((student) => student.class_id === classId);
      const modules = progressModulesByClass.get(classId) ?? [];
      possible += members.length * modules.length;
      for (const student of members) {
        done += modules.filter((module) => isModuleComplete(module, submissionRows, progressAssessments, student.id)).length;
      }
    }
    return possible ? Math.round(done / possible * 100) : 0;
  }
  function stuckCount(classId: string, moduleId: string) {
    const modules = progressModulesByClass.get(classId) ?? [];
    return studentRows.filter((student) => {
      if (student.class_id !== classId) return false;
      const progress = getStudentProgress(modules, submissionRows, progressAssessments, student.id);
      return progress.stuck && progress.currentModule?.id === moduleId;
    }).length;
  }
  function pairsForClasses(classIds: string[]) {
    const ids = new Set(classIds);
    return pairStats(allPairs.filter((row) => ids.has(row.class_id)));
  }

  return { cohortRows, classRows, studentRows, assignmentRows, progressModulesByClass, submissionRows, progressAssessments, allPairs, summariesByClassModule, classRowsForCohort, studentsForClasses, completion, stuckCount, pairsForClasses };
}

export async function getCohortReport(filters: DateFilters) {
  const report = await loadReportData(filters);
  return report.cohortRows.map((cohort) => {
    const classes = report.classRowsForCohort(cohort.id);
    const classIds = classes.map((row) => row.id);
    const students = report.studentsForClasses(classIds);
    const stats = report.pairsForClasses(classIds);
    return { id: cohort.id, name: cohort.name, program: cohort.program, school: cohort.school, term: cohort.term,
      students: students.length, completion_pct: report.completion(classIds), avg_pre: stats.avg_pre,
      avg_post: stats.avg_post, avg_gain: stats.avg_gain, students_with_both_tests: stats.students_with_both_tests };
  });
}

export async function getClassReport(classId: string, filters: DateFilters): Promise<ApiModuleSummary[] | null> {
  const report = await loadReportData(filters);
  const classRow = report.classRows.find((row) => row.id === classId);
  if (!classRow) return null;
  const modules = report.progressModulesByClass.get(classId) ?? [];
  const members = report.studentRows.filter((student) => student.class_id === classId);
  return modules.map((module) => {
    const stats = filters.from || filters.to
      ? pairStats(report.allPairs.filter((row) => row.class_id === classId && row.module_id === module.id))
      : report.summariesByClassModule.get(`${classId}:${module.id}`);
    const completeCount = members.filter((student) => isModuleComplete(module, report.submissionRows, report.progressAssessments, student.id)).length;
    return { module_id: module.id, title: module.title, completion_pct: members.length ? Math.round(completeCount / members.length * 100) : 0,
      avg_pre: stats?.avg_pre ?? null, avg_post: stats?.avg_post ?? null, avg_gain: stats?.avg_gain ?? null, stuck_count: report.stuckCount(classId, module.id) };
  });
}

export async function getProgramReport(filters: DateFilters) {
  const report = await loadReportData(filters);
  return ["AI Academy", "K12", "Summer Camp", "Day of Compute"].map((program) => {
    const cohorts = report.cohortRows.filter((row) => row.program === program);
    const classes = cohorts.flatMap((cohort) => report.classRowsForCohort(cohort.id));
    const classIds = classes.map((row) => row.id);
    const members = report.studentsForClasses(classIds);
    const stats = report.pairsForClasses(classIds);
    return { program, cohorts: cohorts.length, classes: classes.length, students: members.length,
      completion_pct: report.completion(classIds), avg_pre: stats.avg_pre, avg_post: stats.avg_post,
      avg_gain: stats.avg_gain, students_with_both_tests: stats.students_with_both_tests };
  });
}
