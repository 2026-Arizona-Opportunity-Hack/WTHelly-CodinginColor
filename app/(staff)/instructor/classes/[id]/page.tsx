import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getModuleCompletionPct, getOverallCompletionPct, getStudentProgress, type ProgressAssessment, type ProgressModule, type ProgressSubmission } from "@/lib/class-progress";

type Params = { params: Promise<{ id: string }> };

export default function ClassDashboardPage({ params }: Params) {
  return <Suspense fallback={<main className="mx-auto max-w-6xl p-6">Loading class…</main>}><Dashboard params={params} /></Suspense>;
}

async function Dashboard({ params }: Params) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const { data: classRow } = await supabase
    .from("classes")
    .select("id, name, join_code, cohorts(name, school, term)")
    .eq("id", id)
    .maybeSingle();
  if (!classRow) notFound();

  const [{ data: students }, { data: assignments }] = await Promise.all([
    supabase.from("students").select("id, display_name, school, joined_at").eq("class_id", id).order("display_name"),
    supabase.from("assignments").select("module_id, position, modules(id, title)").eq("class_id", id).order("position"),
  ]);
  const assigned = (assignments ?? []) as unknown as { module_id: string; position: number; modules: { id: string; title: string } | null }[];
  const moduleIds = assigned.map((row) => row.module_id);
  const studentRows = students ?? [];

  const [activityResult, assessmentResult, submissionResult, resultResult] = moduleIds.length
    ? await Promise.all([
        supabase.from("activities").select("id, lesson_id, required, lessons!inner(module_id)").in("lessons.module_id", moduleIds),
        supabase.from("assessments").select("id, module_id, kind").in("module_id", moduleIds),
        supabase.from("submissions").select("student_id, activity_id, submitted_at").in("student_id", studentRows.map((student) => student.id)),
        supabase.from("assessment_results").select("student_id, assessment_id, score, taken_at").in("student_id", studentRows.map((student) => student.id)),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const activities = (activityResult.data ?? []) as unknown as { id: string; required: boolean; lessons: { module_id: string } }[];
  const assessments = (assessmentResult.data ?? []) as unknown as { id: string; module_id: string; kind: "pre" | "post" }[];
  const submissions = (submissionResult.data ?? []) as unknown as ProgressSubmission[];
  const results = (resultResult.data ?? []) as unknown as { student_id: string; assessment_id: string; score: number; taken_at: string }[];
  const modules: ProgressModule[] = assigned.flatMap((row) => row.modules ? [{
    id: row.module_id,
    title: row.modules.title,
    requiredActivityIds: activities.filter((activity) => activity.required && activity.lessons.module_id === row.module_id).map((activity) => activity.id),
  }] : []);
  const progressAssessments: ProgressAssessment[] = results.flatMap((result) => {
    const assessment = assessments.find((row) => row.id === result.assessment_id);
    return assessment ? [{ student_id: result.student_id, module_id: assessment.module_id, kind: assessment.kind, score: Number(result.score), taken_at: result.taken_at }] : [];
  });
  const roster = studentRows.map((student) => ({
    ...student,
    progress: getStudentProgress(modules, submissions, progressAssessments, student.id),
  }));
  const stuck = roster.filter((student) => student.progress.stuck);
  const notStarted = roster.filter((student) => student.progress.notStarted);
  const cohort = classRow.cohorts as unknown as { name: string; school: string; term: string } | null;
  const completion = getOverallCompletionPct(modules, studentRows, submissions, progressAssessments);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <Link href="/instructor" className="rounded-sm text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">← My classes</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight">{classRow.name}</h1><p className="mt-1 text-sm text-muted-foreground">{cohort ? `${cohort.name} · ${cohort.school} · ${cohort.term}` : "Class progress"}</p></div>
          <p className="rounded-lg border px-4 py-3 text-sm"><span className="text-muted-foreground">Class code</span><br /><strong className="text-lg tracking-widest">{classRow.join_code}</strong></p>
        </div>
      </div>

      <section aria-label="Class summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Students" value={String(roster.length)} />
        <Summary label="Modules assigned" value={String(modules.length)} />
        <Summary label="Overall completion" value={`${completion}%`} />
        <Summary label="Stuck · not started" value={`${stuck.length} · ${notStarted.length}`} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <StudentList title="Stuck" description="Started their current module, with no activity for 3 or more days." students={stuck.map((student) => student.display_name)} empty="No students are currently stuck." />
        <StudentList title="Not started" description="No activity or assessment submissions yet." students={notStarted.map((student) => student.display_name)} empty="Everyone has started." />
      </section>

      <section aria-labelledby="roster-heading" className="space-y-3">
        <div><h2 id="roster-heading" className="text-xl font-semibold">Student progress</h2><p className="text-sm text-muted-foreground">Learning gain is post-test minus pretest, in percentage points.</p></div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Student", "Current module", "Complete", "Pre", "Post", "Gain", "Last active"].map((heading) => <th key={heading} scope="col" className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
            <tbody className="divide-y">
              {roster.map((student) => <tr key={student.id}>
                <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium">{student.display_name}</th>
                <td className="px-4 py-3">{student.progress.currentModule?.title ?? (modules.length ? "All complete" : "No modules assigned")}</td>
                <td className="px-4 py-3">{student.progress.completionPct}%</td>
                <td className="px-4 py-3">{formatScore(student.progress.pre)}</td><td className="px-4 py-3">{formatScore(student.progress.post)}</td>
                <td className="px-4 py-3">{student.progress.gain === null ? "—" : `${student.progress.gain > 0 ? "+" : ""}${student.progress.gain} pp`}</td>
                <td className="whitespace-nowrap px-4 py-3">{student.progress.lastActive ? new Date(student.progress.lastActive).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Not yet"}</td>
              </tr>)}
              {!roster.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No students are enrolled in this class yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="module-summary" className="space-y-3">
        <h2 id="module-summary" className="text-xl font-semibold">Module summary</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {modules.map((module) => {
            const paired = progressAssessments.filter((row) => row.module_id === module.id && row.kind === "pre").flatMap((pre) => {
              const post = progressAssessments.find((row) => row.student_id === pre.student_id && row.module_id === module.id && row.kind === "post");
              return post ? [{ pre: pre.score, post: post.score }] : [];
            });
            const avg = (key: "pre" | "post") => paired.length ? (paired.reduce((sum, row) => sum + row[key], 0) / paired.length).toFixed(1) : "—";
            const avgGain = paired.length ? (paired.reduce((sum, row) => sum + row.post - row.pre, 0) / paired.length).toFixed(1) : "—";
            const moduleCompletion = getModuleCompletionPct(module, studentRows, submissions, progressAssessments);
            return <article key={module.id} className="rounded-xl border p-4"><h3 className="font-semibold">{module.title}</h3><p className="mt-2 text-sm text-muted-foreground">{moduleCompletion}% complete · {paired.length} with both tests</p><dl className="mt-3 grid grid-cols-3 gap-2 text-sm"><Metric label="Avg pre" value={avg("pre")} /><Metric label="Avg post" value={avg("post")} /><Metric label="Avg gain" value={avgGain === "—" ? "—" : `${avgGain} pp`} /></dl></article>;
          })}
          {!modules.length && <p className="rounded-xl border p-4 text-sm text-muted-foreground">No modules are assigned yet.</p>}
        </div>
      </section>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }
function StudentList({ title, description, students, empty }: { title: string; description: string; students: string[]; empty: string }) { return <section className="rounded-xl border p-4" aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}><h2 id={`${title.toLowerCase().replaceAll(" ", "-")}-heading`} className="font-semibold">{title} <span className="text-muted-foreground">({students.length})</span></h2><p className="mt-1 text-sm text-muted-foreground">{description}</p>{students.length ? <ul className="mt-3 flex flex-wrap gap-2">{students.map((name) => <li key={name} className="rounded-full bg-muted px-3 py-1 text-sm">{name}</li>)}</ul> : <p className="mt-3 text-sm">{empty}</p>}</section>; }
function formatScore(score: number | null) { return score === null ? "—" : `${score}%`; }
