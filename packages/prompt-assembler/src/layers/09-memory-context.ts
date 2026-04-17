import {
  AgentConfig,
  AssemblerDeps,
  Memory,
  QueryContext,
} from '../types.js';

/**
 * L9 — Memórias relevantes injetadas em runtime via recall().
 *
 * Omitida se:
 * - context.exclude_dynamic_sections === true (phantom cache mode)
 * - context.query ausente (background task)
 * - recall() não injetado (enquanto S7 não termina, caller passa stub)
 * - recall() retorna lista vazia
 * - recall() falha (degraded mode — memory nunca derruba agente, § 32)
 */
export async function memoryContextLayer(
  config: AgentConfig,
  ctx: QueryContext,
  deps: AssemblerDeps = {},
): Promise<string> {
  if (ctx.exclude_dynamic_sections) return '';
  if (!ctx.query) return '';
  if (!deps.recall) return '';

  let memories: Memory[];
  try {
    memories = await deps.recall({
      query: ctx.query,
      filters: {
        user_id: ctx.user_id,
        agent_id: config.agent_id,
        business_id: config.business_id,
        run_id: ctx.session_id,
      },
      limit: 10,
    });
  } catch {
    // Degraded mode (§ 32): memória não derruba o agente.
    return '';
  }

  if (!memories || memories.length === 0) return '';

  const lines = memories.map(
    (m, i) =>
      `${i + 1}. [${m.type}|importance:${m.importance}] ${m.summary}`,
  );

  return `## Memórias Relevantes (top ${memories.length})\n\n${lines.join('\n')}`;
}
