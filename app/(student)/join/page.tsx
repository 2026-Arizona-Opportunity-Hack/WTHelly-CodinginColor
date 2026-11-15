import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join your class · Coding in Color" };

export default function JoinPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-10">
      <JoinForm />
      <p className="text-sm text-muted-foreground">
        Staff?{" "}
        <Link
          href="/login"
          className="underline underline-offset-4 outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Sign in here
        </Link>
        .
      </p>
    </main>
  );
}
