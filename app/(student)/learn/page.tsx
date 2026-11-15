import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireStudent } from "@/lib/auth/student-session";

export const metadata: Metadata = { title: "My modules · Coding in Color" };

export default function LearnPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Suspense fallback={<h1 className="text-2xl font-semibold tracking-tight">My modules</h1>}>
        <Greeting />
      </Suspense>
      <p className="mt-6 text-muted-foreground">
        Your assigned modules and a Continue button will show up here soon.
      </p>
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
