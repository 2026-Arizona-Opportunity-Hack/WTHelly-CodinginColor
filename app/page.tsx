import Link from "next/link";

export default function Home() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-12 sm:px-6">
      <div>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-primary">
          Coding in Color Curriculum
        </h1>
        <p className="mt-2 text-muted-foreground">
          Lessons, progress and learning gains for Coding in Color classes.
        </p>
      </div>
      <nav aria-label="Get started" className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/join"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          I&apos;m a student
        </Link>
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border-strong bg-card px-5 font-semibold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          Staff sign in
        </Link>
      </nav>
    </main>
  );
}
