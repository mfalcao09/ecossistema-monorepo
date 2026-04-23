/**
 * ds-agente-runner.ts — S10 DS Agente
 *
 * Motor de execução do DS Agente:
 *   1. Verifica se o agente deve ser ativado (tags + canal + handoff guard)
 *   2. Busca chunks RAG relevantes
 *   3. Monta prompt (system + RAG + histórico + pergunta)
 *   4. Chama OpenAI
 *   5. Faz split "humanizado" se configurado
 *   6. Envia mensagem(ns) via insert em atendimento_messages (sender_type=bot)
 *   7. Registra em ds_agent_executions
 *
 * O runner é fire-and-forget: nunca lança exceção para o chamador.
 * Todos os erros são capturados, logados e gravados em ds_agent_executions.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  chatCompletion,
  splitMessageNaturally,
  type ChatMessage,
} from "@/lib/atendimento/openai-client";
import { retrieveRelevantChunks } from "@/lib/atendimento/rag-client";

// ──────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────
export interface DsAgent {
  id: string;
  account_id: string | null;
  name: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  max_history: number;
  delay_seconds: number;
  activation_tags: string[]; // atendimento_labels.id[]
  tag_logic: "AND" | "OR";
  channels: string[];
  split_messages: boolean;
  process_images: boolean;
  handoff_on_human: boolean;
  handoff_keywords: string[];
  enabled: boolean;
}

export interface ConversationSummary {
  id: string;
  inbox_channel?: string; // slug do canal (ex: 'whatsapp')
  labels?: string[]; // atendimento_labels.id[] da conversa
  last_agent_response_at?: string; // ISO timestamp do último reply humano
}

export interface IncomingMessage {
  id?: string; // atendimento_messages.id (null em playground)
  content: string;
  content_type?: string;
}

// ──────────────────────────────────────────────────────────────
// shouldActivate — check de tags e canal
// ──────────────────────────────────────────────────────────────
export function shouldActivate(
  conversation: ConversationSummary,
  agent: DsAgent,
): { active: boolean; reason: string } {
  if (!agent.enabled) {
    return { active: false, reason: "disabled" };
  }

  // Verifica canal
  if (
    agent.channels.length > 0 &&
    conversation.inbox_channel &&
    !agent.channels.includes(conversation.inbox_channel)
  ) {
    return { active: false, reason: "channel_mismatch" };
  }

  // Sem restrição de tags → ativa para qualquer conversa
  if (agent.activation_tags.length === 0) {
    return { active: true, reason: "no_tag_restriction" };
  }

  const convLabels = new Set(conversation.labels ?? []);

  if (agent.tag_logic === "AND") {
    const allPresent = agent.activation_tags.every((t) => convLabels.has(t));
    if (!allPresent) {
      return { active: false, reason: "tag_mismatch" };
    }
  } else {
    // OR
    const anyPresent = agent.activation_tags.some((t) => convLabels.has(t));
    if (!anyPresent) {
      return { active: false, reason: "tag_mismatch" };
    }
  }

  return { active: true, reason: "tag_match" };
}

// ──────────────────────────────────────────────────────────────
// shouldHandoff — human interviu recentemente OU keyword detectada
// ──────────────────────────────────────────────────────────────
export function shouldHandoff(
  agent: DsAgent,
  incomingText: string,
  lastHumanResponseAt?: string,
): { handoff: boolean; reason: string } {
  if (!agent.handoff_on_human) {
    return { handoff: false, reason: "handoff_disabled" };
  }

  // Humano respondeu nos últimos 60 min → desativa agente
  if (lastHumanResponseAt) {
    const minutesAgo =
      (Date.now() - new Date(lastHumanResponseAt).getTime()) / 60_000;
    if (minutesAgo < 60) {
      return { handoff: true, reason: "human_intervened" };
    }
  }

  // Keyword de hand-off
  const lowerText = incomingText.toLowerCase();
  const keyword = agent.handoff_keywords.find((kw) =>
    lowerText.includes(kw.toLowerCase()),
  );
  if (keyword) {
    return { handoff: true, reason: `keyword:${keyword}` };
  }

  return { handoff: false, reason: "ok" };
}

// ──────────────────────────────────────────────────────────────
// buildContext — monta histórico da conversa
// ──────────────────────────────────────────────────────────────
async function buildContext(
  conversation_id: string,
  limit: number,
): Promise<ChatMessage[]> {
  const supabase = createAdminClient();

  const { data: messages } = await supabase
    .from("atendimento_messages")
    .select("message_type, content, sender_type, created_at")
    .eq("conversation_id", conversation_id)
    .in("content_type", ["text", "template"])
    .not("content", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!messages || messages.length === 0) return [];

  // Retorna em ordem cronológica (mais antigo primeiro)
  return messages.reverse().map((m) => ({
    role: (m.sender_type === "contact"
      ? "user"
      : "assistant") as ChatMessage["role"],
    content: m.content as string,
  }));
}

// ──────────────────────────────────────────────────────────────
// sendBotMessages — insere mensagens bot em atendimento_messages
// ──────────────────────────────────────────────────────────────
async function sendBotMessages(
  conversation_id: string,
  messages: string[],
): Promise<void> {
  const supabase = createAdminClient();

  for (let i = 0; i < messages.length; i++) {
    const text = messages[i]!;
    const { error } = await supabase.from("atendimento_messages").insert({
      conversation_id,
      content: text,
      message_type: "outgoing",
      content_type: "text",
      status: "pending",
      sender_type: "bot",
    });
    if (error) {
      console.error(
        `[ds-agente-runner] Erro ao enviar mensagem bot ${i + 1}:`,
        error.message,
      );
    }
  }
}

// ──────────────────────────────────────────────────────────────
// logExecution — registra em ds_agent_executions
// ──────────────────────────────────────────────────────────────
async function logExecution(params: {
  agent_id: string;
  conversation_id: string;
  message_id?: string;
  input_text: string;
  rag_chunks: Array<{ id: string; title: string; score: number }>;
  output_text: string | null;
  output_messages: string[];
  tokens_used: number;
  latency_ms: number;
  handoff_triggered: boolean;
  handoff_reason?: string;
  skipped: boolean;
  skip_reason?: string;
  error?: string;
}): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("ds_agent_executions").insert({
    agent_id: params.agent_id,
    conversation_id: params.conversation_id,
    message_id: params.message_id ?? null,
    input_text: params.input_text,
    rag_chunks: params.rag_chunks,
    output_text: params.output_text,
    output_messages: params.output_messages,
    tokens_used: params.tokens_used,
    latency_ms: params.latency_ms,
    handoff_triggered: params.handoff_triggered,
    handoff_reason: params.handoff_reason ?? null,
    skipped: params.skipped,
    skip_reason: params.skip_reason ?? null,
    error: params.error ?? null,
  });

  if (error) {
    console.error(
      "[ds-agente-runner] Erro ao registrar execução:",
      error.message,
    );
  }
}

// ──────────────────────────────────────────────────────────────
// loadConversationSummary — carrega dados necessários do Supabase
// ──────────────────────────────────────────────────────────────
async function loadConversationSummary(
  conversation_id: string,
): Promise<ConversationSummary> {
  const supabase = createAdminClient();

  // Dados da conversa + inbox (canal)
  const { data: conv } = await supabase
    .from("atendimento_conversations")
    .select(
      `
      id,
      atendimento_inboxes!inner(channel)
    `,
    )
    .eq("id", conversation_id)
    .maybeSingle();

  // Labels da conversa
  const { data: labels } = await supabase
    .from("atendimento_conversation_labels")
    .select("label_id")
    .eq("conversation_id", conversation_id);

  // Último reply humano (sender_type = agent, não bot nem contact)
  const { data: lastHuman } = await supabase
    .from("atendimento_messages")
    .select("created_at")
    .eq("conversation_id", conversation_id)
    .eq("sender_type", "agent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const inboxData = conv?.atendimento_inboxes as { channel?: string } | null;

  return {
    id: conversation_id,
    inbox_channel: inboxData?.channel ?? undefined,
    labels: labels?.map((l) => l.label_id) ?? [],
    last_agent_response_at: lastHuman?.created_at ?? undefined,
  };
}

// ──────────────────────────────────────────────────────────────
// runAgent — ponto de entrada principal (fire-and-forget seguro)
// ──────────────────────────────────────────────────────────────
export async function runAgent(
  agent: DsAgent,
  conversation_id: string,
  incoming: IncomingMessage,
): Promise<void> {
  const startedAt = Date.now();
  const execBase = {
    agent_id: agent.id,
    conversation_id,
    message_id: incoming.id,
    input_text: incoming.content,
    rag_chunks: [] as Array<{ id: string; title: string; score: number }>,
    output_text: null as string | null,
    output_messages: [] as string[],
    tokens_used: 0,
    latency_ms: 0,
    handoff_triggered: false,
    handoff_reason: undefined as string | undefined,
    skipped: false,
    skip_reason: undefined as string | undefined,
    error: undefined as string | undefined,
  };

  try {
    // ── 1. Carrega estado da conversa ──────────────────────────
    const conversation = await loadConversationSummary(conversation_id);

    // ── 2. Verifica ativação ───────────────────────────────────
    const { active, reason: skipReason } = shouldActivate(conversation, agent);
    if (!active) {
      execBase.skipped = true;
      execBase.skip_reason = skipReason;
      execBase.latency_ms = Date.now() - startedAt;
      await logExecution(execBase);
      return;
    }

    // ── 3. Verifica hand-off ───────────────────────────────────
    const { handoff, reason: handoffReason } = shouldHandoff(
      agent,
      incoming.content,
      conversation.last_agent_response_at,
    );
    if (handoff) {
      execBase.handoff_triggered = true;
      execBase.handoff_reason = handoffReason;
      execBase.skipped = true;
      execBase.skip_reason = "handoff";
      execBase.latency_ms = Date.now() - startedAt;
      await logExecution(execBase);
      return;
    }

    // ── 4. RAG — busca chunks relevantes ──────────────────────
    const ragChunks = await retrieveRelevantChunks(
      agent.id,
      incoming.content,
      5, // top_k
      0.2, // min_score
    );
    execBase.rag_chunks = ragChunks.map((c) => ({
      id: c.id,
      title: c.title,
      score: c.score,
    }));

    // ── 5. Monta contexto RAG ──────────────────────────────────
    const ragContext =
      ragChunks.length > 0
        ? `\n\n## Base de Conhecimento FIC (use como referência prioritária):\n${ragChunks
            .map((c, i) => `[${i + 1}] ${c.title}\n${c.content}`)
            .join("\n\n")}`
        : "";

    // ── 6. Carrega histórico da conversa ───────────────────────
    const history = await buildContext(conversation_id, agent.max_history);

    // ── 7. Monta array de mensagens ────────────────────────────
    const systemPrompt = agent.system_prompt + ragContext;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: incoming.content },
    ];

    // ── 8. Chamada LLM ────────────────────────────────────────
    const { text, tokens_used } = await chatCompletion(messages, {
      model: agent.model,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
    });
    execBase.output_text = text;
    execBase.tokens_used = tokens_used;

    // ── 9. Split "humanizado" ─────────────────────────────────
    const outMessages = agent.split_messages
      ? splitMessageNaturally(text)
      : [text];
    execBase.output_messages = outMessages;

    // ── 10. Envia mensagens ───────────────────────────────────
    if (outMessages.length > 0) {
      // Delay antes de enviar (simula "digitando")
      if (agent.delay_seconds > 0) {
        await new Promise((r) => setTimeout(r, agent.delay_seconds * 1_000));
      }
      await sendBotMessages(conversation_id, outMessages);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ds-agente-runner] Erro na execução:", msg);
    execBase.error = msg;
  } finally {
    execBase.latency_ms = Date.now() - startedAt;
    await logExecution(execBase);
  }
}

// ──────────────────────────────────────────────────────────────
// runAgentForConversation — helper que carrega o agente ativo
// pelo conversation_id e o executa (usado no webhook Meta)
// ──────────────────────────────────────────────────────────────
export async function runAgentForConversation(
  conversation_id: string,
  incoming: IncomingMessage,
): Promise<void> {
  const supabase = createAdminClient();

  // Carrega agentes habilitados
  const { data: agents, error } = await supabase
    .from("ds_agents")
    .select("*")
    .eq("enabled", true);

  if (error || !agents || agents.length === 0) return;

  // Executa cada agente em paralelo (normalmente só 1 ativo, mas suporta N)
  await Promise.all(
    agents.map((agent) =>
      runAgent(agent as DsAgent, conversation_id, incoming).catch((err) =>
        console.error("[ds-agente-runner] runAgent falhou:", err),
      ),
    ),
  );
}
