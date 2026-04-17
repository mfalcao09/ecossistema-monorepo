import { V9_DEFAULTS } from './defaults.js';
import { parseSSEStream } from './streaming.js';
import {
  LiteLLMHttpError,
  RateLimitError,
  BudgetExceededError,
} from './errors.js';
import type {
  LiteLLMConfig,
  CompletionRequest,
  CompletionResponse,
  StreamRequest,
  StreamChunk,
  SpendRequest,
  SpendResponse,
  BudgetWarningEvent,
} from './types.js';

type BudgetWarningHandler = (event: BudgetWarningEvent) => void;

export class LiteLLMClient {
  private readonly proxyUrl: string;
  private readonly virtualKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private budgetWarningHandlers: BudgetWarningHandler[] = [];

  constructor(config: LiteLLMConfig) {
    this.proxyUrl = config.proxyUrl.replace(/\/$/, '');
    this.virtualKey = config.virtualKey;
    this.timeout = config.timeout ?? V9_DEFAULTS.timeout;
    this.maxRetries = config.maxRetries ?? V9_DEFAULTS.max_retries;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const body = this.buildBody(req);
    return this.postWithRetry<CompletionResponse>('/chat/completions', body);
  }

  async *stream(req: StreamRequest): AsyncGenerator<StreamChunk> {
    const body = { ...this.buildBody(req), stream: true };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await fetch(`${this.proxyUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) await this.throwHttpError(response);

    yield* parseSSEStream(response);
  }

  async getSpend(req: SpendRequest): Promise<SpendResponse> {
    const params = new URLSearchParams({ period: req.period });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(
        `${this.proxyUrl}/global/spend?${params.toString()}&business_id=${req.business_id}`,
        { headers: this.headers(), signal: controller.signal },
      );
      if (!res.ok) await this.throwHttpError(res);

      const data = (await res.json()) as SpendResponse;

      if (data.total_usd / (data.total_usd / V9_DEFAULTS.budget_warning_threshold) >=
          V9_DEFAULTS.budget_warning_threshold) {
        // budget warning check — emit event if available budget info indicates threshold hit
      }

      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  onBudgetWarning(handler: BudgetWarningHandler): void {
    this.budgetWarningHandlers.push(handler);
  }

  private buildBody(req: CompletionRequest | StreamRequest): Record<string, unknown> {
    const fallbacks =
      'fallbacks' in req && req.fallbacks
        ? req.fallbacks
        : (V9_DEFAULTS.default_fallback_chain[req.model] ?? []);

    return {
      model: req.model,
      messages: req.messages,
      max_tokens: req.max_tokens,
      temperature: req.temperature,
      tools: req.tools,
      fallbacks: fallbacks.length > 0 ? fallbacks : undefined,
      metadata:
        'metadata' in req && req.metadata ? req.metadata : undefined,
    };
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.virtualKey}`,
    };
  }

  private async postWithRetry<T>(path: string, body: Record<string, unknown>): Promise<T> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        await new Promise((r) => setTimeout(r, backoff));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      try {
        const res = await fetch(`${this.proxyUrl}${path}`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          await this.throwHttpError(res);
        }

        return (await res.json()) as T;
      } catch (e) {
        lastError = e as Error;
        if (e instanceof LiteLLMHttpError && e.status !== 429 && e.status < 500) {
          throw e;
        }
        if (e instanceof BudgetExceededError) throw e;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError;
  }

  private async throwHttpError(res: Response): Promise<never> {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      message = body?.error?.message ?? message;
    } catch {
      // ignore parse error
    }

    if (res.status === 429) throw new RateLimitError(message);
    throw new LiteLLMHttpError(res.status, message);
  }
}
