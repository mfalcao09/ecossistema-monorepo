/**
 * Art. IV — Rastreabilidade Total (PostToolUse)
 *
 * Grava uma linha em `audit_log` para TODA chamada (sucesso ou falha).
 * Payloads viram hashes SHA-256 (LGPD-safe). Payload real só em Langfuse
 * (retenção curta).
 */

import type { PostToolUseHook } from "./types.js";
import { hashPayload, writeAuditLog } from "./utils.js";

export const artIVAudit: PostToolUseHook = async (ctx) => {
  const success =
    ctx.error == null &&
    (ctx.http_status == null || (ctx.http_status >= 200 && ctx.http_status < 400));

  await writeAuditLog({
    agent_id: ctx.agent_id,
    business_id: ctx.business_id,
    tool_name: ctx.tool_name,
    tool_input_hash: hashPayload(ctx.tool_input),
    result_hash: hashPayload(ctx.result),
    success,
    timestamp: ctx.timestamp ?? new Date().toISOString(),
    trace_id: ctx.trace_id,
    severity: success ? "LOW" : "MEDIUM",
  });
};
