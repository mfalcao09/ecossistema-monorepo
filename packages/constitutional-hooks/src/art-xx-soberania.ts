/**
 * Art. XX — Soberania Local (PreToolUse)
 *
 * Quando a tool pede dado que existe no Supabase E em API externa, prefere
 * Supabase. Implementado como **hint** (não bloqueia) — grava sinal em
 * telemetry e sugere tool alternativa via `reason`.
 *
 * Ex: `buscar_aluno_cpf` → `query_pessoas` no ERP-FIC antes da Receita Federal.
 *     `cotacao_imovel`   → `query_empreendimentos` no Intentus antes de API.
 *
 * Como é hint e não bloqueio, retornamos `allow` — o próprio agente deve
 * reavaliar na próxima chamada. A telemetria vai pro audit_log.
 */

import type { PreToolUseHook } from "./types.js";

/**
 * Mapa de tools com alternativa local. Refinar conforme o ecossistema cresce.
 */
export const SOBERANIA_HINTS: Readonly<Record<string, string>> = {
  buscar_aluno_cpf: "query_pessoas (Supabase ERP-FIC) — consulte local antes da Receita Federal",
  buscar_aluno_rg: "query_pessoas (Supabase ERP-FIC)",
  cotacao_imovel: "query_empreendimentos (Supabase Intentus) — use dados locais quando disponíveis",
  consultar_cep: "query_enderecos (Supabase) — cache local antes de ViaCEP/CorreiosAPI",
  validar_cpf_receita: "pessoas_validadas (Supabase ECOSYSTEM) — cache de 30 dias",
};

export const artXXSoberania: PreToolUseHook = async (ctx) => {
  const hint = SOBERANIA_HINTS[ctx.tool_name];
  if (!hint) return { decision: "allow" };

  // Sinal de telemetria (stdout — S9 Langfuse substitui)
  // eslint-disable-next-line no-console
  console.info("[art-xx] soberania_hint", {
    agent_id: ctx.agent_id,
    business_id: ctx.business_id,
    tool_name: ctx.tool_name,
    hint,
    trace_id: ctx.trace_id,
  });

  // Não bloqueia — é hint. A próxima chamada do agente deveria preferir o local.
  return { decision: "allow" };
};
