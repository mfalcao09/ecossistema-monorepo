/**
 * Helpers para API keys públicas (S8a).
 *
 * Formato da chave plaintext: `sk_live_<32 base64url chars>`
 *   - Prefixo `sk_live_` para identificação imediata
 *   - Guardamos SHA-256 hex em api_keys.key_hash (nunca o plaintext)
 *   - Guardamos os primeiros 12 chars em api_keys.key_prefix (UI)
 */

import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ScopeAction =
  | "messages:send"
  | "messages:read"
  | "contacts:read"
  | "contacts:write"
  | "deals:read"
  | "deals:write"
  | "dashboard:read"
  | "*";

export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const raw = randomBytes(24).toString("base64url");
  const plaintext = `sk_live_${raw}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  const prefix = plaintext.slice(0, 12);
  return { plaintext, hash, prefix };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export type AuthenticatedApiKey = {
  id: string;
  account_id: string | null;
  scopes: string[];
  name: string;
};

/**
 * Resolve a chave enviada via `Authorization: Bearer <key>` ou header `api-key`.
 * Retorna null se inválida/revogada.
 */
export async function resolveApiKey(
  req: Request,
  supabase: SupabaseClient,
): Promise<AuthenticatedApiKey | null> {
  const auth = req.headers.get("authorization");
  const direct = req.headers.get("api-key");
  const plaintext = direct ?? auth?.replace(/^Bearer\s+/i, "") ?? null;
  if (!plaintext) return null;
  if (!plaintext.startsWith("sk_live_")) return null;

  const hash = hashApiKey(plaintext);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("api_keys")
    .select("id, account_id, scopes, name, active, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (!data || !data.active || data.revoked_at) return null;

  // Bump last_used_at (fire-and-forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {}, () => {});

  return {
    id: data.id,
    account_id: data.account_id ?? null,
    scopes: Array.isArray(data.scopes) ? data.scopes : [],
    name: data.name,
  };
}

export function hasScope(key: AuthenticatedApiKey, required: ScopeAction): boolean {
  if (key.scopes.includes("*")) return true;
  if (key.scopes.includes(required)) return true;
  // Namespace wildcard: messages:* cobre messages:send
  const namespace = required.split(":")[0] + ":*";
  return key.scopes.includes(namespace);
}
