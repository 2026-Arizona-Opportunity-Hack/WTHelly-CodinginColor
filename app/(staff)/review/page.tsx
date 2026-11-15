import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default function ReviewPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Published modules</h1>
        <p className="mt-1 text-sm text-muted-foreground">Read-only view of the curriculum. Expand a module to see its activities and test questions.</p>
      </div>
      <Suspense fallback={<p>Loading modules…</p>}>
        <Modules />
      </Suspense>
    </main>
  );
}

type ModuleRow = { id: string; title: string; description: string | null; concept_tags: string[] };
type ActivityRow = { id: string; title: string; type: string; position: number; lessons: { module_id: string; position: number } };

const typeLabels: Record<string, string> = { video: "Video", check: "Check", worksheet: "Worksheet", exit: "Exit ticket", code: "Code" };

async function Modules() {
  await connection();
  const supabase = await createClient();
  // RLS: reviewers only see published modules; the filter keeps admins to the same view.
  const { data: moduleData } = await supabase
    .from("modules")
    .select("id, title, description, concept_tags")
    .eq("status", "published")
    .order("title");
  const modules = (moduleData ?? []) as ModuleRow[];
  const moduleIds = modules.map((module) => module.id);

  const [{ data: activityData }, tests] = moduleIds.length
    ? await Promise.all([
        // Never select `content`: it holds worksheet/check answers.
        supabase.from("activities").select("id, title, type, position, lessons!inner(module_id, position)").in("lessons.module_id", moduleIds),
        loadTestPrompts(moduleIds),
      ])
    : [{ data: [] }, new Map<string, { pre: string[]; post: string[] }>()];
  const activities = ((activityData ?? []) as unknown as ActivityRow[]).sort(
    (a, b) => a.lessons.position - b.lessons.position || a.position - b.position,
  );

  if (!modules.length) return <p className="rounded-xl border p-4 text-sm text-muted-foreground">No modules are published yet.</p>;

  return (
    <ul className="space-y-3">
      {modules.map((module) => {
        const moduleActivities = activities.filter((activity) => activity.lessons.module_id === module.id);
        const test = tests.get(module.id) ?? { pre: [], post: [] };
        return (
          <li key={module.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <details>
              <summary className="cursor-pointer list-inside rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-ring">
                <h2 className="inline text-lg font-semibold">{module.title}</h2>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {moduleActivities.length} activities · Pretest {test.pre.length} questions · Post-test {test.post.length} questions
                </span>
                {module.concept_tags.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-2">
                    <span className="sr-only">Concept tags:</span>
                    {module.concept_tags.map((tag) => <span key={tag} className="rounded-full bg-muted px-3 py-0.5 text-xs">{tag}</span>)}
                  </span>
                )}
              </summary>
              <div className="space-y-4 border-t p-4">
                {module.description && <p className="text-sm">{module.description}</p>}
                <section aria-labelledby={`activities-${module.id}`}>
                  <h3 id={`activities-${module.id}`} className="font-semibold">Activities</h3>
                  {moduleActivities.length ? (
                    <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm">
                      {moduleActivities.map((activity) => (
                        <li key={activity.id}>{activity.title} <span className="text-muted-foreground">({typeLabels[activity.type] ?? activity.type})</span></li>
                      ))}
                    </ol>
                  ) : <p className="mt-2 text-sm text-muted-foreground">No activities yet.</p>}
                </section>
                <TestPrompts id={`pre-${module.id}`} title="Pretest" prompts={test.pre} />
                <TestPrompts id={`post-${module.id}`} title="Post-test" prompts={test.post} />
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function TestPrompts({ id, title, prompts }: { id: string; title: string; prompts: string[] }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="font-semibold">{title}</h3>
      {prompts.length ? (
        <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm">{prompts.map((prompt, index) => <li key={index}>{prompt}</li>)}</ol>
      ) : <p className="mt-2 text-sm text-muted-foreground">No questions yet.</p>}
    </section>
  );
}

// RLS hides `assessments` from reviewers because `questions` holds the answers. So, as the
// student player does, read them server-side with the service role, only for modules the
// user's own client already confirmed are published, and keep nothing but the prompts.
async function loadTestPrompts(publishedModuleIds: string[]) {
  const { data } = await createAdminClient()
    .from("assessments")
    .select("module_id, kind, questions")
    .in("module_id", publishedModuleIds);
  const byModule = new Map<string, { pre: string[]; post: string[] }>();
  for (const row of (data ?? []) as { module_id: string; kind: "pre" | "post"; questions: unknown }[]) {
    const entry = byModule.get(row.module_id) ?? { pre: [], post: [] };
    entry[row.kind] = (Array.isArray(row.questions) ? row.questions : []).map((question) =>
      typeof question?.prompt === "string" ? question.prompt : "",
    );
    byModule.set(row.module_id, entry);
  }
  return byModule;
}
