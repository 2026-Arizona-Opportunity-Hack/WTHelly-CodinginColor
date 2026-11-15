import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CreateKeyForm } from "./create-key-form";
import { revokeApiKey } from "./actions";

export default function ApiKeysPage() {
  return <Suspense fallback={<main className="mx-auto max-w-4xl p-6">Loading API keys…</main>}><ApiKeys /></Suspense>;
}

async function ApiKeys() {
  await connection();
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: keys, error } = await supabase.from("api_keys")
    .select("id, label, created_at, revoked_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Read API keys</h1><p className="mt-2 text-muted-foreground">Keys allow the Coding in Color dashboard to read aggregated program progress.</p></div>
      <CreateKeyForm />
      <section aria-labelledby="existing-keys-heading" className="space-y-3">
        <div><h2 id="existing-keys-heading" className="text-xl font-semibold">Existing keys</h2><p className="text-sm text-muted-foreground">Only the final four characters are shown. Revocation takes effect immediately.</p></div>
        {error ? <p role="alert" className="rounded-lg border p-4 text-sm">Keys could not be loaded. Refresh to try again.</p> : !keys?.length ? <p className="rounded-lg border p-4 text-sm">No API keys have been created.</p> : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[580px] text-left text-sm">
              <caption className="sr-only">Read API keys</caption>
              <thead className="bg-muted/50"><tr><th scope="col" className="px-4 py-3 font-medium">Label</th><th scope="col" className="px-4 py-3 font-medium">Key ending</th><th scope="col" className="px-4 py-3 font-medium">Created</th><th scope="col" className="px-4 py-3 font-medium">Status</th><th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y">{keys.map((key) => <tr key={key.id}>
                <th scope="row" className="px-4 py-3 font-medium">{key.label}</th>
                <td className="px-4 py-3 font-mono">••••{key.id.slice(-4)}</td>
                <td className="px-4 py-3">{new Date(key.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</td>
                <td className="px-4 py-3">{key.revoked_at ? "Revoked" : "Active"}</td>
                <td className="px-4 py-3">{!key.revoked_at && <form action={revokeApiKey}><input type="hidden" name="id" value={key.id} /><Button type="submit" size="sm" variant="destructive">Revoke</Button></form>}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
