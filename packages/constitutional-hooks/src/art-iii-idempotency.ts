/**
 * Art. III — Idempotência Universal (PreToolUse)
 *
 * Antes de uma chamada idempotente (whitelist via env ou tool com flag),
 * calcula `idempotency_key = sha256(agent_id + tool_name + input + YYYY-MM-DD)`.
 *
 * Consulta `idempotency_cache` no Supabase:
 *   - Se key existe nas últimas 24h → bloqueia (duplicata)
 *   - Se não existe → grava e permite
 */

import type { HooksSupabase, PreToolUseHook } from "./types.js";
import { getSupabase, makeIdempotencyKey } from "./utils.js";

/**
 * Lista default de tools idempotentes. Em produção, será lida de um registry
 * (ToolSchemaRegistry no S3). Por ora, envolvemos as mais óbvias.
 */
export const DEFAULT_IDEMPOTENT_TOOLS: ReadonlySet<string> = new Set([
  "emitir_boleto",
  "emitir_boleto_massa",
  "pix_transferencia",
  "pagamento_fornecedor",
  "enviar_webhook",
  "criar_matricula",
]);

export interface ArtIIIConfig {
  idempotentTools?: ReadonlySet<string>;
  windowHours?: number;
}

export function createArtIIIHook(config: ArtIIIConfig = {}): PreToolUseHook {
  const tools = config.idempotentTools ?? DEFAULT_IDEMPOTENT_TOOLS;
  const windowHours = config.windowHours ?? 24;

  return async (ctx) => {
    if (!tools.has(ctx.tool_name)) {
      return { decision: "allow" };
    }

    const key = makeIdempotencyKey({
      agent_id: ctx.agent_id,
      tool_name: ctx.tool_name,
      tool_input: ctx.tool_input,
    });

    const sb: HooksSupabase = getSupabase();
    const windowStart = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();

    const { data, error } = await sb
      .from("idempotency_cache")
      .select("key")
      .eq("key", key)
      .gte("created_at", windowStart)
      .limit(1);

    if (error) {
      // Falha em consultar cache: não bloqueamos a ação (fail-open neste hook
      // — alternativa é fail-closed, mas risco de deadlock). Logamos e seguimos.
      // eslint-disable-next-line no-console
      console.error("[art-iii] falha ao consultar idempotency_cache", error);
      return { decision: "allow" };
    }

    if (data && data.length > 0) {
      return {
        decision: "block",
        reason: `Art. III: Duplicata em janela de ${windowHours}h (key=${key.slice(0, 12)}…)`,
      };
    }

    // Grava a key (fire-and-forget — não queremos bloquear o agente)
    await sb.from("idempotency_cache").insert({
      key,
      agent_id: ctx.agent_id,
      tool_name: ctx.tool_name,
      created_at: new Date().toISOString(),
    });

    return { decision: "allow" };
  };
}

export const artIIIIdempotency: PreToolUseHook = createArtIIIHook();
