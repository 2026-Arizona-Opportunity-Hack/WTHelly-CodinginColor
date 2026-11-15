import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "No access · Coding in Color" };

// Shown (with HTTP 403 from proxy.ts) when a signed-in user opens a staff page
// their role doesn't allow, or has no staff profile at all.
export default function NoAccessPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
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
          className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Go to my class
        </Link>
        <SignOutButton />
      </div>
    </main>
  );
}
