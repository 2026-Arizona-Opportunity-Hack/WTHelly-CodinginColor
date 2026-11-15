import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { getManagedClass, listInstructors } from "@/lib/class-setup/access";
import { RosterImport } from "./roster-import";
import { StudentList, type ManagedStudent } from "./student-list";
import { ModuleAssignments, type ModuleOption } from "./module-assignments";
import { JoinLink } from "./join-link";
import { InstructorPicker } from "./instructor-picker";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default function ManageClassPage(props: Props) {
  return (
    <Suspense fallback={<main id="main" className="mx-auto max-w-5xl p-6">Loading class…</main>}>
      <Manage {...props} />
    </Suspense>
  );
}

async function Manage({ params, searchParams }: Props) {
  await connection();
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  // Role check + ownership: instructors their own classes, admins any.
  const access = await getManagedClass(id);
  if (!access) notFound();
  const { supabase, cls, role } = access;

  // Never select("*") on students: pin_hash isn't readable by this client.
  const [{ data: cohortRow }, { data: students }, { data: assignments }, { data: modules }, instructors] =
    await Promise.all([
      supabase.from("classes").select("cohorts(name)").eq("id", id).maybeSingle(),
      supabase
        .from("students")
        .select("id, display_name, school, joined_at, pin_locked_until")
        .eq("class_id", id)
        .order("display_name"),
      supabase.from("assignments").select("module_id, position").eq("class_id", id).order("position"),
      supabase.from("modules").select("id, title").eq("status", "published").order("title"),
      role === "admin" ? listInstructors(supabase) : undefined,
    ]);

  const cohort = cohortRow?.cohorts as unknown as
    | { name: string }
    | null;
  const roster: ManagedStudent[] = (students ?? []).map((s) => ({
    id: s.id,
    display_name: s.display_name,
    school: s.school,
    joined: s.joined_at !== null,
    locked: isLocked(s.pin_locked_until),
  }));
  const published = new Map((modules ?? []).map((m) => [m.id, m.title]));
  const assignedIds = new Set((assignments ?? []).map((a) => a.module_id));
  const assigned: ModuleOption[] = (assignments ?? []).map((a) => ({
    id: a.module_id,
    title: published.get(a.module_id) ?? "Unpublished module",
  }));
  const available: ModuleOption[] = (modules ?? [])
    .filter((m) => !assignedIds.has(m.id))
    .map((m) => ({ id: m.id, title: m.title }));

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
      <div>
        <Link
          href={`/instructor/classes/${id}`}
          className="rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring"
        >
          ← Class dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Manage {cls.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cohort?.name ?? "No cohort"}
        </p>
        {created === "1" && (
          <p role="status" className="mt-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm font-medium">
            Class created with code {cls.join_code}. Next: add students, assign a module, then share the join link.
          </p>
        )}
      </div>

      <Section id="import" title="1. Import a roster">
        <RosterImport classId={id} existingNames={roster.map((s) => s.display_name)} />
      </Section>
      <Section id="students" title={`2. Students (${roster.length})`}>
        <StudentList classId={id} students={roster} />
      </Section>
      <Section id="modules" title="3. Modules">
        <ModuleAssignments classId={id} assigned={assigned} available={available} />
      </Section>
      <Section id="join" title="4. Share the join link">
        <JoinLink code={cls.join_code} />
      </Section>
      {instructors && (
        <Section id="instructor" title="Instructor">
          <InstructorPicker classId={id} currentId={cls.instructor_id} instructors={instructors} />
        </Section>
      )}
    </main>
  );
}

/** Request-time only (this page sits behind connection()). */
function isLocked(until: string | null) {
  return until !== null && new Date(until).getTime() > Date.now();
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-4 rounded-xl border p-4 sm:p-6">
      <h2 id={`${id}-heading`} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
