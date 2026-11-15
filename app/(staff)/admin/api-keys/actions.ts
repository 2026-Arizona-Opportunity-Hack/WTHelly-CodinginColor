"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type KeyActionState = { ok: boolean; message: string; key?: string };
const LABEL = z.string().trim().min(1, "Enter a label.").max(80, "Labels must be 80 characters or fewer.");
const UUID = z.string().uuid();

export async function createApiKey(_previous: KeyActionState, formData: FormData): Promise<KeyActionState> {
  await requireRole(["admin"]);
  const parsed = LABEL.safeParse(formData.get("label"));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a label." };

  const id = randomUUID();
  // The final four characters are derived from the public key row id, so the
  // UI can show the suffix later without storing any part of the raw secret.
  const key = `cic_live_${randomBytes(32).toString("base64url")}${id.slice(-4)}`;
  const keyHash = createHash("sha256").update(key).digest("hex");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in as an admin to create a key." };
  const { error } = await supabase.from("api_keys").insert({ id, label: parsed.data, key_hash: keyHash, created_by: user.id });
  if (error) {
    console.error("createApiKey failed", error.code);
    return { ok: false, message: "The key could not be created. Try again." };
  }
  revalidatePath("/admin/api-keys");
  return { ok: true, message: "Copy this key now. It will not be shown again.", key };
}

export async function revokeApiKey(formData: FormData): Promise<void> {
  await requireRole(["admin"]);
  const parsed = UUID.safeParse(formData.get("id"));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", parsed.data).is("revoked_at", null);
  revalidatePath("/admin/api-keys");
}
