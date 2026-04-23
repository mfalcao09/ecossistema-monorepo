/**
 * POST /api/atendimento/ds-agentes/[id]/execute
 *
 * Executa o agente manualmente (Playground) ou força execução em conversa.
 *
 * Body:
 *   {
 *     input_text: string,          // texto do usuário (obrigatório)
 *     conversation_id?: string,    // se omitido, modo playground (cria execução sem conversa real)
 *     dry_run?: boolean            // apenas retorna o que responderia, sem inserir mensagem
 *   }
 *
 * Resposta:
 *   {
 *     output_messages: string[],
 *     rag_chunks: Array<{id, title, score}>,
 *     tokens_used: number,
 *     latency_ms: number,
 *     handoff_triggered: boolean,
 *     skipped: boolean,
 *     skip_reason?: string
 *   }
 *
 * Permissão: ds_ai / create (executar = criar inferência)
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import {
  chatCompletion,
  splitMessageNaturally,
  type ChatMessage,
} from "@/lib/atendimento/openai-client";
import { retrieveRelevantChunks } from "@/lib/atendimento/rag-client";
import type { DsAgent } from "@/lib/atendimento/ds-agente-runner";

type RouteParams = { id: string };

const PLAYGROUND_CONVERSATION_ID = "00000000-0000-0000-0000-000000000000";

export const POST = withPermission(
  "ds_ai",
  "create",
)(async (req: NextRequest, ctx) => {
  const params =
    (await (ctx.params as Promise<RouteParams> | undefined)) ??
    ({ id: "" } as RouteParams);

  const body = (await req.json().catch(() => null)) as {
    input_text?: string;
    conversation_id?: string;
    dry_run?: boolean;
  } | null;

  if (!body?.input_text?.trim()) {
    return NextResponse.json(
      { erro: "'input_text' é obrigatório" },
      { status: 400 },
    );
  }

  // Carrega o agente
  const { data: agent, error: agentErr } = await ctx.supabase
    .from("ds_agents")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (agentErr || !agent) {
    return NextResponse.json(
      { erro: "Agente não encontrado" },
      { status: 404 },
    );
  }

  const a = agent as DsAgent;
  const inputText = body.input_text.trim();
  const dryRun = body.dry_run ?? false;
  const conversationId = body.conversation_id ?? PLAYGROUND_CONVERSATION_ID;
  const startedAt = Date.now();

  // RAG retrieval
  let ragChunks: Array<{
    id: string;
    title: string;
    content: string;
    source_url: string | null;
    score: number;
  }> = [];
  try {
    ragChunks = await retrieveRelevantChunks(a.id, inputText, 5, 0.15);
  } catch {
    // RAG não bloqueia — continua sem contexto
  }

  const ragContext =
    ragChunks.length > 0
      ? `\n\n## Base de Conhecimento FIC:\n${ragChunks
          .map((c, i) => `[${i + 1}] ${c.title}\n${c.content}`)
          .join("\n\n")}`
      : "";

  const messages: ChatMessage[] = [
    { role: "system", content: a.system_prompt + ragContext },
    { role: "user", content: inputText },
  ];

  let outputText = "";
  let tokensUsed = 0;
  let outputMessages: string[] = [];
  let execError: string | undefined;

  try {
    const result = await chatCompletion(messages, {
      model: a.model,
      temperature: a.temperature,
      max_tokens: a.max_tokens,
    });
    outputText = result.text;
    tokensUsed = result.tokens_used;
    outputMessages = a.split_messages
      ? splitMessageNaturally(outputText)
      : [outputText];
  } catch (err) {
    execError = err instanceof Error ? err.message : String(err);
  }

  const latencyMs = Date.now() - startedAt;

  // Log da execução (mesmo em playground, mas sem message_id)
  if (!dryRun) {
    await ctx.supabase.from("ds_agent_executions").insert({
      agent_id: a.id,
      conversation_id: conversationId,
      message_id: null,
      input_text: inputText,
      rag_chunks: ragChunks.map((c) => ({
        id: c.id,
        title: c.title,
        score: c.score,
      })),
      output_text: outputText || null,
      output_messages: outputMessages,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
      handoff_triggered: false,
      skipped: false,
      error: execError ?? null,
    });
  }

  return NextResponse.json({
    output_messages: outputMessages,
    output_text: outputText,
    rag_chunks: ragChunks.map((c) => ({
      id: c.id,
      title: c.title,
      score: c.score,
    })),
    tokens_used: tokensUsed,
    latency_ms: latencyMs,
    handoff_triggered: false,
    skipped: false,
    error: execError ?? null,
  });
});
