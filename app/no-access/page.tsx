import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "No access · Coding in Color" };

// Shown (with HTTP 403 from proxy.ts) when a signed-in user opens a staff page
// their role doesn't allow, or has no staff profile at all.
export default function NoAccessPage() {
  return (
    <main id="main" className="mx-auto my-auto flex w-[calc(100%_-_2rem)] max-w-md flex-none flex-col justify-center gap-6 rounded-3xl border border-border bg-card px-5 py-10 shadow-lg sm:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">You don&apos;t have access to this page</h1>
        <p className="mt-2 text-muted-foreground">
          Your account isn&apos;t set up for this part of the site. If you&apos;re a
          student, go to your class. If you&apos;re staff, ask a Coding in Color admin to
          invite you or change your role.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/learn"
          className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          Go to my class
        </Link>
        <SignOutButton />
      </div>
    </main>
  );
}
