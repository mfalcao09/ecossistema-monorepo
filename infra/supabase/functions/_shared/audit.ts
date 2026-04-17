// _shared/audit.ts
// Wrapper para inserir em audit_log (schema v9 de S4).
import type { SupabaseClient } from "./supabase-admin.ts";

export type Severity = "info" | "warning" | "error" | "critical";

export interface AuditEntry {
  agent_id: string;
  business_id?: string;
  tool_name?: string;
  action: string;
  success: boolean;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  severity?: Severity;
  article_ref?: string;
  decision?: "allow" | "block";
  reason?: string;
}

/**
 * Escreve no audit_log. Nunca deve falhar a EF — captura erros e loga.
 * Art. IV (audit append-only) + MP-08.
 */
export async function writeAuditLog(
  supabase: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    const { error } = await supabase.from("audit_log").insert({
      agent_id: entry.agent_id,
      business_id: entry.business_id ?? "ecosystem",
      tool_name: entry.tool_name ?? null,
      action: entry.action,
      success: entry.success,
      duration_ms: entry.duration_ms ?? null,
      metadata: entry.metadata ?? {},
      severity: entry.severity ?? "info",
      article_ref: entry.article_ref ?? null,
      decision: entry.decision ?? null,
      reason: entry.reason ?? null,
    });
    if (error) {
      console.error("[audit] insert failed:", error.message);
    }
  } catch (e) {
    console.error("[audit] exception:", (e as Error).message);
  }
}

/** Timer helper para durar uma operação. */
export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}
