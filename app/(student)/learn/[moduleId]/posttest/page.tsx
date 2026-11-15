import type { Metadata } from "next";
import { Suspense } from "react";
import { TestFallback, TestView } from "@/components/student/test-page";

export const metadata: Metadata = { title: "Post-test · Coding in Color" };

/** ASM-2 / ASM-3: the module's post-test, taken once and scored on the server. */
export default function PosttestPage({ params }: PageProps<"/learn/[moduleId]/posttest">) {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Suspense fallback={<TestFallback kind="post" />}>
        <TestView params={params} kind="post" />
      </Suspense>
    </main>
  );
}
