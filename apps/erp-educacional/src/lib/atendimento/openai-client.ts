/**
 * openai-client.ts — S10 DS Agente
 *
 * Wrapper server-only do SDK `openai` npm (não @ai-sdk/openai).
 * - Busca OPENAI_API_KEY via env diretamente (ou via @ecossistema/credentials se disponível).
 * - Falha rápido se a chave não estiver configurada.
 *
 * Funções exportadas:
 *   getOpenAIClient()                  → instância singleton do OpenAI SDK
 *   generateEmbedding(text)            → number[] (1536 dim, text-embedding-3-small)
 *   chatCompletion(messages, params)   → string (conteúdo da resposta)
 *   splitMessageNaturally(text, max)   → string[] (quebra estilo digitação humana)
 */

import "server-only";
import OpenAI from "openai";

// ──────────────────────────────────────────────────────────────
// Singleton do cliente OpenAI
// ──────────────────────────────────────────────────────────────
let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[openai-client] OPENAI_API_KEY não configurada. Cadastre via vault ECOSYSTEM (P-130) e sete como env var.",
    );
  }

  _client = new OpenAI({ apiKey });
  return _client;
}

// ──────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionParams {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

// ──────────────────────────────────────────────────────────────
// Embedding
// ──────────────────────────────────────────────────────────────
/**
 * Gera embedding vetorial usando `text-embedding-3-small` (1536 dim).
 * Custo: ~$0.00002 / 1k tokens.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();

  // Trunca se muito longo (limite do modelo: 8191 tokens ≈ ~32k chars)
  const input = text.slice(0, 30_000);

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input,
    dimensions: 1536,
  });

  return response.data[0]!.embedding;
}

// ──────────────────────────────────────────────────────────────
// Chat Completion
// ──────────────────────────────────────────────────────────────
/**
 * Executa uma chat completion e retorna o texto da resposta.
 * Custo médio com gpt-4o-mini: ~$0.005–0.015 por resposta de 200 tokens.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  params: ChatCompletionParams = {},
): Promise<{ text: string; tokens_used: number }> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: params.model ?? "gpt-4o-mini",
    messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens ?? 200,
  });

  const choice = response.choices[0];
  const text = choice?.message?.content?.trim() ?? "";
  const tokens_used = response.usage?.total_tokens ?? 0;

  return { text, tokens_used };
}

// ──────────────────────────────────────────────────────────────
// Split de mensagens (estilo digitação humana)
// ──────────────────────────────────────────────────────────────
/**
 * Quebra uma resposta longa em 2-3 mensagens menores, como um atendente faria.
 * Critérios:
 *   1. Separa em parágrafos (dupla quebra de linha)
 *   2. Agrupa parágrafos pequenos para não fragmentar demais
 *   3. Limita a `maxParts` mensagens (default 3)
 *
 * Se o texto for curto (≤ maxCharsForSingle), retorna array com 1 item.
 */
export function splitMessageNaturally(
  text: string,
  maxParts = 3,
  maxCharsForSingle = 280,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxCharsForSingle) return [trimmed];

  // Tenta separar por parágrafo
  const paragraphs = trimmed
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    // Sem parágrafos — divide por frases terminadas em ". " ou "! " ou "? "
    const sentences = trimmed
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length <= 1) return [trimmed];

    // Agrupa frases em até maxParts chunks de tamanho similar
    return groupIntoChunks(sentences, maxParts);
  }

  // Agrupa parágrafos em até maxParts
  return groupIntoChunks(paragraphs, maxParts);
}

function groupIntoChunks(parts: string[], maxParts: number): string[] {
  if (parts.length <= maxParts) return parts;

  const chunkSize = Math.ceil(parts.length / maxParts);
  const result: string[] = [];

  for (let i = 0; i < parts.length; i += chunkSize) {
    result.push(parts.slice(i, i + chunkSize).join("\n\n"));
  }

  return result;
}
