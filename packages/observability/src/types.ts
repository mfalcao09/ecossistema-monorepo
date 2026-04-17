export interface LangfuseConfig {
  /** Langfuse host URL — passa como baseUrl para o SDK */
  baseUrl: string;
  publicKey: string;
  secretKey: string;
}

export interface ObservabilityConfig {
  langfuse: LangfuseConfig;
  businessId: string;
  service: string;
  flushOnShutdown?: boolean;
}

export interface TraceOptions {
  name: string;
  user_id?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface SpanOptions {
  name: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export interface SpanEndOptions {
  output?: unknown;
  success?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface GenerationOptions {
  name: string;
  model: string;
  input: unknown;
  metadata?: Record<string, unknown>;
}

export interface GenerationEndOptions {
  output: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface ScoreOptions {
  name: string;
  value: number;
  comment?: string;
}

export interface TraceHandle {
  id: string;
  span(options: SpanOptions): SpanHandle;
  generation(options: GenerationOptions): GenerationHandle;
  score(options: ScoreOptions): void;
  end(): void;
  getCorrelationId(): string;
}

export interface SpanHandle {
  id: string;
  end(options?: SpanEndOptions): void;
}

export interface GenerationHandle {
  id: string;
  end(options: GenerationEndOptions): void;
}
