import type { EmbeddingProvider } from "../../src/types.js";

/**
 * Embedder determinístico — produz vector(768) com hash simples do texto.
 * Nunca retorna null. Útil para testes que exigem similaridade previsível.
 */
export class FixedEmbedder implements EmbeddingProvider {
  public readonly name = "fixed";
  public readonly dimensions = 768;

  async embed(text: string): Promise<number[]> {
    const vec = new Array<number>(this.dimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
      const idx = text.charCodeAt(i) % this.dimensions;
      vec[idx] += 1;
    }
    // normaliza
    const mag = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
    return vec.map((x) => x / mag);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/** Embedder que sempre retorna null — simula provider indisponível. */
export class NullEmbedder implements EmbeddingProvider {
  public readonly name = "null-test";
  public readonly dimensions = 768;
  async embed(): Promise<null> {
    return null;
  }
  async isAvailable(): Promise<boolean> {
    return false;
  }
}
