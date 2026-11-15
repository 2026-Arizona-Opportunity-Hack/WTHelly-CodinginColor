import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOverallCompletionPct, getStudentProgress, type ProgressAssessment, type ProgressModule, type ProgressSubmission } from "@/lib/class-progress";

const linkClass = "rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring";

export default function AdminPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <nav aria-label="Admin quick links" className="mt-3 flex flex-wrap gap-3">
          <Link href="/admin/modules" className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Modules</Link>
          <Link href="/instructor" className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Classes</Link>
          <Link href="/admin/api-keys" className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">API keys</Link>
        </nav>
      </div>
      <Suspense fallback={<p>Loading classes…</p>}>
        <AllClasses />
      </Suspense>
    </main>
  );
}

type ClassRow = {
  id: string;
  name: string;
  cohorts: { name: string; school: string; program: string } | null;
  profiles: { full_name: string } | null;
};
type AssignmentRow = { class_id: string; module_id: string; position: number; modules: { title: string } | null };

async function AllClasses() {
  await connection();
  // The layout already restricts /admin to admins; RLS lets admins read every row.
  const supabase = await createClient();
  const [classResult, studentResult, assignmentResult, assessmentResult, submissionResult, resultResult] = await Promise.all([
    supabase.from("classes").select("id, name, cohorts(name, school, program), profiles(full_name)").order("name"),
    supabase.from("students").select("id, class_id"),
    supabase.from("assignments").select("class_id, module_id, position, modules(title)").order("position"),
    supabase.from("assessments").select("id, module_id, kind"),
    supabase.from("submissions").select("student_id, activity_id, submitted_at"),
    supabase.from("assessment_results").select("student_id, assessment_id, score, taken_at"),
  ]);
  const classes = (classResult.data ?? []) as unknown as ClassRow[];
  const students = (studentResult.data ?? []) as { id: string; class_id: string }[];
  const assignments = (assignmentResult.data ?? []) as unknown as AssignmentRow[];
  const assessments = (assessmentResult.data ?? []) as { id: string; module_id: string; kind: "pre" | "post" }[];
  const submissions = (submissionResult.data ?? []) as ProgressSubmission[];
  const results = (resultResult.data ?? []) as { student_id: string; assessment_id: string; score: number; taken_at: string }[];

  const moduleIds = [...new Set(assignments.map((row) => row.module_id))];
  const { data: activityData } = moduleIds.length
    ? await supabase.from("activities").select("id, required, lessons!inner(module_id)").in("lessons.module_id", moduleIds)
    : { data: [] };
  const activities = (activityData ?? []) as unknown as { id: string; required: boolean; lessons: { module_id: string } }[];

  // Same shapes the class dashboard builds, so the numbers match it exactly.
  const progressAssessments: ProgressAssessment[] = results.flatMap((result) => {
    const assessment = assessments.find((row) => row.id === result.assessment_id);
    return assessment ? [{ student_id: result.student_id, module_id: assessment.module_id, kind: assessment.kind, score: Number(result.score), taken_at: result.taken_at }] : [];
  });

  const rows = classes.map((classRow) => {
    const classStudents = students.filter((student) => student.class_id === classRow.id);
    const modules: ProgressModule[] = assignments
      .filter((row) => row.class_id === classRow.id && row.modules)
      .map((row) => ({
        id: row.module_id,
        title: row.modules!.title,
        requiredActivityIds: activities.filter((activity) => activity.required && activity.lessons.module_id === row.module_id).map((activity) => activity.id),
      }));
    const gains = classStudents
      .map((student) => getStudentProgress(modules, submissions, progressAssessments, student.id).gain)
      .filter((gain): gain is number => gain !== null);
    return {
      ...classRow,
      studentCount: classStudents.length,
      completion: getOverallCompletionPct(modules, classStudents, submissions, progressAssessments),
      gains,
    };
  });

  const allGains = rows.flatMap((row) => row.gains);

  return (
    <>
      <section aria-label="Program summary" className="grid gap-3 sm:grid-cols-3">
        <Summary label="Total students" value={String(students.length)} />
        <Summary label="Total classes" value={String(classes.length)} />
        <Summary label="Average learning gain" value={formatGain(average(allGains))} />
      </section>

      <section aria-labelledby="all-classes-heading" className="space-y-3">
        <div>
          <h2 id="all-classes-heading" className="text-xl font-semibold">All classes</h2>
          <p className="text-sm text-muted-foreground">Learning gain is post-test minus pretest, in percentage points, averaged over students with both tests.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table aria-label="Classes across all cohorts" className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Class", "Instructor", "Cohort", "School", "Program", "Students", "Completion", "Avg gain", "Both tests", "Setup"].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="px-4 py-3">
                    <Link href={`/instructor/classes/${row.id}`} className={linkClass}>{row.name}</Link>
                  </th>
                  <td className="px-4 py-3">{row.profiles?.full_name ?? "—"}</td>
                  <td className="px-4 py-3">{row.cohorts?.name ?? "—"}</td>
                  <td className="px-4 py-3">{row.cohorts?.school ?? "—"}</td>
                  <td className="px-4 py-3">{row.cohorts?.program ?? "—"}</td>
                  <td className="px-4 py-3">{row.studentCount}</td>
                  <td className="px-4 py-3">{row.completion}%</td>
                  <td className="px-4 py-3">{formatGain(average(row.gains))}</td>
                  <td className="px-4 py-3">{row.gains.length}</td>
                  <td className="px-4 py-3">
                    <Link href={`/instructor/classes/${row.id}/manage`} className={linkClass} aria-label={`Manage ${row.name}`}>Manage</Link>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No classes yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function formatGain(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded} pp`;
}
function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>;
}
