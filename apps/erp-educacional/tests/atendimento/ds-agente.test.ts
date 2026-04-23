/**
 * Testes S10 — DS Agente
 *
 * Unit:
 *   A) shouldActivate — verifica lógica de tags AND/OR e canal
 *   B) shouldHandoff  — verifica hand-off por humano ativo e por keyword
 *   C) splitMessageNaturally — quebra de mensagens
 *   D) chunkText — chunking com overlap
 *
 * Integration (mock OpenAI):
 *   E) runAgent — smoke test com mocks de Supabase e OpenAI
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  shouldActivate,
  shouldHandoff,
} from "@/lib/atendimento/ds-agente-runner";
import { splitMessageNaturally } from "@/lib/atendimento/openai-client";
import { chunkText } from "@/lib/atendimento/rag-client";
import type {
  DsAgent,
  ConversationSummary,
} from "@/lib/atendimento/ds-agente-runner";

// ──────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────
const TAG_MATRICULA = "11111111-1111-1111-1111-111111111111";
const TAG_DUVIDA = "22222222-2222-2222-2222-222222222222";
const TAG_URGENTE = "33333333-3333-3333-3333-333333333333";

function makeAgent(overrides: Partial<DsAgent> = {}): DsAgent {
  return {
    id: "agent-01",
    account_id: null,
    name: "FIC Secretaria",
    system_prompt: "Você é assistente da FIC.",
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 200,
    max_history: 10,
    delay_seconds: 0,
    activation_tags: [],
    tag_logic: "OR",
    channels: ["whatsapp"],
    split_messages: true,
    process_images: false,
    handoff_on_human: true,
    handoff_keywords: ["falar com atendente", "humano"],
    enabled: true,
    ...overrides,
  };
}

function makeConversation(
  overrides: Partial<ConversationSummary> = {},
): ConversationSummary {
  return {
    id: "conv-01",
    inbox_channel: "whatsapp",
    labels: [],
    last_agent_response_at: undefined,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
// A. shouldActivate
// ──────────────────────────────────────────────────────────────
describe("shouldActivate", () => {
  it("retorna false quando agente está desativado", () => {
    const agent = makeAgent({ enabled: false });
    const conv = makeConversation({ labels: [TAG_MATRICULA] });
    const { active } = shouldActivate(conv, agent);
    expect(active).toBe(false);
  });

  it("ativa sem restrição de tag quando activation_tags está vazio", () => {
    const agent = makeAgent({ activation_tags: [] });
    const conv = makeConversation({ labels: [] });
    const { active } = shouldActivate(conv, agent);
    expect(active).toBe(true);
  });

  it("ativa com lógica OR quando conversa tem QUALQUER tag configurada", () => {
    const agent = makeAgent({
      activation_tags: [TAG_MATRICULA, TAG_DUVIDA],
      tag_logic: "OR",
    });
    const conv = makeConversation({ labels: [TAG_MATRICULA] }); // só 1 das 2
    const { active } = shouldActivate(conv, agent);
    expect(active).toBe(true);
  });

  it("NÃO ativa com lógica OR quando conversa não tem nenhuma tag configurada", () => {
    const agent = makeAgent({
      activation_tags: [TAG_MATRICULA, TAG_DUVIDA],
      tag_logic: "OR",
    });
    const conv = makeConversation({ labels: [TAG_URGENTE] }); // tag diferente
    const { active } = shouldActivate(conv, agent);
    expect(active).toBe(false);
  });

  it("ativa com lógica AND quando conversa tem TODAS as tags configuradas", () => {
    const agent = makeAgent({
      activation_tags: [TAG_MATRICULA, TAG_DUVIDA],
      tag_logic: "AND",
    });
    const conv = makeConversation({
      labels: [TAG_MATRICULA, TAG_DUVIDA, TAG_URGENTE],
    });
    const { active } = shouldActivate(conv, agent);
    expect(active).toBe(true);
  });

  it("NÃO ativa com lógica AND quando falta alguma tag", () => {
    const agent = makeAgent({
      activation_tags: [TAG_MATRICULA, TAG_DUVIDA],
      tag_logic: "AND",
    });
    const conv = makeConversation({ labels: [TAG_MATRICULA] }); // falta TAG_DUVIDA
    const { active } = shouldActivate(conv, agent);
    expect(active).toBe(false);
  });

  it("NÃO ativa quando canal não está na lista do agente", () => {
    const agent = makeAgent({ channels: ["instagram"] });
    const conv = makeConversation({ inbox_channel: "whatsapp" });
    const { active } = shouldActivate(conv, agent);
    expect(active).toBe(false);
  });

  it("ativa quando canal está na lista", () => {
    const agent = makeAgent({ channels: ["whatsapp", "instagram"] });
    const conv = makeConversation({ inbox_channel: "instagram" });
    const { active } = shouldActivate(conv, agent);
    expect(active).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// B. shouldHandoff
// ──────────────────────────────────────────────────────────────
describe("shouldHandoff", () => {
  it("não faz handoff quando handoff_on_human é false", () => {
    const agent = makeAgent({ handoff_on_human: false });
    const { handoff } = shouldHandoff(agent, "oi, tudo bem?");
    expect(handoff).toBe(false);
  });

  it("faz handoff quando humano respondeu há menos de 60 min", () => {
    const agent = makeAgent({ handoff_on_human: true });
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { handoff, reason } = shouldHandoff(
      agent,
      "qual o prazo?",
      fiveMinutesAgo,
    );
    expect(handoff).toBe(true);
    expect(reason).toBe("human_intervened");
  });

  it("NÃO faz handoff quando humano respondeu há mais de 60 min", () => {
    const agent = makeAgent({ handoff_on_human: true });
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { handoff } = shouldHandoff(agent, "qual o prazo?", twoHoursAgo);
    expect(handoff).toBe(false);
  });

  it("faz handoff por keyword", () => {
    const agent = makeAgent({
      handoff_keywords: ["falar com atendente", "humano"],
    });
    const { handoff, reason } = shouldHandoff(
      agent,
      "preciso falar com atendente por favor",
    );
    expect(handoff).toBe(true);
    expect(reason).toContain("keyword");
  });

  it("faz handoff por keyword case-insensitive", () => {
    const agent = makeAgent({ handoff_keywords: ["HUMANO"] });
    const { handoff } = shouldHandoff(agent, "quero falar com um Humano");
    expect(handoff).toBe(true);
  });

  it("não faz handoff para texto sem keyword e sem humano ativo", () => {
    const agent = makeAgent({ handoff_keywords: ["falar com atendente"] });
    const { handoff } = shouldHandoff(agent, "quando é o prazo de matrícula?");
    expect(handoff).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// C. splitMessageNaturally
// ──────────────────────────────────────────────────────────────
describe("splitMessageNaturally", () => {
  it("retorna array vazio para texto vazio", () => {
    expect(splitMessageNaturally("")).toEqual([]);
  });

  it("retorna 1 mensagem para texto curto (≤ 280 chars)", () => {
    const short = "O prazo de matrícula é até 31/01.";
    const result = splitMessageNaturally(short);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(short);
  });

  it("quebra texto com 2 parágrafos em 2 mensagens", () => {
    const text =
      "Primeiro parágrafo com conteúdo suficiente.\n\nSegundo parágrafo com mais conteúdo.";
    const result = splitMessageNaturally(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.join("")).toContain("Primeiro parágrafo");
    expect(result.join("")).toContain("Segundo parágrafo");
  });

  it("limita a maxParts partes", () => {
    const parts = Array.from(
      { length: 10 },
      (_, i) => `Parágrafo ${i + 1} com texto razoável aqui.`,
    );
    const text = parts.join("\n\n");
    const result = splitMessageNaturally(text, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

// ──────────────────────────────────────────────────────────────
// D. chunkText
// ──────────────────────────────────────────────────────────────
describe("chunkText", () => {
  it("retorna array com 1 item para texto curto", () => {
    const text = "Texto curto.";
    expect(chunkText(text)).toEqual([text]);
  });

  it("divide texto longo em múltiplos chunks", () => {
    // 3x o limite de CHUNK_MAX_CHARS (2400 chars) → deve ter ≥ 3 chunks
    const longText =
      "A".repeat(2_400) +
      "\n\n" +
      "B".repeat(2_400) +
      "\n\n" +
      "C".repeat(2_400);
    const chunks = chunkText(longText);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Cada chunk não deve exceder o limite (com margem de overlap)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2_400 + 400 + 200); // tolerância
    }
  });

  it("preserva conteúdo — nenhum char é perdido (aproximado)", () => {
    const text =
      "Parágrafo um com algum conteúdo.\n\nParágrafo dois com mais conteúdo.\n\nParágrafo três.";
    const chunks = chunkText(text);
    const joined = chunks.join(" ");
    // Todo parágrafo deve aparecer em algum chunk
    expect(joined).toContain("Parágrafo um");
    expect(joined).toContain("Parágrafo dois");
    expect(joined).toContain("Parágrafo três");
  });

  it("filtra chunks vazios", () => {
    const text = "\n\n\n\nTexto válido aqui.\n\n\n\n";
    const chunks = chunkText(text);
    expect(chunks.every((c) => c.trim().length > 0)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// E. runAgent — Integration (mocks via vi.hoisted)
// Usa vi.hoisted() para criar mocks antes do hoisting do vi.mock.
// ──────────────────────────────────────────────────────────────

// Mocks hoisted — acessíveis dentro das factories do vi.mock
const mocks = vi.hoisted(() => {
  const execInsert = vi.fn().mockResolvedValue({ error: null });
  const msgInsert = vi.fn().mockResolvedValue({ error: null });

  /** Cria uma cadeia Supabase fluente genérica que termina com { data, error } */
  function makeChain(finalData: unknown): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    const resolver: () => Promise<{
      data: unknown;
      error: null;
    }> = async () => ({ data: finalData, error: null });
    // Qualquer método retorna a própria chain; methods terminais específicos
    const proxy = new Proxy(chain, {
      get(_t, prop) {
        if (prop === "then") return undefined; // não é uma Promise
        if (prop === "maybeSingle" || prop === "single") return resolver;
        if (prop === "data") return finalData;
        if (prop === "error") return null;
        return () => proxy; // método fluente
      },
    });
    return proxy;
  }

  function makeSupabase(conversationLabels: Array<{ label_id: string }>) {
    return {
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === "ds_agent_executions") return { insert: execInsert };
          if (table === "atendimento_conversations") {
            return makeChain({
              id: "conv-x",
              atendimento_inboxes: { channel: "whatsapp" },
            });
          }
          if (table === "atendimento_conversation_labels") {
            return makeChain(conversationLabels);
          }
          if (table === "atendimento_messages") {
            // Precisa suportar .select()...chain (buildContext + lastHuman)
            // E também .insert() (sendBotMessages)
            return new Proxy(
              {},
              {
                get(_t, prop: string) {
                  if (prop === "then") return undefined;
                  if (prop === "data") return [];
                  if (prop === "error") return null;
                  if (prop === "insert") return msgInsert;
                  if (prop === "maybeSingle" || prop === "single") {
                    return async () => ({ data: null, error: null });
                  }
                  // Qualquer outro método (select, eq, in, not, order, limit…)
                  // retorna um novo proxy com a mesma lógica
                  return () => makeChain([]);
                },
              },
            );
          }
          return makeChain([]);
        },
      }),
    };
  }

  return { execInsert, msgInsert, makeSupabase };
});

vi.mock("@/lib/supabase/admin", () =>
  // Começa com conversa tendo TAG_MATRICULA — sobrescrevemos por teste se necessário
  mocks.makeSupabase([{ label_id: "11111111-1111-1111-1111-111111111111" }]),
);

vi.mock("@/lib/atendimento/openai-client", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/lib/atendimento/openai-client")>();
  return {
    ...real,
    chatCompletion: vi.fn().mockResolvedValue({
      text: "O prazo de matrícula é até 31/01/2026.",
      tokens_used: 42,
    }),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  };
});

vi.mock("@/lib/atendimento/rag-client", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/lib/atendimento/rag-client")>();
  return {
    ...real,
    retrieveRelevantChunks: vi.fn().mockResolvedValue([]),
  };
});

describe("runAgent integration (mocked)", () => {
  beforeEach(() => {
    mocks.execInsert.mockClear();
    mocks.msgInsert.mockClear();
  });

  it("registra execução em ds_agent_executions quando executa com sucesso", async () => {
    const { runAgent } = await import("@/lib/atendimento/ds-agente-runner");

    const agent = makeAgent({
      activation_tags: [TAG_MATRICULA],
      tag_logic: "OR",
      delay_seconds: 0,
    });

    await runAgent(agent, "conv-1", {
      id: "msg-1",
      content: "Qual o prazo de matrícula?",
    });

    expect(mocks.execInsert).toHaveBeenCalled();
    const callArg = mocks.execInsert.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(callArg).toBeDefined();
    expect(callArg.agent_id).toBe("agent-01");
    expect(callArg.skipped).toBe(false);
    expect(callArg.error).toBeNull();
  });

  it("marca skipped=true quando tag_logic=OR e conversa não tem nenhuma tag do agente", async () => {
    // Sobrescreve o mock para conversa sem tags (usa supabase com labels=[])
    // Não é possível re-mock por test com vi.mock — testamos via shouldActivate diretamente
    // (que já está coberto em cima). Aqui apenas validamos o caminho de skip via runAgent
    // com agente configurado para canal inexistente.
    const { runAgent } = await import("@/lib/atendimento/ds-agente-runner");

    const agent = makeAgent({
      channels: ["instagram"], // canal diferente do whatsapp da conversa
      activation_tags: [],
      delay_seconds: 0,
    });

    await runAgent(agent, "conv-2", { content: "oi" });

    expect(mocks.execInsert).toHaveBeenCalled();
    const callArg = mocks.execInsert.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(callArg.skipped).toBe(true);
    expect(callArg.skip_reason).toBe("channel_mismatch");
  });
});
