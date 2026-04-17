import type { MemoryClient } from "../client.js";
import type { Outcome } from "../types.js";

/**
 * Adapter que converte o payload do hook Art. XXII (`createArtXXIIHook`
 * em `@ecossistema/constitutional-hooks`) para `memory.add` episodic.
 *
 * Uso:
 *   import { MemoryClient, createArtXXIIMemoryAdapter } from "@ecossistema/memory";
 *   import { createArtXXIIHook } from "@ecossistema/constitutional-hooks";
 *
 *   const memory = new MemoryClient({ ... });
 *   const hook = createArtXXIIHook({ memoryAdd: createArtXXIIMemoryAdapter(memory) });
 */
export function createArtXXIIMemoryAdapter(memory: MemoryClient) {
  return async (entry: {
    agent_id: string;
    business_id: string;
    session_id: string;
    summary: string;
    tools_used: string[];
    files_touched: string[];
    outcome: Outcome | "success" | "failure" | "partial";
    tags: string[];
  }): Promise<void> => {
    await memory.add({
      type: "episodic",
      episodicType: "task",
      summary: entry.summary,
      outcome: entry.outcome as Outcome,
      tools_used: entry.tools_used,
      files_touched: entry.files_touched,
      filters: {
        business_id: entry.business_id,
        agent_id: entry.agent_id,
      },
      metadata: {
        session_id: entry.session_id,
        tags: entry.tags,
        source: "art-xxii-session-end",
      },
    });
  };
}
