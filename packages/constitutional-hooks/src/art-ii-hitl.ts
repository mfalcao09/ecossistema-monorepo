/**
 * Art. II — Human-in-the-Loop Crítico (PreToolUse)
 *
 * Bloqueia:
 *   - Ações irreversíveis (lista em utils.IRREVERSIVEIS)
 *   - Ações financeiras acima de `ECO_HITL_THRESHOLD_BRL` (default R$ 10.000)
 *
 * Em bloqueio: insere pedido de aprovação em `approval_requests` e retorna
 * `{ decision: "block", reason }` — agente pausa até webhook de aprovação.
 */

import type { PreToolUseHook } from "./types.js";
import {
  createApprovalRequest,
  isFinancial,
  isIrreversible,
  parseAmountFromInput,
} from "./utils.js";

function getThreshold(): number {
  const raw = process.env.ECO_HITL_THRESHOLD_BRL;
  if (!raw) return 10_000;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

export const artIIHITL: PreToolUseHook = async (ctx) => {
  const { tool_name, tool_input, agent_id, business_id, trace_id } = ctx;

  if (isIrreversible(tool_name)) {
    await createApprovalRequest({
      agent_id,
      business_id,
      tool_name,
      tool_input,
      reason_for_approval: `Ação irreversível: ${tool_name}`,
      status: "pending",
      trace_id,
    });
    return {
      decision: "block",
      reason:
        "Art. II: Ação irreversível. Aprovação humana requisitada via status_idled.",
    };
  }

  if (isFinancial(tool_name)) {
    const amount = parseAmountFromInput(tool_input);
    const threshold = getThreshold();
    if (amount !== null && amount > threshold) {
      await createApprovalRequest({
        agent_id,
        business_id,
        tool_name,
        tool_input,
        reason_for_approval: `Valor R$${amount} > limite R$${threshold}`,
        status: "pending",
        trace_id,
      });
      return {
        decision: "block",
        reason: `Art. II: Valor R$${amount} > limite R$${threshold}. Aprovação humana.`,
      };
    }
  }

  return { decision: "allow" };
};
