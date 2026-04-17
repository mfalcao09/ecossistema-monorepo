import type { EmbeddingProvider, MemoryLogger } from "../types.js";

/**
 * Gemini embedding provider (gemini-embedding-001).
 *
 * Usa fetch direto — evita dependência do SDK @google/genai só por causa de embeddings.
 * Endpoint público v1beta: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`
 *
 * Request shape:
 *   { "content": { "parts": [{ "text": "..." }] },
 *     "outputDimensionality": 768,
 *     "taskType": "RETRIEVAL_DOCUMENT" }
 *
 * Response: `{ "embedding": { "values": number[] } }`
 *
 * Em qualquer erro retorna `null` — quem consome decide se vai degradar.
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  public readonly name = "gemini-embedding-001";

  private readonly endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

  constructor(
    private readonly apiKey: string,
    public readonly dimensions: number,
    private readonly logger: MemoryLogger,
  ) {}

  async embed(text: string): Promise<number[] | null> {
    if (!text || typeof text !== "string") return null;
    try {
      const res = await fetch(`${this.endpoint}?key=${encodeURIComponent(this.apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: this.dimensions,
          taskType: "RETRIEVAL_DOCUMENT",
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        this.logger.warn("[memory][gemini] embedding falhou", {
          status: res.status,
          body: body.slice(0, 500),
        });
        return null;
      }
      const json = (await res.json()) as {
        embedding?: { values?: number[] };
      };
      const values = json?.embedding?.values;
      if (!Array.isArray(values) || values.length !== this.dimensions) {
        this.logger.warn("[memory][gemini] resposta com shape inesperado", {
          got: values?.length,
          expected: this.dimensions,
        });
        return null;
      }
      return values;
    } catch (err) {
      this.logger.warn("[memory][gemini] exceção ao embeddar", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }
}
