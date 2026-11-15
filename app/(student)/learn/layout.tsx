import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { SwitchStudentButton } from "@/components/sign-out-button";
import { requireStudent } from "@/lib/auth/student-session";

/**
 * Every /learn page: checks on the server that this browser is linked to a
 * student (proxy.ts checked first), then shows the student header.
 */
export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return (
    <Suspense fallback={<HeaderShell />}>
      <GatedLearn>{children}</GatedLearn>
    </Suspense>
  );
}

async function GatedLearn({ children }: { children: ReactNode }) {
  await connection();
  const student = await requireStudent();
  return (
    <>
      <HeaderShell>
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          <span className="sr-only">Signed in as </span>
          <span className="font-medium text-foreground">{student.displayName}</span>
        </p>
        <SwitchStudentButton />
      </HeaderShell>
      {children}
    </>
  );
}

function HeaderShell({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex min-h-14 w-full max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2">
        <span className="font-heading text-lg font-semibold tracking-tight text-primary">Coding in Color</span>
        <div className="flex min-w-0 flex-wrap items-center gap-3">{children}</div>
      </div>
    </header>
  );
}
