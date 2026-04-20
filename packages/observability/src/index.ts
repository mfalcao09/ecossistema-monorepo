/**
 * @ecossistema/observability
 *
 * Wrapper TypeScript para Langfuse com defaults V9.
 * Registra traces e generations para auditoria e análise de custo por negócio.
 *
 * Uso:
 *   import { createTrace, recordGeneration, flush } from "@ecossistema/observability";
 *
 *   const trace = createTrace({ name: "erp-matricula", businessId: "kl-001", agentId: "agent-001" });
 *   recordGeneration(trace, { name: "llm-call", model: "claude-sonnet-4-6", input: messages, output: response });
 *   await flush();
 */

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface TraceOptions {
  /** Nome legível do trace (ex: "erp-matricula-flow"). */
  name: string;
  /** ID do negócio para custo/budget (ex: "kl-001", "fic-001"). */
  businessId: string;
  /** ID do agente responsável. */
  agentId: string;
  /** ID de correlação cross-service (opcional). */
  correlationId?: string;
  /** Metadados adicionais arbitrários. */
  metadata?: Record<string, unknown>;
}

export interface GenerationOpts {
  /** Nome legível da generation (ex: "chat-completion"). */
  name: string;
  /** Modelo usado (ex: "claude-sonnet-4-6"). */
  model: string;
  /** Input enviado ao modelo (messages ou prompt). */
  input: unknown;
  /** Output retornado pelo modelo. */
  output: unknown;
  /** Tokens de input. */
  promptTokens?: number;
  /** Tokens de output. */
  completionTokens?: number;
  /** Latência em ms. */
  latencyMs?: number;
  /** Metadados adicionais. */
  metadata?: Record<string, unknown>;
}

/** Handle de trace retornado por createTrace. */
export interface Trace {
  /** ID único do trace. */
  id: string;
  /** Nome do trace. */
  name: string;
  /** businessId associado. */
  businessId: string;
  /** agentId associado. */
  agentId: string;
  /** correlationId, se fornecido. */
  correlationId?: string;
  /** Timestamp de criação (ISO-8601). */
  createdAt: string;
}

/** Registro de uma generation associada a um trace. */
export interface Generation {
  /** ID único da generation. */
  id: string;
  /** ID do trace pai. */
  traceId: string;
  /** Nome da generation. */
  name: string;
  /** Modelo usado. */
  model: string;
  /** Timestamp de criação (ISO-8601). */
  createdAt: string;
}

/** Configuração do cliente Langfuse. */
export interface ObservabilityConfig {
  /** Langfuse public key. */
  publicKey: string;
  /** Langfuse secret key. */
  secretKey: string;
  /** Host do Langfuse. Default: https://cloud.langfuse.com */
  host?: string;
  /** Habilita/desabilita envio (útil para testes). Default: true */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Erros tipados
// ---------------------------------------------------------------------------

export class ObservabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObservabilityError";
  }
}

// ---------------------------------------------------------------------------
// Cliente interno
// ---------------------------------------------------------------------------

interface LangfuseEvent {
  id: string;
  type: string;
  timestamp: string;
  body: Record<string, unknown>;
}

class ObservabilityClient {
  private readonly config: Required<ObservabilityConfig>;
  private readonly queue: LangfuseEvent[] = [];

  constructor(config: ObservabilityConfig) {
    this.config = {
      host: "https://cloud.langfuse.com",
      enabled: true,
      ...config,
    };
  }

  createTrace(opts: TraceOptions): Trace {
    const trace: Trace = {
      id: generateId("tr"),
      name: opts.name,
      businessId: opts.businessId,
      agentId: opts.agentId,
      correlationId: opts.correlationId,
      createdAt: new Date().toISOString(),
    };

    this.enqueue({
      id: generateId("ev"),
      type: "trace-create",
      timestamp: trace.createdAt,
      body: {
        id: trace.id,
        name: trace.name,
        metadata: {
          businessId: opts.businessId,
          agentId: opts.agentId,
          correlationId: opts.correlationId,
          ...opts.metadata,
        },
      },
    });

    return trace;
  }

  recordGeneration(trace: Trace, opts: GenerationOpts): Generation {
    const gen: Generation = {
      id: generateId("ge"),
      traceId: trace.id,
      name: opts.name,
      model: opts.model,
      createdAt: new Date().toISOString(),
    };

    this.enqueue({
      id: generateId("ev"),
      type: "generation-create",
      timestamp: gen.createdAt,
      body: {
        id: gen.id,
        traceId: trace.id,
        name: opts.name,
        model: opts.model,
        input: opts.input,
        output: opts.output,
        usage: {
          input: opts.promptTokens,
          output: opts.completionTokens,
        },
        metadata: {
          latencyMs: opts.latencyMs,
          businessId: trace.businessId,
          ...opts.metadata,
        },
      },
    });

    return gen;
  }

  async flush(): Promise<void> {
    if (!this.config.enabled || this.queue.length === 0) return;

    const batch = this.queue.splice(0);
    const credentials = Buffer.from(
      `${this.config.publicKey}:${this.config.secretKey}`,
    ).toString("base64");

    try {
      const response = await fetch(`${this.config.host}/api/public/ingestion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({ batch }),
      });

      if (!response.ok) {
        // Recolocar na fila para retry futuro
        this.queue.unshift(...batch);
        const text = await response.text().catch(() => "");
        throw new ObservabilityError(
          `Langfuse ingestion retornou ${response.status}: ${text}`,
        );
      }
    } catch (err) {
      if (err instanceof ObservabilityError) throw err;
      // Erro de rede — recolocar na fila
      this.queue.unshift(...batch);
      throw err;
    }
  }

  private enqueue(event: LangfuseEvent): void {
    if (this.config.enabled) {
      this.queue.push(event);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;

function generateId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Singleton e funções convenientes (usam env vars)
// ---------------------------------------------------------------------------

let _defaultClient: ObservabilityClient | null = null;

function getDefaultClient(): ObservabilityClient {
  if (_defaultClient) return _defaultClient;

  const publicKey = process.env["LANGFUSE_PUBLIC_KEY"];
  const secretKey = process.env["LANGFUSE_SECRET_KEY"];

  if (!publicKey || !secretKey) {
    throw new ObservabilityError(
      "Variáveis de ambiente LANGFUSE_PUBLIC_KEY e LANGFUSE_SECRET_KEY são obrigatórias",
    );
  }

  _defaultClient = new ObservabilityClient({
    publicKey,
    secretKey,
    host: process.env["LANGFUSE_HOST"],
    enabled: process.env["LANGFUSE_ENABLED"] !== "false",
  });

  return _defaultClient;
}

/**
 * Cria um novo trace no Langfuse.
 * Usa LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY do ambiente.
 */
export function createTrace(opts: TraceOptions): Trace {
  return getDefaultClient().createTrace(opts);
}

/**
 * Registra uma generation associada a um trace.
 */
export function recordGeneration(trace: Trace, opts: GenerationOpts): Generation {
  return getDefaultClient().recordGeneration(trace, opts);
}

/**
 * Envia todos os eventos pendentes para o Langfuse.
 * Chamar antes de encerrar o processo.
 */
export async function flush(): Promise<void> {
  return getDefaultClient().flush();
}

/**
 * Cria um cliente Langfuse configurável explicitamente.
 * Útil em contextos multi-tenant ou para testes.
 */
export function createObservabilityClient(config: ObservabilityConfig): {
  createTrace: (opts: TraceOptions) => Trace;
  recordGeneration: (trace: Trace, opts: GenerationOpts) => Generation;
  flush: () => Promise<void>;
} {
  const client = new ObservabilityClient(config);
  return {
    createTrace: (opts) => client.createTrace(opts),
    recordGeneration: (trace, opts) => client.recordGeneration(trace, opts),
    flush: () => client.flush(),
  };
}
