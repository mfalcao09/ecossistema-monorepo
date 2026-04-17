import {
  CircuitOpenError,
  CredentialAccessDeniedError,
  GatewayHttpError,
} from './errors.js';
import type { GatewayErrorBody } from './types.js';

export interface HttpConfig {
  baseUrl: string;
  authToken: string;
  timeout: number;
  retry: { max: number; backoffMs: number };
  circuitBreaker: { failureThreshold: number; resetMs: number };
}

class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  constructor(
    private threshold: number,
    private resetMs: number,
  ) {}

  canCall(): boolean {
    if (Date.now() < this.openUntil) return false;
    if (this.openUntil > 0) {
      // half-open: allow probe
      this.failures = 0;
      this.openUntil = 0;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntil = 0;
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.openUntil = Date.now() + this.resetMs;
    }
  }

  isOpen(): boolean {
    return Date.now() < this.openUntil;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class ClientHttp {
  private cb: CircuitBreaker;

  constructor(private config: HttpConfig) {
    this.cb = new CircuitBreaker(
      config.circuitBreaker.failureThreshold,
      config.circuitBreaker.resetMs,
    );
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    if (!this.cb.canCall()) throw new CircuitOpenError();

    let lastError: Error = new Error('Unknown error');
    const maxAttempts = this.config.retry.max + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await sleep(this.config.retry.backoffMs * Math.pow(2, attempt - 1));
      }
      try {
        const result = await this.doRequest<T>(path, body);
        this.cb.recordSuccess();
        return result;
      } catch (e) {
        lastError = e as Error;
        // 4xx errors (except 429) are not retried but still count as failure
        if (e instanceof GatewayHttpError && e.status < 500 && e.status !== 429) {
          this.cb.recordFailure();
          throw e;
        }
      }
    }

    this.cb.recordFailure();
    throw lastError;
  }

  private async doRequest<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.authToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = (await res.json()) as T;

      if (!res.ok) {
        const errBody = data as GatewayErrorBody;
        const msg = errBody?.error?.message ?? `HTTP ${res.status}`;
        const code = errBody?.error?.code ?? 'GATEWAY_ERROR';
        if (res.status === 403) throw new CredentialAccessDeniedError(msg);
        throw new GatewayHttpError(res.status, msg, code);
      }

      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  isCircuitOpen(): boolean {
    return this.cb.isOpen();
  }
}
