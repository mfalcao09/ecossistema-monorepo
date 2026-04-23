/**
 * gemini-client.ts — S10 DS Agente (provedor Gemini via Google Generative AI)
 *
 * Wrapper server-only do SDK `@google/genai` — substitui `openai-client.ts`
 * após decisão P-130 (2026-04-22): Gemini 3.1 Pro para chat + text-embedding-004
 * para embeddings (768 dim). Chave Google já no vault ECOSYSTEM.
 *
 * Interface mantém mesmas funções que openai-client.ts para swap transparente:
 *   generateEmbedding(text)            → number[] (768 dim, text-embedding-004)
 *   chatCompletion(messages, params)   → { text, tokens_used }
 *   splitMessageNaturally(text, max)   → string[] (estilo digitação humana)
 *
 * Futura troca para Anthropic Claude: substituir só este módulo (Etapa 4-E).
 */

import "server-only";
import { GoogleGenAI, type Content } from "@google/genai";

// ──────────────────────────────────────────────────────────────
// Configuração canônica (env-overridable)
// ──────────────────────────────────────────────────────────────
const DEFAULT_CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-pro"; // "gemini-3.1-pro" quando disponível
const DEFAULT_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004";
export const EMBEDDING_DIMENSIONS = 768;

// ──────────────────────────────────────────────────────────────
// Singleton do cliente Google GenAI
// ──────────────────────────────────────────────────────────────
let _client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (_client) return _client;

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[gemini-client] GEMINI_API_KEY (ou GOOGLE_API_KEY) não configurada. Cadastre via vault ECOSYSTEM (P-130) e sete como env var.",
    );
  }

  _client = new GoogleGenAI({ apiKey });
  return _client;
}

// ──────────────────────────────────────────────────────────────
// Tipos (compatíveis com openai-client.ts)
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
// Embedding (text-embedding-004 — 768 dim)
// ──────────────────────────────────────────────────────────────
/**
 * Gera embedding vetorial usando `text-embedding-004` (768 dim).
 * Custo: grátis até quota; após, preços públicos Gemini.
 *
 * ATENÇÃO: coluna `ds_agent_knowledge.embedding` é `vector(768)`.
 * Ajustar migration se trocar de modelo.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getGeminiClient();

  // Limite da API: ~2048 tokens por request; trunca com margem.
  const input = text.slice(0, 30_000);

  const response = await client.models.embedContent({
    model: DEFAULT_EMBEDDING_MODEL,
    contents: input,
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!embedding || embedding.length === 0) {
    throw new Error("[gemini-client] resposta de embedding vazia");
  }

  return embedding;
}

// ──────────────────────────────────────────────────────────────
// Chat Completion (Gemini 3.1 Pro — configurável via env)
// ──────────────────────────────────────────────────────────────

/**
 * Converte histórico no formato OpenAI-like para Content[] do Gemini.
 * - Roles "system" viram instrução separada (systemInstruction)
 * - Roles "user"/"assistant" mapeiam para "user"/"model" do Gemini
 */
function splitSystemAndHistory(messages: ChatMessage[]): {
  systemInstruction: string | undefined;
  contents: Content[];
} {
  const systemParts: string[] = [];
  const contents: Content[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  return {
    systemInstruction: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    contents,
  };
}

/**
 * Executa uma chat completion via Gemini e retorna o texto da resposta.
 * Custo médio com gemini-2.5-pro: grátis até quota (API-Key free tier).
 */
export async function chatCompletion(
  messages: ChatMessage[],
  params: ChatCompletionParams = {},
): Promise<{ text: string; tokens_used: number }> {
  const client = getGeminiClient();
  const { systemInstruction, contents } = splitSystemAndHistory(messages);

  const response = await client.models.generateContent({
    model: params.model ?? DEFAULT_CHAT_MODEL,
    contents,
    config: {
      systemInstruction,
      temperature: params.temperature ?? 0.7,
      maxOutputTokens: params.max_tokens ?? 200,
    },
  });

  const text = response.text?.trim() ?? "";
  // usageMetadata traz promptTokenCount, candidatesTokenCount, totalTokenCount
  const tokens_used = response.usageMetadata?.totalTokenCount ?? 0;

  return { text, tokens_used };
}

// ──────────────────────────────────────────────────────────────
// Split de mensagens (idêntico ao openai-client.ts — sem dependência externa)
// ──────────────────────────────────────────────────────────────
/**
 * Quebra uma resposta longa em 2-3 mensagens menores, como um atendente faria.
 */
export function splitMessageNaturally(
  text: string,
  maxParts = 3,
  maxCharsForSingle = 280,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxCharsForSingle) return [trimmed];

  const paragraphs = trimmed
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    const sentences = trimmed
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length <= 1) return [trimmed];
    return groupIntoChunks(sentences, maxParts);
  }

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

// ──────────────────────────────────────────────────────────────
// Alias de compatibilidade (para migração gradual)
// ──────────────────────────────────────────────────────────────
/**
 * @deprecated Use `getGeminiClient()`. Mantido apenas enquanto
 * `openai-client.ts` é removido em Etapa 4-E.
 */
export const getOpenAIClient = getGeminiClient;
