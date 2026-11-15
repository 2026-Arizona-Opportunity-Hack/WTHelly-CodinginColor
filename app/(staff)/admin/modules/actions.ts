"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  defaultTemplate,
  issueLabel,
  modulePayloadSchema,
  normalizePayload,
  parseTags,
  publishProblems,
  storedContent,
} from "@/lib/content-schema";

// Every action: check the caller is an admin, then write with the user's own
// Supabase client so RLS (modules_admin, activities_admin, ...) applies too.

export type SaveResult = {
  ok: boolean;
  message: string;
  problems?: string[];
  status?: "draft" | "published";
};

const FAILED: SaveResult = { ok: false, message: "Something went wrong. Try again in a moment." };
const NO_ACCESS: SaveResult = { ok: false, message: "Only admins can edit modules." };

async function getAdminWriter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return null;
  return { supabase, user };
}

const refresh = () => {
  revalidatePath("/admin/modules", "layout");
  revalidatePath("/learn", "layout");
};

/** CNT-3: create a draft module from the default template and open it. */
export async function createModule(): Promise<void> {
  const admin = await getAdminWriter();
  if (!admin) redirect("/no-access");
  const { supabase, user } = admin;
  const template = defaultTemplate();

  const { data: mod, error } = await supabase
    .from("modules")
    .insert({ title: "Untitled module", description: "", status: "draft", created_by: user.id })
    .select("id")
    .single();
  if (error || !mod) {
    console.error("createModule failed", error?.code);
    redirect("/admin/modules?error=create");
  }

  const cleanup = async (step: string, code?: string) => {
    console.error(`createModule: ${step} failed`, code);
    // A brand-new module has no student work, so removing it is safe.
    await supabase.from("modules").delete().eq("id", mod.id);
    redirect("/admin/modules?error=create");
  };

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .insert({ module_id: mod.id, title: "Lesson 1", position: 1 })
    .select("id")
    .single();
  if (lessonError || !lesson) return cleanup("lesson", lessonError?.code);

  const [{ error: actError }, { error: testError }] = await Promise.all([
    supabase.from("activities").insert(
      template.activities.map((a, i) => ({
        lesson_id: lesson.id,
        type: a.type,
        title: a.title,
        content: a.content,
        position: i + 1,
      })),
    ),
    supabase.from("assessments").insert([
      { module_id: mod.id, kind: "pre", questions: template.pretest },
      { module_id: mod.id, kind: "post", questions: template.posttest },
    ]),
  ]);
  if (actError || testError) return cleanup("content", (actError ?? testError)?.code);

  refresh();
  redirect(`/admin/modules/${mod.id}?created=1`);
}

const intentSchema = z.enum(["save", "publish", "unpublish"]);

/**
 * Save the whole module form. "publish" / "unpublish" also change the status.
 * A published module (or one being published) must pass publishProblems().
 * CNT-9: rows are updated in place; questions with student results can't be removed.
 */
export async function saveModule(moduleId: unknown, payload: unknown, intent: unknown): Promise<SaveResult> {
  const id = z.guid().safeParse(moduleId);
  const how = intentSchema.safeParse(intent);
  if (!id.success || !how.success) return FAILED;

  const parsed = modulePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const problems = [...new Set(parsed.error.issues.map((i) => `${issueLabel(i.path)}: ${i.message}`))].slice(0, 10);
    return { ok: false, message: "Some fields need fixing before this can be saved.", problems };
  }
  const p = normalizePayload(parsed.data);
  const tagResult = parseTags(p.conceptTags);
  if ("error" in tagResult) return { ok: false, message: "Some fields need fixing.", problems: [`Details: ${tagResult.error}`] };
  const tags = tagResult.tags;

  const admin = await getAdminWriter();
  if (!admin) return NO_ACCESS;
  const { supabase } = admin;

  // Load what's stored, through RLS.
  const [{ data: mod }, { data: lessons }, { data: tests }] = await Promise.all([
    supabase.from("modules").select("id, status").eq("id", id.data).maybeSingle(),
    supabase.from("lessons").select("id").eq("module_id", id.data),
    supabase.from("assessments").select("id, kind, questions").eq("module_id", id.data),
  ]);
  if (!mod) return { ok: false, message: "That module doesn't exist anymore." };
  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: stored } = lessonIds.length
    ? await supabase.from("activities").select("id, type, content").in("lesson_id", lessonIds)
    : { data: [] as { id: string; type: string; content: unknown }[] };
  const storedActs = stored ?? [];

  // Activities can be reordered and edited, never added or removed here.
  const payloadIds = new Set(p.activities.map((a) => a.id));
  if (payloadIds.size !== storedActs.length || storedActs.some((a) => !payloadIds.has(a.id))) {
    return { ok: false, message: "This module changed in another tab. Reload the page and try again." };
  }
  for (const a of p.activities) {
    if (storedActs.find((s) => s.id === a.id)?.type !== a.content.type) return FAILED;
  }

  const targetStatus = how.data === "publish" ? "published" : how.data === "unpublish" ? "draft" : (mod.status as "draft" | "published");
  if (targetStatus === "published") {
    const problems = publishProblems(p, tags);
    if (problems.length) {
      return {
        ok: false,
        message:
          how.data === "publish"
            ? "This module can't be published yet. Fix these and try again:"
            : "This module is published, so it must stay complete. Fix these or unpublish it first:",
        problems,
      };
    }
  }

  // CNT-9: refuse to remove questions that students have already answered.
  const problems: string[] = [];
  const pre = (tests ?? []).find((t) => t.kind === "pre");
  const post = (tests ?? []).find((t) => t.kind === "post");
  for (const [label, row, next] of [
    ["Pretest", pre, p.pretest],
    ["Post-test", post, p.posttest],
  ] as const) {
    if (!row) continue;
    const { count } = await supabase
      .from("assessment_results")
      .select("student_id", { count: "exact", head: true })
      .eq("assessment_id", row.id);
    if (count) problems.push(...removedQuestions(label, row.questions, next.map((q) => q.id)));
  }
  for (const [i, a] of p.activities.entries()) {
    if (a.content.type !== "worksheet") continue;
    const { count } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("activity_id", a.id);
    const old = (storedActs.find((s) => s.id === a.id)?.content as { questions?: unknown } | null)?.questions;
    if (count) problems.push(...removedQuestions(`Activity ${i + 1}`, old, a.content.questions.map((q) => q.id)));
  }
  if (problems.length) {
    return { ok: false, message: "Students already have results for these, so they can't be removed:", problems };
  }

  // Write everything in place; status last so a module is never published half-saved.
  const writes = await Promise.all([
    upsertTest(supabase, id.data, "pre", pre?.id, p.pretest),
    upsertTest(supabase, id.data, "post", post?.id, p.posttest),
    ...p.activities.map((a, i) => {
      const update: Record<string, unknown> = { title: a.title, position: i + 1 };
      if (a.content.type !== "code") update.content = storedContent(a.content);
      return supabase.from("activities").update(update).eq("id", a.id);
    }),
  ]);
  if (writes.some((w) => w.error)) {
    console.error("saveModule: content write failed", writes.find((w) => w.error)?.error?.code);
    return FAILED;
  }
  const { error: modError } = await supabase
    .from("modules")
    .update({
      title: p.title || "Untitled module",
      description: p.description,
      concept_tags: tags,
      status: targetStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id.data);
  if (modError) {
    console.error("saveModule: module write failed", modError.code);
    return FAILED;
  }

  refresh();
  const message =
    how.data === "publish"
      ? "Published. Students in assigned classes can see it now."
      : how.data === "unpublish"
        ? "Unpublished. It's a draft again and hidden from students."
        : "Saved.";
  return { ok: true, message, status: targetStatus };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

function upsertTest(
  supabase: Supabase,
  moduleId: string,
  kind: "pre" | "post",
  rowId: string | undefined,
  questions: unknown,
) {
  return rowId
    ? supabase.from("assessments").update({ questions }).eq("id", rowId)
    : supabase.from("assessments").insert({ module_id: moduleId, kind, questions });
}

/** Messages for stored questions whose ids are missing from the new list. */
function removedQuestions(label: string, oldQuestions: unknown, keptIds: string[]): string[] {
  if (!Array.isArray(oldQuestions)) return [];
  const kept = new Set(keptIds);
  return oldQuestions
    .filter((q) => typeof q?.id === "string" && !kept.has(q.id))
    .map((q) => {
      const prompt = typeof q.prompt === "string" && q.prompt ? `“${q.prompt.slice(0, 60)}”` : "a question";
      return `${label}: ${prompt}. Undo the removal (reload the page) to keep it.`;
    });
}
