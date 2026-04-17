/**
 * compose-agent.ts — Bootstrap canônico de agente V9 (TS / Managed Agents L1).
 *
 * Compõe num ponto só:
 *   1. `@ecossistema/memory` (MemoryClient + hybrid retrieval)
 *   2. `@ecossistema/constitutional-hooks` (11 hooks V9)
 *   3. Wiring do Art. XXII → `memory.add()` via `createArtXXIIMemoryAdapter`
 *
 * ─────────────────────────────────────────────────────────────────────────
 * USO (exemplo de um C-suite agent, ex.: CFO-FIC):
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   import { composeAgentRuntime } from "./compose-agent.js";
 *
 *   const runtime = composeAgentRuntime({
 *     agent_id: "cfo-fic",
 *     business_id: "fic",
 *     supabase: {
 *       url: process.env.ECOSYSTEM_SUPABASE_URL!,
 *       serviceRoleKey: process.env.ECOSYSTEM_SUPABASE_SERVICE_ROLE_KEY!,
 *     },
 *     gemini: { apiKey: process.env.GEMINI_API_KEY },
 *   });
 *
 *   // Agora runtime.memory e runtime.hooks estão prontos para registro no
 *   // Claude Agent SDK / Managed Agents:
 *   //
 *   //   new ManagedAgent({
 *   //     tools: [...],
 *   //     hooks: runtime.hooks,  // { preToolUse, postToolUse, sessionEnd }
 *   //   });
 *   //
 *   // O agente pode consultar memória diretamente com runtime.memory.recall(...)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NOTA: este módulo é a ponte TS. O orchestrator Python (S10, FastAPI
 * Railway) chamará essa composição via subprocess Node, MCP server, ou
 * reimplementará em Python consumindo as mesmas tabelas e RPCs. A forma
 * canônica de composição para agentes que rodam em TS (Managed Agents L1,
 * Jarvis, etc.) é importar diretamente deste arquivo.
 */

import {
  MemoryClient,
  createArtXXIIMemoryAdapter,
  type MemoryConfig,
} from "@ecossistema/memory";
import {
  artIIHITL,
  artIIIIdempotency,
  artIVAudit,
  artVIIIBaixaReal,
  artIXFalhaExplicita,
  artXIICostControl,
  artXIVDualWrite,
  artXVIIIDataContracts,
  artXIXSecurity,
  artXXSoberania,
  createArtXXIIHook,
  type PreToolUseHook,
  type PostToolUseHook,
  type SessionEndHook,
} from "@ecossistema/constitutional-hooks";

/** Configuração de runtime de um agente V9. */
export interface AgentRuntimeConfig {
  /** ID do agente. Usado em filters de memory + audit. Ex.: 'cfo-fic', 'claudinho', 'buchecha'. */
  agent_id: string;
  /** Negócio. 'ecosystem' | 'fic' | 'klesis' | 'intentus' | 'splendori' | 'nexvy'. */
  business_id: string;

  supabase: {
    url: string;
    /** Service role key — do Supabase Vault ou env do runtime. */
    serviceRoleKey: string;
  };

  gemini?: {
    /** Se ausente, memory roda em degraded dense (sparse + entity-boost continuam). */
    apiKey?: string;
  };

  memory?: Partial<Omit<MemoryConfig, "supabaseUrl" | "supabaseKey" | "geminiApiKey">>;
}

/** Runtime pronto para registro no Claude Agent SDK. */
export interface AgentRuntime {
  /** Cliente de memória — expõe add/recall/contradict/ping. */
  memory: MemoryClient;

  /** Hooks V9 prontos para `new ManagedAgent({ hooks })`. */
  hooks: {
    preToolUse: PreToolUseHook[];
    postToolUse: PostToolUseHook[];
    sessionEnd: SessionEndHook[];
  };

  /** Identificação do agente — útil para logs e telemetria. */
  identity: Pick<AgentRuntimeConfig, "agent_id" | "business_id">;
}

/**
 * Compõe um runtime V9-completo para um agente.
 *
 * 11 hooks registrados (ordem importa — ver docstring de cada artigo):
 *   - PRE:  II HITL, III Idempotency, XIV Dual-Write, XII Cost, XIX Security, XX Soberania, XVIII DataContracts
 *   - POST: IV Audit, VIII Baixa Real, IX Falha Explícita
 *   - END:  XXII Aprendizado (wired to memory)
 *
 * @throws se config.agent_id ou business_id estiverem vazios (fail-fast, evita vazamento cross-business)
 */
export function composeAgentRuntime(config: AgentRuntimeConfig): AgentRuntime {
  if (!config.agent_id?.trim() || !config.business_id?.trim()) {
    throw new Error(
      "[compose-agent] agent_id e business_id são obrigatórios (MP-04 + SC-09)",
    );
  }

  const memory = new MemoryClient({
    supabaseUrl: config.supabase.url,
    supabaseKey: config.supabase.serviceRoleKey,
    embeddingProvider: config.gemini?.apiKey ? "gemini" : "none",
    geminiApiKey: config.gemini?.apiKey,
    ...(config.memory ?? {}),
  });

  const artXXIIHook = createArtXXIIHook({
    memoryAdd: createArtXXIIMemoryAdapter(memory),
  });

  return {
    memory,
    identity: {
      agent_id: config.agent_id,
      business_id: config.business_id,
    },
    hooks: {
      preToolUse: [
        artIIHITL,
        artIIIIdempotency,
        artXIVDualWrite,
        artXIICostControl,
        artXIXSecurity,
        artXXSoberania,
        artXVIIIDataContracts,
      ],
      postToolUse: [artIVAudit, artVIIIBaixaReal, artIXFalhaExplicita],
      sessionEnd: [artXXIIHook],
    },
  };
}

/**
 * Helper de smoke-test runtime. Faz `ping` no memory e retorna `{supabase, embedder}`.
 * Use no bootstrap para detectar problemas cedo (antes do primeiro tool call).
 */
export async function healthCheck(runtime: AgentRuntime): Promise<{
  supabase: boolean;
  embedder: boolean;
  agent_id: string;
}> {
  const ping = await runtime.memory.ping();
  return { ...ping, agent_id: runtime.identity.agent_id };
}
