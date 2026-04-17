import { AsyncLocalStorage } from 'node:async_hooks';

interface CorrelationContext {
  correlationId: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export function withCorrelationId<T>(id: string, fn: () => Promise<T>): Promise<T> {
  return storage.run({ correlationId: id }, fn);
}

export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

export function getOrGenerateCorrelationId(): string {
  return getCorrelationId() ?? generateCorrelationId();
}

export function extractFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw = headers['x-correlation-id'];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}
