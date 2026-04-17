import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiEmbeddingProvider } from "../../src/embeddings/gemini.js";
import { NullEmbeddingProvider } from "../../src/embeddings/fallback.js";

const silentLogger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

describe("GeminiEmbeddingProvider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    silentLogger.warn.mockClear();
    silentLogger.error.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("retorna embedding válido quando API responde OK", async () => {
    const dims = 768;
    const mockValues = Array.from({ length: dims }, (_, i) => i / dims);
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        async json() {
          return { embedding: { values: mockValues } };
        },
      }) as unknown as Response,
    ) as typeof fetch;

    const p = new GeminiEmbeddingProvider("fake-key", dims, silentLogger);
    const out = await p.embed("hello");
    expect(out).not.toBeNull();
    expect(out!.length).toBe(dims);
  });

  it("retorna null e loga se status != ok", async () => {
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: false,
        status: 500,
        async text() {
          return "erro";
        },
      }) as unknown as Response,
    ) as typeof fetch;
    const p = new GeminiEmbeddingProvider("fake-key", 768, silentLogger);
    const out = await p.embed("hello");
    expect(out).toBeNull();
    expect(silentLogger.warn).toHaveBeenCalled();
  });

  it("retorna null se dimensão diverge", async () => {
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        async json() {
          return { embedding: { values: [1, 2, 3] } };
        },
      }) as unknown as Response,
    ) as typeof fetch;
    const p = new GeminiEmbeddingProvider("fake-key", 768, silentLogger);
    expect(await p.embed("x")).toBeNull();
  });

  it("captura exceção de rede e retorna null", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const p = new GeminiEmbeddingProvider("fake-key", 768, silentLogger);
    expect(await p.embed("x")).toBeNull();
  });

  it("retorna null para input vazio sem chamar fetch", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const p = new GeminiEmbeddingProvider("fake-key", 768, silentLogger);
    expect(await p.embed("")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("isAvailable reflete presença de apiKey", async () => {
    expect(await new GeminiEmbeddingProvider("key", 768, silentLogger).isAvailable()).toBe(
      true,
    );
    expect(await new GeminiEmbeddingProvider("", 768, silentLogger).isAvailable()).toBe(
      false,
    );
  });
});

describe("NullEmbeddingProvider", () => {
  it("sempre retorna null", async () => {
    const p = new NullEmbeddingProvider(768);
    expect(await p.embed("anything")).toBeNull();
  });
  it("isAvailable é false", async () => {
    expect(await new NullEmbeddingProvider(768).isAvailable()).toBe(false);
  });
});
