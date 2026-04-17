import { Langfuse } from 'langfuse';
import { generateCorrelationId, getCorrelationId } from './correlation.js';
import type {
  ObservabilityConfig,
  TraceOptions,
  TraceHandle,
  SpanOptions,
  SpanHandle,
  SpanEndOptions,
  GenerationOptions,
  GenerationHandle,
  GenerationEndOptions,
  ScoreOptions,
} from './types.js';

class SpanHandleImpl implements SpanHandle {
  readonly id: string;

  constructor(private native: ReturnType<ReturnType<Langfuse['trace']>['span']>) {
    this.id = (native as unknown as { id: string }).id ?? generateCorrelationId();
  }

  end(options: SpanEndOptions = {}): void {
    this.native.end({
      output: options.output,
      level: options.success === false ? 'ERROR' : 'DEFAULT',
      statusMessage: options.error,
      metadata: options.metadata,
    });
  }
}

class GenerationHandleImpl implements GenerationHandle {
  readonly id: string;

  constructor(private native: ReturnType<ReturnType<Langfuse['trace']>['generation']>) {
    this.id = (native as unknown as { id: string }).id ?? generateCorrelationId();
  }

  end(options: GenerationEndOptions): void {
    this.native.end({
      output: options.output,
      usage: options.usage
        ? {
            input: options.usage.promptTokens,
            output: options.usage.completionTokens,
            total: options.usage.totalTokens,
          }
        : undefined,
      metadata: options.metadata,
    });
  }
}

class TraceHandleImpl implements TraceHandle {
  readonly id: string;
  private readonly correlationId: string;

  constructor(
    private native: ReturnType<Langfuse['trace']>,
    correlationId: string,
  ) {
    this.id = (native as unknown as { id: string }).id ?? generateCorrelationId();
    this.correlationId = correlationId;
  }

  span(options: SpanOptions): SpanHandle {
    const native = this.native.span({
      name: options.name,
      input: options.input,
      metadata: { ...options.metadata, correlation_id: this.correlationId },
    });
    return new SpanHandleImpl(native);
  }

  generation(options: GenerationOptions): GenerationHandle {
    const native = this.native.generation({
      name: options.name,
      model: options.model,
      input: options.input,
      metadata: { ...options.metadata, correlation_id: this.correlationId },
    });
    return new GenerationHandleImpl(native);
  }

  score(options: ScoreOptions): void {
    this.native.score({
      name: options.name,
      value: options.value,
      comment: options.comment,
    });
  }

  end(): void {
    this.native.update({ metadata: { ended_at: new Date().toISOString() } });
  }

  getCorrelationId(): string {
    return this.correlationId;
  }
}

export class ObservabilityClient {
  private langfuse: Langfuse;
  private readonly businessId: string;
  private readonly service: string;

  constructor(config: ObservabilityConfig) {
    this.businessId = config.businessId;
    this.service = config.service;

    this.langfuse = new Langfuse({
      baseUrl: config.langfuse.baseUrl,
      publicKey: config.langfuse.publicKey,
      secretKey: config.langfuse.secretKey,
      flushAt: 10,
      flushInterval: 5_000,
    });

    if (config.flushOnShutdown !== false) {
      process.on('beforeExit', () => {
        void this.langfuse.shutdownAsync();
      });
    }
  }

  trace(options: TraceOptions): TraceHandle {
    const correlationId = getCorrelationId() ?? generateCorrelationId();

    const native = this.langfuse.trace({
      name: options.name,
      userId: options.user_id,
      sessionId: options.session_id,
      metadata: {
        ...options.metadata,
        business_id: this.businessId,
        service: this.service,
        correlation_id: correlationId,
      },
      tags: [...(options.tags ?? []), `business:${this.businessId}`, `service:${this.service}`],
    });

    return new TraceHandleImpl(native, correlationId);
  }

  async flush(): Promise<void> {
    await this.langfuse.flushAsync();
  }

  async shutdown(): Promise<void> {
    await this.langfuse.shutdownAsync();
  }
}
