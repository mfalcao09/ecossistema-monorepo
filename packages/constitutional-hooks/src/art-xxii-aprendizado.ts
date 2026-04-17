/**
 * Art. XXII — Aprendizado é Infraestrutura (SessionEnd)
 *
 * Ao fim de cada sessão:
 *   1. Extrai tools_used, files_touched, outcome
 *   2. (futuro) Gera resumo via LLM Haiku
 *   3. Chama memory.add() — STUB até S7 entregar `@ecossistema/memory`
 *   4. Atualiza importance de memórias referenciadas (incrementa access_count)
 *
 * STATUS: stub funcional. Troca o `console.log` por `memory.add()` no S7.
 */

import type { SessionEndHook } from "./types.js";

export interface ArtXXIIConfig {
  /**
   * Hook de integração com `@ecossistema/memory`. Quando S7 entregar,
   * passar `memory.add` aqui. Default: console.log (stub).
   */
  memoryAdd?: (entry: {
    agent_id: string;
    business_id: string;
    session_id: string;
    summary: string;
    tools_used: string[];
    files_touched: string[];
    outcome: "success" | "failure" | "partial";
    tags: string[];
  }) => Promise<void>;

  /** Flag para desabilitar em testes. */
  enabled?: boolean;
}

const defaultMemoryAdd: NonNullable<ArtXXIIConfig["memoryAdd"]> = async (entry) => {
  // TODO(S7): trocar console.log por memory.add() de @ecossistema/memory
  // eslint-disable-next-line no-console
  console.log("[art-xxii][stub] memory.add", entry);
};

export function createArtXXIIHook(config: ArtXXIIConfig = {}): SessionEndHook {
  const memoryAdd = config.memoryAdd ?? defaultMemoryAdd;
  const enabled = config.enabled ?? true;

  return async (ctx) => {
    if (!enabled) return;

    const summary = buildSummary(ctx);

    await memoryAdd({
      agent_id: ctx.agent_id,
      business_id: ctx.business_id,
      session_id: ctx.session_id,
      summary,
      tools_used: ctx.tools_used,
      files_touched: ctx.files_touched,
      outcome: ctx.outcome,
      tags: inferTags(ctx),
    });
  };
}

function buildSummary(ctx: Parameters<SessionEndHook>[0]): string {
  const duration =
    new Date(ctx.ended_at).getTime() - new Date(ctx.started_at).getTime();
  const durMin = Math.round(duration / 60_000);
  const parts = [
    `Sessão ${ctx.session_id} (${ctx.agent_id}@${ctx.business_id}): ${ctx.outcome} em ${durMin}min.`,
    `Tools: ${ctx.tools_used.slice(0, 8).join(", ") || "—"}.`,
    `Files: ${ctx.files_touched.slice(0, 5).join(", ") || "—"}.`,
  ];
  if (ctx.notes) parts.push(`Notas: ${ctx.notes.slice(0, 200)}.`);
  return parts.join(" ");
}

function inferTags(ctx: Parameters<SessionEndHook>[0]): string[] {
  const tags = new Set<string>();
  tags.add(`business:${ctx.business_id}`);
  tags.add(`outcome:${ctx.outcome}`);
  if (ctx.tools_used.some((t) => t.startsWith("llm_"))) tags.add("uses_llm");
  if (ctx.files_touched.some((f) => f.endsWith(".sql"))) tags.add("sql");
  if (ctx.files_touched.some((f) => /\/migrations\//.test(f))) tags.add("migration");
  return [...tags];
}

export const artXXIIAprendizado: SessionEndHook = createArtXXIIHook();
