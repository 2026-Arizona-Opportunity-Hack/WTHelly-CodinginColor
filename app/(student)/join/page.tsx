import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join your class · Coding in Color" };

type Props = { searchParams: Promise<{ code?: string | string[] }> };

export default function JoinPage({ searchParams }: Props) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-10">
      {/* searchParams is request-time data, so under cacheComponents it's read inside <Suspense>. */}
      <Suspense fallback={<h1 className="text-2xl font-semibold tracking-tight">Join your class</h1>}>
        <JoinFormWithCode searchParams={searchParams} />
      </Suspense>
      <p className="text-sm text-muted-foreground">
        Staff?{" "}
        <Link
          href="/login"
          className="underline underline-offset-4 outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring"
        >
          Sign in here
        </Link>
        .
      </p>
    </main>
  );
}

/** CLS-5: a join link (/join?code=ABC123) pre-fills the class code. */
async function JoinFormWithCode({ searchParams }: Props) {
  const { code } = await searchParams;
  const raw = typeof code === "string" ? code : "";
  const initialCode = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  // Keyed by the code so a different join link always starts a fresh form.
  return <JoinForm key={initialCode} initialCode={initialCode} />;
}
