import type { EmbeddingProvider } from "../types.js";

/**
 * Provider de degradação. `embed` sempre retorna `null`, forçando
 * o pipeline de retrieval a depender somente de BM25 + entity boost.
 * Usado quando `GEMINI_API_KEY` ausente ou `embeddingProvider: 'none'`.
 */
export class NullEmbeddingProvider implements EmbeddingProvider {
  public readonly name = "null";

  constructor(public readonly dimensions: number) {}

  async embed(_text: string): Promise<number[] | null> {
    return null;
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }
}
