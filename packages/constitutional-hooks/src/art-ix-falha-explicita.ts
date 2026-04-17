/**
 * Art. IX — Falha Explícita (PostToolUse)
 *
 * Se o tool lançou exceção silenciosa (HTTP 5xx sem error, `success:false`
 * sem throw, etc.), converte em erro visível e grava em audit com
 * severity=HIGH.
 *
 * Isso é o oposto do Art. VIII: Art. VIII checa se o sucesso é real;
 * Art. IX checa se a falha foi explicitada.
 */

import type { PostToolUseHook } from "./types.js";
import { hashPayload, writeAuditLog } from "./utils.js";

export class ToolFailedError extends Error {
  public readonly tool_name: string;
  public readonly http_status?: number;
  public readonly result: unknown;

  constructor(args: { tool_name: string; http_status?: number; result: unknown; reason: string }) {
    super(`[art-ix] ${args.tool_name} falhou silenciosamente: ${args.reason}`);
    this.name = "ToolFailedError";
    this.tool_name = args.tool_name;
    this.http_status = args.http_status;
    this.result = args.result;
  }
}

function detectSilentFailure(ctx: Parameters<PostToolUseHook>[0]): string | null {
  // Caso 1: HTTP 5xx sem error preenchido
  if (ctx.http_status != null && ctx.http_status >= 500 && !ctx.error) {
    return `HTTP ${ctx.http_status} sem Error lançado`;
  }

  // Caso 2: payload indica falha mas error == null
  if (ctx.result && typeof ctx.result === "object") {
    const r = ctx.result as Record<string, unknown>;
    if (r.success === false && !ctx.error) {
      const msg =
        typeof r.error === "string"
          ? r.error
          : typeof r.message === "string"
            ? r.message
            : "sem mensagem";
      return `result.success=false sem throw: ${msg}`;
    }
    if (r.error != null && r.error !== "" && !ctx.error) {
      return `result.error preenchido sem throw`;
    }
  }

  return null;
}

export const artIXFalhaExplicita: PostToolUseHook = async (ctx) => {
  const reason = detectSilentFailure(ctx);
  if (!reason) return;

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
    notes: `art_ix_silent_failure: ${reason}`,
  });

  throw new ToolFailedError({
    tool_name: ctx.tool_name,
    http_status: ctx.http_status,
    result: ctx.result,
    reason,
  });
};
