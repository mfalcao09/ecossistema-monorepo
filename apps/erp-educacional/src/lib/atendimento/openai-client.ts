/**
 * openai-client.ts — @deprecated em favor de `gemini-client.ts`
 *
 * Re-exporta o cliente Gemini com mesma interface. Decisão P-130 (2026-04-22):
 * Gemini 3.1 Pro como provedor LLM canônico para DS Agente. Este arquivo é
 * um shim de compatibilidade para imports antigos — será removido quando
 * nada mais fora de S10 referenciar.
 *
 * @deprecated Use `@/lib/atendimento/gemini-client` diretamente.
 */

export {
  getGeminiClient as getOpenAIClient,
  generateEmbedding,
  chatCompletion,
  splitMessageNaturally,
  EMBEDDING_DIMENSIONS,
  type ChatMessage,
  type ChatCompletionParams,
} from "./gemini-client";
