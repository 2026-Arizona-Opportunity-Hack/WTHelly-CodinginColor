import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const NO_STORE = { "Cache-Control": "no-store" };

export function apiError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export function apiJson(data: unknown) {
  return NextResponse.json(data, { headers: NO_STORE });
}

export async function requireApiKey(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return { error: apiError("A valid bearer key is required.", 401) } as const;

  const keyHash = createHash("sha256").update(match[1]).digest("hex");
  const { data, error } = await createAdminClient()
    .from("api_keys")
    .select("id")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) return { error: apiError("API key verification is temporarily unavailable.", 503) } as const;
  if (!data) return { error: apiError("A valid bearer key is required.", 401) } as const;
  return { ok: true } as const;
}

export type DateFilters = { from: string | null; to: string | null };

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getDateFilters(url: URL): { filters: DateFilters } | { error: string } {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if ((from && !isIsoDate(from)) || (to && !isIsoDate(to))) {
    return { error: "from and to must be valid ISO dates in YYYY-MM-DD format." };
  }
  if (from && to && from > to) return { error: "from must be on or before to." };
  return { filters: { from, to } };
}

