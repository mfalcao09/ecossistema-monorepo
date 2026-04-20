import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LiteLLMClient,
  LiteLLMError,
  chat,
  chatStream,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// LiteLLMClient — chat
// ---------------------------------------------------------------------------

describe("LiteLLMClient.chat", () => {
  const config = {
    baseUrl: "https://litellm.up.railway.app",
    apiKey: "sk-master",
  };

  it("lança erro se baseUrl estiver vazio", () => {
    expect(() => new LiteLLMClient({ baseUrl: "", apiKey: "x" })).toThrow(LiteLLMError);
  });

  it("lança erro se apiKey estiver vazio", () => {
    expect(() => new LiteLLMClient({ baseUrl: "https://x.com", apiKey: "" })).toThrow(LiteLLMError);
  });

  it("retorna ChatResponse em caso de sucesso", async () => {
    const mockResponse = {
      choices: [{ message: { content: "Olá, Marcelo!" } }],
      model: "claude-sonnet-4-6",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const client = new LiteLLMClient(config);
    const result = await client.chat([{ role: "user", content: "Olá!" }]);

    expect(result.content).toBe("Olá, Marcelo!");
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.usage.total_tokens).toBe(15);
  });

  it("usa modelo default claude-sonnet-4-6 se não especificado", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
        model: "claude-sonnet-4-6",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    } as Response);

    const client = new LiteLLMClient(config);
    await client.chat([{ role: "user", content: "teste" }]);

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.model).toBe("claude-sonnet-4-6");
  });

  it("envia x-business-id se businessId fornecido", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
        model: "x",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    } as Response);

    const client = new LiteLLMClient(config);
    await client.chat([{ role: "user", content: "x" }], { businessId: "kl-001" });

    const headers = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    expect(headers["x-business-id"]).toBe("kl-001");
  });

  it("lança LiteLLMError em caso de falha HTTP", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limit",
    } as Response);

    const client = new LiteLLMClient(config);
    const err = await client
      .chat([{ role: "user", content: "x" }])
      .catch((e) => e as LiteLLMError);

    expect(err).toBeInstanceOf(LiteLLMError);
    expect(err.statusCode).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// LiteLLMClient — chatStream
// ---------------------------------------------------------------------------

describe("LiteLLMClient.chatStream", () => {
  const config = {
    baseUrl: "https://litellm.up.railway.app",
    apiKey: "sk-master",
  };

  it("yield chunks de SSE", async () => {
    // Cada evento SSE em uma linha separada (padrão real do protocolo)
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"Olá"}}]}',
      'data: {"choices":[{"delta":{"content":", mundo"}}]}',
      "data: [DONE]",
      "", // trailing newline
    ].join("\n");

    const encoder = new TextEncoder();
    // Entrega tudo de uma vez para evitar problemas de chunk boundary
    const encoded = encoder.encode(sseLines);

    let called = false;
    const mockReader = {
      read: vi.fn(async () => {
        if (called) return { done: true, value: undefined };
        called = true;
        return { done: false, value: encoded };
      }),
      releaseLock: vi.fn(),
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response);

    const client = new LiteLLMClient(config);
    const chunks: string[] = [];
    for await (const chunk of client.chatStream([{ role: "user", content: "oi" }])) {
      chunks.push(chunk);
    }

    const result = chunks.join("");
    expect(result).toContain("Olá");
    expect(result).toContain(", mundo");
  });
});

// ---------------------------------------------------------------------------
// Funções convenientes
// ---------------------------------------------------------------------------

describe("chat (função conveniente)", () => {
  beforeEach(() => {
    process.env["LITELLM_BASE_URL"] = "https://litellm.railway.app";
    process.env["LITELLM_API_KEY"] = "sk-test";
  });

  afterEach(() => {
    delete process.env["LITELLM_BASE_URL"];
    delete process.env["LITELLM_API_KEY"];
  });

  it("retorna resposta usando env vars", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
        model: "claude-sonnet-4-6",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    } as Response);

    const result = await chat([{ role: "user", content: "teste" }]);
    expect(result.content).toBe("ok");
  });

  it("lança erro se LITELLM_BASE_URL não definida", async () => {
    delete process.env["LITELLM_BASE_URL"];
    await expect(chat([{ role: "user", content: "x" }])).rejects.toThrow(LiteLLMError);
  });
});

describe("chatStream (função conveniente)", () => {
  beforeEach(() => {
    process.env["LITELLM_BASE_URL"] = "https://litellm.railway.app";
    process.env["LITELLM_API_KEY"] = "sk-test";
  });

  afterEach(() => {
    delete process.env["LITELLM_BASE_URL"];
    delete process.env["LITELLM_API_KEY"];
  });

  it("lança erro se LITELLM_BASE_URL não definida", async () => {
    delete process.env["LITELLM_BASE_URL"];
    const gen = chatStream([{ role: "user", content: "x" }]);
    await expect(gen.next()).rejects.toThrow(LiteLLMError);
  });
});
