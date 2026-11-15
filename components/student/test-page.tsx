import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import { TestForm } from "@/components/student/test-form";
import { requireStudent } from "@/lib/auth/student-session";
import { loadPublicQuestions, testState } from "@/lib/student/assessment";
import { findModule, loadStudentProgress, nextStepHref } from "@/lib/student/progress";

const LABEL = { pre: "Pretest", post: "Post-test" } as const;

/**
 * Body of /learn/[moduleId]/pretest and /posttest. Request-time only; the
 * page wraps it in <Suspense>. Questions are loaded with the service role
 * and sent to the browser without their answers.
 */
export async function TestView({
  params,
  kind,
}: {
  params: Promise<{ moduleId: string }>;
  kind: "pre" | "post";
}) {
  await connection();
  const { moduleId } = await params;
  if (!z.uuid().safeParse(moduleId).success) notFound();

  const { studentId } = await requireStudent();
  const progress = await loadStudentProgress(studentId);
  const mod = findModule(progress, moduleId);
  if (!mod) notFound();

  const state = testState(mod, kind);
  const heading = (
    <>
      <p className="text-sm text-muted-foreground">{mod.title}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{LABEL[kind]}</h1>
    </>
  );

  if (state.state === "open") {
    const questions = await loadPublicQuestions(state.assessmentId);
    return (
      <>
        {heading}
        <p className="mt-2 text-muted-foreground">
          {questions.length} questions.{" "}
          {kind === "pre"
            ? "This shows what you already know, so it's fine to guess."
            : "Show what you learned!"}{" "}
          You can take it once, so check your answers before you submit.
        </p>
        <TestForm moduleId={mod.moduleId} kind={kind} questions={questions} />
      </>
    );
  }

  const message =
    state.state === "taken"
      ? `You already took this test${state.score !== null ? ` and scored ${state.score}%` : ""}. Each test can be taken once.`
      : state.state === "locked"
        ? `This test is locked. ${state.reason}`
        : "This module doesn't have this test yet. Ask your teacher.";
  const href = state.state === "taken" ? nextStepHref(mod) : "/learn";

  return (
    <>
      {heading}
      <p className="mt-4 rounded-lg border border-border bg-muted px-4 py-3">{message}</p>
      <Link href={href} className={buttonVariants({ className: "mt-6 h-12 w-full px-6 text-base sm:w-auto" })}>
        {href === "/learn" ? "Back to my modules" : "Continue"}
      </Link>
    </>
  );
}

export function TestFallback({ kind }: { kind: "pre" | "post" }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{LABEL[kind]}</h1>
      <p className="mt-2 text-muted-foreground">Loading questions…</p>
    </>
  );
}
