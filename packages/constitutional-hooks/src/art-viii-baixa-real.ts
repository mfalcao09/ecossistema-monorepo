/**
 * Art. VIII — Confirmação por Baixa Real (PostToolUse)
 *
 * Valida que o tool retornou sucesso *real*, não:
 *   - `{ status: "accepted" }` sem confirmação
 *   - Stubs/mocks (via flag `is_mock` em ambientes não-prod)
 *   - Timeout mascarado como sucesso (timeout=true + status=sucesso)
 *
 * Se suspeito: grava violação em audit_log (severity HIGH) e emite sinal
 * para Langfuse (placeholder — integração real no S9).
 */

import type { PostToolUseHook } from "./types.js";
import { hashPayload, writeAuditLog } from "./utils.js";

const SUSPICIOUS_STATUSES: ReadonlySet<string> = new Set([
  "accepted",
  "queued",
  "pending",
  "processing",
]);

function looksSuspicious(ctx: Parameters<PostToolUseHook>[0]): {
  suspicious: boolean;
  reason?: string;
} {
  // Mock em produção → red flag imediato
  if (ctx.is_mock === true && ctx.environment === "prod") {
    return { suspicious: true, reason: "is_mock=true em produção" };
  }

  if (ctx.result && typeof ctx.result === "object") {
    const r = ctx.result as Record<string, unknown>;

    // Status não-final
    if (typeof r.status === "string" && SUSPICIOUS_STATUSES.has(r.status)) {
      // Aceitável se houver confirmation_id/receipt/baixa_id
      const hasConfirmation =
        typeof r.confirmation_id === "string" ||
        typeof r.receipt === "string" ||
        typeof r.baixa_id === "string" ||
        typeof r.transaction_id === "string";
      if (!hasConfirmation) {
        return {
          suspicious: true,
          reason: `status="${r.status}" sem confirmation_id/receipt`,
        };
      }
    }

    // Timeout mascarado
    if (r.timeout === true && r.success === true) {
      return { suspicious: true, reason: "timeout=true mascarado como success=true" };
    }
  }

  return { suspicious: false };
}

export const artVIIIBaixaReal: PostToolUseHook = async (ctx) => {
  const check = looksSuspicious(ctx);
  if (!check.suspicious) return;

  await writeAuditLog({
    agent_id: ctx.agent_id,
    business_id: ctx.business_id,
    tool_name: ctx.tool_name,
    tool_input_hash: hashPayload(ctx.tool_input),
    result_hash: hashPayload(ctx.result),
    success: false,
    timestamp: ctx.timestamp ?? new Date().toISOString(),
    trace_id: ctx.trace_id,
    severity: "HIGH",
    notes: `art_viii_violation: ${check.reason}`,
  });

  // eslint-disable-next-line no-console
  console.warn("[art-viii] violação detectada", {
    agent_id: ctx.agent_id,
    tool_name: ctx.tool_name,
    reason: check.reason,
  });
};
