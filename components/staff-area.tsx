import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { SignOutButton } from "@/components/sign-out-button";
import { requireRole, type StaffProfile } from "@/lib/auth/session";
import type { StaffRole } from "@/lib/auth/roles";

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Admin",
  instructor: "Instructor",
  reviewer: "Reviewer",
};

const linkClass =
  "rounded-xl px-3 py-2 text-sm font-semibold text-primary outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring";

/**
 * Wraps a staff area (AUTH-5). Checks the role on the server before rendering
 * anything inside, then shows the staff header. The check reads cookies, so
 * it sits behind <Suspense> (cacheComponents).
 */
export function StaffArea({
  allow,
  children,
}: {
  allow: readonly StaffRole[];
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<HeaderShell />}>
      <GatedArea allow={allow}>{children}</GatedArea>
    </Suspense>
  );
}

async function GatedArea({
  allow,
  children,
}: {
  allow: readonly StaffRole[];
  children: ReactNode;
}) {
  // Mark this subtree as request-time before Supabase runs: its auth code reads
  // Date.now(), which Next 16 refuses during prerendering.
  await connection();
  const { user, profile } = await requireRole(allow);
  return (
    <>
      <StaffHeader profile={profile} email={user.email ?? ""} />
      {children}
    </>
  );
}

function StaffHeader({ profile, email }: { profile: StaffProfile; email: string }) {
  const isAdmin = profile.role === "admin";
  return (
    <HeaderShell>
      <nav aria-label="Staff" className="flex flex-wrap items-center gap-1">
        {(isAdmin || profile.role === "instructor") && (
          <Link href="/instructor" className={linkClass}>
            {isAdmin ? "Classes" : "My classes"}
          </Link>
        )}
        {isAdmin && (
          <Link href="/admin" className={linkClass}>
            Admin
          </Link>
        )}
        {isAdmin && (
          <Link href="/admin/modules" className={linkClass}>
            Modules
          </Link>
        )}
        {(isAdmin || profile.role === "reviewer") && (
          <Link href="/review" className={linkClass}>
            Review
          </Link>
        )}
      </nav>
      <div className="flex items-center gap-3">
        <p className="hidden text-right text-sm sm:block">
          <span className="font-medium">{profile.full_name || email}</span>
          <span className="block text-xs text-muted-foreground">{ROLE_LABEL[profile.role]}</span>
        </p>
        <SignOutButton />
      </div>
    </HeaderShell>
  );
}

function HeaderShell({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2">
        <Link
          href="/"
          className="rounded-xl font-heading text-lg font-semibold tracking-tight text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          Coding in Color
        </Link>
        {children}
      </div>
    </header>
  );
}
