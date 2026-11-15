import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { createModule } from "./actions";

const linkClass =
  "rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = { searchParams: Promise<{ error?: string }> };

export default function ModulesPage(props: Props) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Modules</h1>
        <form action={createModule}>
          <Button type="submit" size="lg">
            New module
          </Button>
        </form>
      </div>
      <p className="text-muted-foreground">
        New modules start as a draft with a 5-question pretest and post-test and one lesson (video, quick check,
        worksheet, exit question).
      </p>
      <Suspense fallback={<p>Loading modules…</p>}>
        <ModuleList {...props} />
      </Suspense>
    </main>
  );
}

async function ModuleList({ searchParams }: Props) {
  await connection();
  await requireRole(["admin"]);
  const { error: createError } = await searchParams;
  const supabase = await createClient();
  const { data: modules, error } = await supabase
    .from("modules")
    .select("id, title, status, concept_tags, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <>
      {createError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          The new module couldn&apos;t be created. Try again in a moment.
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          Modules couldn&apos;t be loaded. Refresh to try again.
        </p>
      ) : !modules?.length ? (
        <p>No modules yet. Create one with New module.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">All modules</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Title</th>
                <th scope="col" className="px-4 py-2 font-medium">Status</th>
                <th scope="col" className="px-4 py-2 font-medium">Concept tags</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {modules.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2">
                    <Link href={`/admin/modules/${m.id}`} className={linkClass}>
                      {m.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-2">
                    {(m.concept_tags as string[]).length ? (m.concept_tags as string[]).join(", ") : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const published = status === "published";
  return (
    <span
      className={
        published
          ? "rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
          : "rounded-full border border-border px-2 py-0.5 text-xs font-medium"
      }
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}
