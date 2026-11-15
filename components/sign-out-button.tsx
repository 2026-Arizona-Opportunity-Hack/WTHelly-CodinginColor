"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOut, switchStudent } from "@/lib/auth/actions";

/**
 * Runs a sign-out server action, then does a full page load (not a router
 * navigation). cacheComponents keeps visited pages alive in <Activity>, so a
 * client-side navigation would bring back the previous user's form state.
 * The reload happens even if the action fails, so the old screen never stays up.
 */
function useSignOutAndReload(action: () => Promise<void>, to: string) {
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      try {
        await action();
      } finally {
        window.location.assign(to);
      }
    });
  return [pending, run] as const;
}

/** Staff sign out → fresh /login. */
export function SignOutButton() {
  const [pending, run] = useSignOutAndReload(signOut, "/login");
  return (
    <Button type="button" variant="outline" className="h-9" disabled={pending} onClick={run}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

/** "Not you? Switch student" on shared devices → fresh /join. */
export function SwitchStudentButton() {
  const [pending, run] = useSignOutAndReload(switchStudent, "/join");
  return (
    <Button type="button" variant="outline" className="h-10 px-3" disabled={pending} onClick={run}>
      {pending ? "Switching…" : "Not you? Switch student"}
    </Button>
  );
}
