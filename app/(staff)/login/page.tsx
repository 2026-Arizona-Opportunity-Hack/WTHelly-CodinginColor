import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LinkError } from "./link-error";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in · Coding in Color" };

export default function LoginPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Staff sign in</h1>
        <p className="mt-2 text-muted-foreground">
          Instructors, admins and reviewers: enter your email and we&apos;ll send you a
          sign-in link. Students,{" "}
          <Link
            href="/join"
            className="underline underline-offset-4 outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring"
          >
            join your class here
          </Link>
          .
        </p>
      </div>
      {/* Reads the URL's search params, so it streams in behind Suspense. */}
      <Suspense fallback={null}>
        <LinkError />
      </Suspense>
      <LoginForm />
    </main>
  );
}
