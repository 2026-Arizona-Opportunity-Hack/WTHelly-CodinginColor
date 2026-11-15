import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ActivityPlayer, type PlayerActivityContent, type PlayerWorksheetQuestion } from "@/components/activities/activity-player";
import { requireStudent } from "@/lib/auth/student-session";
import { isActivityUnlocked } from "@/lib/rules";
import { findModule, loadStudentProgress } from "@/lib/student/progress";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ moduleId: string; activityId: string }>;

export default function ActivityPage({ params }: { params: Params }) {
  return <main id="main" className="w-full flex-1 bg-[#f3e6d4] px-4 py-8"><Suspense fallback={<p className="mx-auto max-w-4xl text-[#5d2028]">Loading activity…</p>}><ActivityContent params={params} /></Suspense></main>;
}

async function ActivityContent({ params }: { params: Params }) {
  const { moduleId, activityId } = await params;
  const { studentId } = await requireStudent();
  const progress = await loadStudentProgress(studentId);
  const mod = findModule(progress, moduleId);
  if (!mod || !mod.activities.some((activity) => activity.id === activityId)) notFound();
  if (!isActivityUnlocked(mod, mod.unlocked, activityId)) redirect("/learn");

  const { data, error } = await createAdminClient().from("activities").select("id, type, title, content").eq("id", activityId).single();
  if (error || !data) throw new Error("Could not load activity.");
  const content = studentContent(data.type, data.content);
  if (!content) throw new Error("Activity content is unavailable.");
  const index = mod.activities.findIndex((activity) => activity.id === activityId);
  const backHref = index > 0 ? `/learn/${moduleId}/${mod.activities[index - 1].id}` : undefined;
  return <ActivityPlayer moduleTitle={mod.title} activities={[{ id: data.id, title: data.title, content }]} position={index + 1} total={mod.activities.length} backHref={backHref} />;
}

// Construct a public shape explicitly; activity rows also contain answer keys.
function studentContent(type: string, value: unknown): PlayerActivityContent | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (type === "video" && typeof data.url === "string") return { type, url: data.url, ...(typeof data.notes === "string" ? { notes: data.notes } : {}) };
  if (type === "check" && typeof data.prompt === "string") return { type, prompt: data.prompt, ...(strings(data.options) ? { options: strings(data.options)! } : {}) };
  if (type === "exit" && typeof data.prompt === "string" && (data.kind === "mcq" || data.kind === "short")) return { type, prompt: data.prompt, kind: data.kind, ...(strings(data.options) ? { options: strings(data.options)! } : {}) };
  if (type === "code" && typeof data.prompt === "string") return { type, prompt: data.prompt, ...(typeof data.starter === "string" ? { starterCode: data.starter } : {}) };
  if (type === "worksheet" && Array.isArray(data.questions)) {
    const questions: PlayerWorksheetQuestion[] = [];
    for (const raw of data.questions) {
      if (!raw || typeof raw !== "object") return null;
      const q = raw as Record<string, unknown>;
      if (typeof q.id !== "string" || typeof q.prompt !== "string") return null;
      if (q.kind === "mcq") {
        const options = strings(q.options);
        if (!options?.length) return null;
        questions.push({ id: q.id, kind: "mcq", prompt: q.prompt, options });
      } else if (q.kind === "short" || q.kind === "long" || q.kind === "code") questions.push({ id: q.id, kind: q.kind, prompt: q.prompt });
      else return null;
    }
    return { type, questions };
  }
  return null;
}

function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}
