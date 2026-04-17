import type { EmbeddingProvider, MemoryConfig, MemoryLogger } from "../types.js";
import { GeminiEmbeddingProvider } from "./gemini.js";
import { NullEmbeddingProvider } from "./fallback.js";

export function resolveEmbeddingProvider(
  config: MemoryConfig,
  logger: MemoryLogger,
): EmbeddingProvider {
  const dims = config.embeddingDimensions ?? 768;
  const choice = config.embeddingProvider ?? "gemini";

  if (choice === "none") {
    return new NullEmbeddingProvider(dims);
  }
  if (typeof choice === "object") {
    // provider custom fornecido pelo consumidor
    if (choice.dimensions !== dims) {
      logger.warn(
        "[memory][embeddings] provider custom retorna dim != schema",
        { providerDims: choice.dimensions, schemaDims: dims },
      );
    }
    return choice;
  }
  if (choice === "gemini") {
    const apiKey = config.geminiApiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn(
        "[memory][embeddings] GEMINI_API_KEY não configurada — caindo para NullEmbeddingProvider (degraded dense search)",
      );
      return new NullEmbeddingProvider(dims);
    }
    return new GeminiEmbeddingProvider(apiKey, dims, logger);
  }
  // exhaustive fallback
  return new NullEmbeddingProvider(dims);
}
