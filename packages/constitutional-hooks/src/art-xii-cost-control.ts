/**
 * Art. XII — Custos sob Controle (PreToolUse)
 *
 * Para tool calls que batem em LLMs via LiteLLM (`tool_name` começa com
 * `llm_`), consulta budget do business_id e bloqueia se não houver saldo
 * para a chamada estimada.
 *
 * Estimativa: `tokens_expected × preço_por_modelo`.
 */

import type { PreToolUseHook } from "./types.js";
import { estimateLLMCostUSD, getLiteLLMClient } from "./utils.js";

export interface ArtXIIConfig {
  /** Prefixo que identifica tools LLM-cost-relevant. Default: `llm_`. */
  llmPrefix?: string;
  /** Margem de segurança multiplicativa (default 1.2 = +20%). */
  safetyMargin?: number;
}

export function createArtXIIHook(config: ArtXIIConfig = {}): PreToolUseHook {
  const prefix = config.llmPrefix ?? "llm_";
  const margin = config.safetyMargin ?? 1.2;

  return async (ctx) => {
    if (!ctx.tool_name.startsWith(prefix)) {
      return { decision: "allow" };
    }

    const input = ctx.tool_input ?? {};
    const model = typeof input.model === "string" ? input.model : "claude-sonnet-4-6";
    const tokens =
      typeof input.tokens_expected === "number" && input.tokens_expected > 0
        ? input.tokens_expected
        : 4000; // default conservador

    const estimated = estimateLLMCostUSD({ model, tokens_expected: tokens }) * margin;

    try {
      const remaining = await getLiteLLMClient().getRemainingBudgetUSD(ctx.business_id);
      if (remaining < estimated) {
        return {
          decision: "block",
          reason: `Art. XII: Budget insuficiente (${remaining.toFixed(4)} USD) para chamada estimada em ${estimated.toFixed(4)} USD (${model}, ${tokens} tokens)`,
        };
      }
      return { decision: "allow" };
    } catch (err) {
      // Fail-closed: se não conseguimos verificar budget, bloqueamos.
      // Custo > inconveniência.
      return {
        decision: "block",
        reason: `Art. XII: Falha ao verificar budget (${(err as Error).message}). Fail-closed.`,
      };
    }
  };
}

export const artXIICostControl: PreToolUseHook = createArtXIIHook();
