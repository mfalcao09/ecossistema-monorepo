/**
 * @ecossistema/litellm-client
 *
 * Wrapper TypeScript para o LiteLLM proxy Railway.
 * Suporta chat síncrono e streaming, com budget tracking por businessId.
 *
 * Uso:
 *   import { chat, chatStream, LiteLLMClient } from "@ecossistema/litellm-client";
 *
 *   // Função conveniente (usa LITELLM_BASE_URL env var)
 *   const response = await chat([{ role: "user", content: "Olá!" }]);
 *
 *   // Streaming
 *   for await (const chunk of chatStream(messages)) { process.stdout.write(chunk); }
 *
 *   // Cliente configurável
 *   const client = new LiteLLMClient({ baseUrl: "...", apiKey: "..." });
 */

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type MessageRole = "system" | "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ChatOptions {
  /** Modelo a usar. Default: "claude-sonnet-4-6" */
  model?: string;
  /** ID do negócio para budget tracking (ex: "kl-001", "fic-001"). */
  businessId?: string;
  /** Máximo de tokens na resposta. */
  maxTokens?: number;
  /** Temperatura (0-1). Default: 0.7 */
  temperature?: number;
}

export interface ChatResponse {
  /** Texto gerado pelo modelo. */
  content: string;
  /** Modelo efetivamente usado. */
  model: string;
  /** Tokens consumidos (input + output). */
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Configuração do cliente. */
export interface LiteLLMClientConfig {
  /** URL base do proxy LiteLLM (ex: https://litellm-xxx.up.railway.app). */
  baseUrl: string;
  /** API key do proxy (LITELLM_MASTER_KEY no Railway). */
  apiKey: string;
  /** Modelo default. Default: "claude-sonnet-4-6" */
  defaultModel?: string;
}

// ---------------------------------------------------------------------------
// Erros tipados
// ---------------------------------------------------------------------------

export class LiteLLMError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "LiteLLMError";
  }
}

// ---------------------------------------------------------------------------
// Cliente principal
// ---------------------------------------------------------------------------

export class LiteLLMClient {
  private readonly config: Required<LiteLLMClientConfig>;

  constructor(config: LiteLLMClientConfig) {
    if (!config.baseUrl) throw new LiteLLMError("baseUrl é obrigatório");
    if (!config.apiKey) throw new LiteLLMError("apiKey é obrigatório");
    this.config = {
      ...config,
      defaultModel: config.defaultModel ?? "claude-sonnet-4-6",
    };
  }

  /**
   * Envia mensagens e retorna resposta completa.
   */
  async chat(messages: Message[], options: ChatOptions = {}): Promise<ChatResponse> {
    const body = this.buildRequestBody(messages, options, false);

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(options.businessId),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new LiteLLMError(
        `LiteLLM proxy retornou ${response.status}: ${text}`,
        response.status,
      );
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      content: data.choices[0]?.message.content ?? "",
      model: data.model,
      usage: data.usage,
    };
  }

  /**
   * Envia mensagens e retorna um AsyncIterable de chunks de texto (SSE).
   */
  async *chatStream(messages: Message[], options: ChatOptions = {}): AsyncIterable<string> {
    const body = this.buildRequestBody(messages, options, true);

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(options.businessId),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new LiteLLMError(
        `LiteLLM proxy retornou ${response.status}: ${text}`,
        response.status,
      );
    }

    if (!response.body) throw new LiteLLMError("Resposta sem body para streaming");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") return;

          try {
            const parsed = JSON.parse(payload) as {
              choices: Array<{ delta?: { content?: string } }>;
            };
            const chunk = parsed.choices[0]?.delta?.content;
            if (chunk) yield chunk;
          } catch {
            // linha malformada — ignorar
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // -------------------------------------------------------------------------
  // Helpers privados
  // -------------------------------------------------------------------------

  private buildHeaders(businessId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };
    if (businessId) {
      headers["x-business-id"] = businessId;
    }
    return headers;
  }

  private buildRequestBody(
    messages: Message[],
    options: ChatOptions,
    stream: boolean,
  ): Record<string, unknown> {
    return {
      model: options.model ?? this.config.defaultModel,
      messages,
      stream,
      ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
    };
  }
}

// ---------------------------------------------------------------------------
// Funções convenientes (usam env vars)
// ---------------------------------------------------------------------------

function createDefaultClient(): LiteLLMClient {
  const baseUrl = process.env["LITELLM_BASE_URL"];
  const apiKey = process.env["LITELLM_API_KEY"] ?? "sk-ecossistema";

  if (!baseUrl) {
    throw new LiteLLMError("Variável de ambiente LITELLM_BASE_URL é obrigatória");
  }

  return new LiteLLMClient({ baseUrl, apiKey });
}

/**
 * Envia mensagens e retorna resposta completa.
 * Usa LITELLM_BASE_URL e LITELLM_API_KEY do ambiente.
 */
export async function chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
  return createDefaultClient().chat(messages, options);
}

/**
 * Envia mensagens e retorna um AsyncIterable de chunks de texto.
 * Usa LITELLM_BASE_URL e LITELLM_API_KEY do ambiente.
 */
export async function* chatStream(
  messages: Message[],
  options?: ChatOptions,
): AsyncIterable<string> {
  yield* createDefaultClient().chatStream(messages, options);
}
