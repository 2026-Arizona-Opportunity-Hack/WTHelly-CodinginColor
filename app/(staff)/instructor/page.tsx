import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ClassManagement, type CohortOption, type InstructorClass } from "@/components/instructor/class-management";

export default function InstructorPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <Suspense fallback={<p role="status">Loading your classes…</p>}>
        <InstructorClasses />
      </Suspense>
    </main>
  );
}

async function InstructorClasses() {
  await connection();
  const { user } = await requireRole(["instructor", "admin"]);
  const supabase = await createClient();
  const [classesResult, cohortsResult] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, join_code, cohort_id, cohorts(id, name, school, program, term)")
      .eq("instructor_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("cohorts").select("id, name, school, program, term").order("name"),
  ]);

  if (classesResult.error || cohortsResult.error) {
    return (
      <section role="alert" className="rounded-xl border border-[#d8aaa0] bg-[#fff4ef] p-5 text-[#792d35]">
        We could not load your classes. Refresh the page to try again.
      </section>
    );
  }

  const cohorts: CohortOption[] = (cohortsResult.data ?? []).map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    school: cohort.school,
    program: cohort.program,
    term: cohort.term,
  }));
  const classes: InstructorClass[] = (classesResult.data ?? []).map((row) => {
    const relation = row.cohorts as CohortOption | CohortOption[] | null;
    return {
      id: row.id,
      name: row.name,
      joinCode: row.join_code,
      cohortId: row.cohort_id,
      cohort: Array.isArray(relation) ? (relation[0] ?? null) : relation,
    };
  });

  return <ClassManagement initialClasses={classes} cohorts={cohorts} />;
}
