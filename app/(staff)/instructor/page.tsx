import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listInstructors } from "@/lib/class-setup/access";
import { NewClassForm, type CohortOption } from "./new-class-form";

const linkClass =
  "rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export default function InstructorPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
      <Suspense fallback={<p>Loading classes…</p>}>
        <Classes />
      </Suspense>
    </main>
  );
}

async function Classes() {
  await connection();
  const { user, profile } = await requireRole(["instructor", "admin"]);
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  // RLS already limits instructors to their own classes; the filter makes it explicit.
  let classQuery = supabase
    .from("classes")
    .select("id, name, join_code, cohorts(name)")
    .order("created_at", { ascending: false });
  if (!isAdmin) classQuery = classQuery.eq("instructor_id", user.id);

  const [{ data: classes }, { data: cohorts }, instructors] = await Promise.all([
    classQuery,
    supabase.from("cohorts").select("id, name").order("name"),
    isAdmin ? listInstructors(supabase) : undefined,
  ]);
  const classRows = (classes ?? []) as unknown as {
    id: string;
    name: string;
    join_code: string;
    cohorts: { name: string } | null;
  }[];

  const counts = new Map<string, number>();
  if (classRows.length) {
    const { data: students } = await supabase
      .from("students")
      .select("class_id")
      .in("class_id", classRows.map((c) => c.id));
    for (const s of students ?? []) counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1);
  }

  const cohortOptions: CohortOption[] = (cohorts ?? []).map((c) => ({
    id: c.id,
    label: c.name,
  }));

  return (
    <>
      {/* Admins see every class, not just ones they teach. */}
      <h1 className="text-3xl font-bold tracking-tight">{isAdmin ? "Classes" : "My classes"}</h1>
      <section aria-labelledby="classes-heading" className="space-y-3">
        <h2 id="classes-heading" className="text-xl font-semibold">
          {isAdmin ? "All classes" : "Your classes"}
        </h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Class", "Cohort", "Students", "Class code", "Setup"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {classRows.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="px-4 py-3">
                    <Link href={`/instructor/classes/${c.id}`} className={linkClass}>
                      {c.name}
                    </Link>
                  </th>
                  <td className="px-4 py-3">{c.cohorts?.name ?? "—"}</td>
                  <td className="px-4 py-3">{counts.get(c.id) ?? 0}</td>
                  <td className="px-4 py-3 font-mono text-base tracking-widest">{c.join_code}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/instructor/classes/${c.id}/manage`}
                      className={linkClass}
                      aria-label={`Manage ${c.name}`}
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {!classRows.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No classes yet. Create your first one below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="new-class-heading" className="space-y-3 rounded-xl border p-4">
        <div>
          <h2 id="new-class-heading" className="text-xl font-semibold">
            New class
          </h2>
          <p className="text-sm text-muted-foreground">
            You&apos;ll get a 6-character class code, then set up the roster and modules.
          </p>
        </div>
        <NewClassForm cohorts={cohortOptions} instructors={instructors} selfId={user.id} />
      </section>
    </>
  );
}
