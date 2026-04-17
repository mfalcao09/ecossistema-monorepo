// webhook-hardening/hmac.ts
// HMAC verification (SHA-256/1/512). Secret vem do vault via credential-gateway.
import type { SupabaseClient } from "../_shared/supabase-admin.ts";
import { timingSafeEq } from "../_shared/auth.ts";

function hexOfBuffer(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeSignature(raw: string): string {
  // Providers como GitHub enviam "sha256=<hex>"; stripa o prefixo
  return raw.trim().replace(/^sha(?:256|1|512)=/, "").toLowerCase();
}

async function hmacHex(
  algo: "SHA-256" | "SHA-1" | "SHA-512",
  secret: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: algo },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return hexOfBuffer(sig);
}

export async function fetchWebhookSecret(supabase: SupabaseClient, secretName: string): Promise<string> {
  // secret_key em webhook_targets aponta para ecosystem_credentials.vault_key
  const { data, error } = await supabase.from("ecosystem_credentials")
    .select("vault_key").match({ name: secretName }).maybeSingle();
  if (error || !data?.vault_key) throw new Error(`webhook secret not configured: ${secretName}`);
  const { data: secret, error: rpcErr } = await supabase.rpc("get_vault_secret_by_key", { p_key: data.vault_key });
  if (rpcErr || !secret) throw new Error(`vault read failed for ${secretName}`);
  return String(secret);
}

export async function verifyHMAC(
  supabase: SupabaseClient,
  provider: string,
  body: string,
  signatureHeader: string | null,
  algo: "sha256" | "sha1" | "sha512",
  secretName: string,
): Promise<{ valid: boolean; reason?: string }> {
  if (!signatureHeader) return { valid: false, reason: "missing_signature" };
  const signature = normalizeSignature(signatureHeader);
  let secret: string;
  try {
    secret = await fetchWebhookSecret(supabase, secretName);
  } catch (e) {
    console.error(`[webhook-hardening] secret fetch failed for ${provider}:`, (e as Error).message);
    return { valid: false, reason: "secret_unavailable" };
  }
  const computed = await hmacHex(
    algo === "sha1" ? "SHA-1" : algo === "sha512" ? "SHA-512" : "SHA-256",
    secret,
    body,
  );
  return { valid: timingSafeEq(signature, computed) };
}

export async function sha256Body(body: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return hexOfBuffer(buf);
}
