import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { editorContent, editorTestQuestions, type ModulePayload } from "@/lib/content-schema";
import { ModuleEditor } from "./module-editor";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default function EditModulePage(props: Props) {
  return (
    <Suspense fallback={<main id="main" className="mx-auto max-w-5xl p-6">Loading module…</main>}>
      <Editor {...props} />
    </Suspense>
  );
}

async function Editor({ params, searchParams }: Props) {
  await connection();
  await requireRole(["admin"]);
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!z.guid().safeParse(id).success) notFound();
  const supabase = await createClient();

  const [{ data: mod }, { data: lessons }, { data: tests }] = await Promise.all([
    supabase.from("modules").select("id, title, description, concept_tags, status").eq("id", id).maybeSingle(),
    supabase.from("lessons").select("id, title, position").eq("module_id", id).order("position"),
    supabase.from("assessments").select("id, kind, questions").eq("module_id", id),
  ]);
  if (!mod) notFound();

  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: activities } = lessonIds.length
    ? await supabase
        .from("activities")
        .select("id, lesson_id, type, title, content, position")
        .in("lesson_id", lessonIds)
        .order("position")
    : { data: [] };
  // One lesson per module in this editor; if there were more, keep lesson order.
  const lessonPos = new Map((lessons ?? []).map((l) => [l.id, l.position]));
  const acts = [...(activities ?? [])].sort(
    (a, b) => (lessonPos.get(a.lesson_id) ?? 0) - (lessonPos.get(b.lesson_id) ?? 0) || a.position - b.position,
  );

  const pre = (tests ?? []).find((t) => t.kind === "pre");
  const post = (tests ?? []).find((t) => t.kind === "post");

  // CNT-9: which questions/activities already have student results.
  const [preCount, postCount, ...actCounts] = await Promise.all([
    pre ? countResults(supabase, "assessment_results", "assessment_id", pre.id) : 0,
    post ? countResults(supabase, "assessment_results", "assessment_id", post.id) : 0,
    ...acts.map((a) => countResults(supabase, "submissions", "activity_id", a.id)),
  ]);

  const initial: ModulePayload = {
    title: mod.title,
    description: mod.description ?? "",
    conceptTags: (mod.concept_tags as string[]).join(", "),
    pretest: editorTestQuestions(pre?.questions),
    posttest: editorTestQuestions(post?.questions),
    activities: acts.map((a) => ({ id: a.id, title: a.title, content: editorContent(a.type, a.content) })),
  };
  const locked = {
    pretest: preCount > 0 ? initial.pretest.map((q) => q.id) : [],
    posttest: postCount > 0 ? initial.posttest.map((q) => q.id) : [],
    activities: acts.filter((_, i) => actCounts[i] > 0).map((a) => a.id),
  };

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 pb-28">
      <p>
        <Link
          href="/admin/modules"
          className="rounded-sm text-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          ← All modules
        </Link>
      </p>
      <ModuleEditor
        moduleId={mod.id}
        initial={initial}
        initialStatus={mod.status === "published" ? "published" : "draft"}
        locked={locked}
        created={created === "1"}
        lessonTitle={lessons?.[0]?.title ?? "Lesson"}
      />
    </main>
  );
}

async function countResults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "assessment_results" | "submissions",
  column: string,
  value: string,
) {
  const { count } = await supabase
    .from(table)
    .select(table === "submissions" ? "id" : "student_id", { count: "exact", head: true })
    .eq(column, value);
  return count ?? 0;
}
