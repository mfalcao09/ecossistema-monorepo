// _shared/rate-limit.ts
// Rate limit via tabela rate_limit_buckets + RPC atomic.
import type { SupabaseClient } from "./supabase-admin.ts";

export type WindowKind = "rpm" | "rph" | "rpd";

function truncateToWindow(kind: WindowKind, at: Date = new Date()): Date {
  const d = new Date(at);
  if (kind === "rpm") {
    d.setSeconds(0, 0);
  } else if (kind === "rph") {
    d.setMinutes(0, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

/**
 * Incrementa o bucket atomicamente via RPC rate_limit_hit. Retorna:
 *   { ok: true }              → dentro do limite
 *   { ok: false, retryAfter } → excedeu o limite (em segundos)
 */
export async function hitLimit(
  supabase: SupabaseClient,
  key: string,
  kind: WindowKind,
  limit: number,
): Promise<{ ok: boolean; retryAfter?: number }> {
  const windowStart = truncateToWindow(kind);
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_key: key,
    p_kind: kind,
    p_window_start: windowStart.toISOString(),
    p_limit: limit,
  });
  if (error) {
    console.error("[rate-limit] rpc failed:", error.message);
    return { ok: true }; // fail-open — não bloqueia por erro de DB
  }
  if (data === true) return { ok: true };
  const nextWindow = new Date(windowStart);
  if (kind === "rpm") nextWindow.setMinutes(nextWindow.getMinutes() + 1);
  else if (kind === "rph") nextWindow.setHours(nextWindow.getHours() + 1);
  else nextWindow.setDate(nextWindow.getDate() + 1);
  const retryAfter = Math.max(1, Math.round((nextWindow.getTime() - Date.now()) / 1000));
  return { ok: false, retryAfter };
}
