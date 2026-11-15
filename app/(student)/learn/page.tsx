import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { CircleCheck, CircleDot, Circle, Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/lib/auth/student-session";
import { mustDo, type ModuleStatus } from "@/lib/rules";
import { loadStudentProgress, nextStepHref, type StudentModule } from "@/lib/student/progress";

export const metadata: Metadata = { title: "My modules · Coding in Color" };

/** STU-1 / STU-2 / STU-5: assigned modules with status, and one Continue button. */
export default function LearnPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Suspense fallback={<h1 className="text-2xl font-semibold tracking-tight">My modules</h1>}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Loading your modules…</p>}>
        <Modules />
      </Suspense>
    </main>
  );
}

async function Greeting() {
  await connection();
  const { displayName, className } = await requireStudent();
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Hi, {displayName}</h1>
      {className && <p className="mt-2 text-muted-foreground">Class: {className}</p>}
    </>
  );
}

async function Modules() {
  await connection();
  const { studentId } = await requireStudent();
  const { modules, currentIndex } = await loadStudentProgress(studentId);

  if (modules.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-border bg-muted px-4 py-3">
        Your teacher hasn&apos;t assigned any modules yet. Check back soon!
      </p>
    );
  }

  const current = currentIndex === -1 ? null : modules[currentIndex];

  return (
    <>
      <section aria-labelledby="up-next" className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 id="up-next" className="text-sm font-medium text-muted-foreground">
          {current ? "Up next" : "All done"}
        </h2>
        {current ? (
          <>
            <p className="mt-1 text-xl font-semibold break-words">{current.title}</p>
            <p className="mt-1 text-muted-foreground">{stepLabel(current)}</p>
            <Link
              href={nextStepHref(current)}
              className={buttonVariants({ className: "mt-5 h-12 w-full px-8 text-base sm:w-auto" })}
            >
              Continue<span className="sr-only">: {current.title}</span>
            </Link>
          </>
        ) : (
          <p className="mt-1 text-lg">You finished every module. Great work!</p>
        )}
      </section>

      <h2 className="mt-10 text-lg font-semibold">My modules</h2>
      <ol className="mt-4 flex flex-col gap-3">
        {modules.map((m) => (
          <ModuleRow key={m.moduleId} m={m} />
        ))}
      </ol>
    </>
  );
}

function ModuleRow({ m }: { m: StudentModule }) {
  const required = m.activities.filter(mustDo);
  const done = required.filter((a) => m.submitted.has(a.id)).length;
  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Module {m.index + 1}</p>
          <h3 className="font-semibold break-words">{m.title}</h3>
        </div>
        <StatusBadge status={m.status} />
      </div>
      {m.description && <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>}
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-1">
          <dt className="text-muted-foreground">Activities:</dt>
          <dd>
            {done} of {required.length}
          </dd>
        </div>
        {m.pretestScore !== null && (
          <div className="flex gap-1">
            <dt className="text-muted-foreground">Pretest:</dt>
            <dd>{m.pretestScore}%</dd>
          </div>
        )}
        {m.posttestScore !== null && (
          <div className="flex gap-1">
            <dt className="text-muted-foreground">Post-test:</dt>
            <dd>{m.posttestScore}%</dd>
          </div>
        )}
      </dl>
      {m.status === "locked" && (
        <p className="mt-2 text-sm text-muted-foreground">Finish module {m.index} to unlock this one.</p>
      )}
    </li>
  );
}

const STATUS: Record<ModuleStatus, { label: string; Icon: typeof Lock; className: string }> = {
  locked: { label: "Locked", Icon: Lock, className: "text-muted-foreground" },
  available: { label: "Available", Icon: Circle, className: "text-foreground" },
  in_progress: { label: "In progress", Icon: CircleDot, className: "text-foreground" },
  complete: { label: "Complete", Icon: CircleCheck, className: "border-primary text-foreground" },
};

function StatusBadge({ status }: { status: ModuleStatus }) {
  const { label, Icon, className } = STATUS[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-medium ${className}`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </span>
  );
}

function stepLabel(m: StudentModule): string {
  switch (m.next.kind) {
    case "pretest":
      return "Start with the pretest.";
    case "activity": {
      const id = m.next.activityId;
      const title = m.activities.find((a) => a.id === id)?.title;
      return title ? `Next: ${title}` : "Next activity";
    }
    case "posttest":
      return "Take the post-test to finish this module.";
    case "done":
      return "Complete.";
  }
}
