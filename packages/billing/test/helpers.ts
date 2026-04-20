import { vi } from 'vitest';
import type { InterClientOptions } from '../src/types.js';

export function makeFakeFetch(handlers: Array<(req: Request) => Response | Promise<Response>>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    const handler = handlers.shift();
    if (!handler) throw new Error(`fake fetch: sem handler para ${url}`);
    const req = new Request(url, init);
    return handler(req);
  });
  return Object.assign(fn, { calls });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function makeInterOpts(overrides: Partial<InterClientOptions> = {}): InterClientOptions {
  return {
    clientId: 'cli-test',
    clientSecret: 'sec-test',
    certPem: '-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----',
    keyPem: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
    sandbox: true,
    ...overrides,
  };
}

/**
 * Mock mínimo de SupabaseClient cobrindo o subset que idempotency.ts usa:
 * from().select().eq().gt().maybeSingle()  e  from().upsert().select().single()
 */
export function makeFakeSupabase(opts: {
  existing?: Record<string, any> | null;
  selectError?: string;
  upsertError?: string;
  captureUpsert?: (row: any) => void;
}) {
  const { existing = null, selectError, upsertError, captureUpsert } = opts;
  const state = { lastUpsert: null as any };

  const chain = {
    select: () => chain,
    eq: () => chain,
    gt: () => chain,
    maybeSingle: async () => ({ data: existing, error: selectError ? { message: selectError } : null }),
    single: async () => ({
      data: state.lastUpsert,
      error: upsertError ? { message: upsertError } : null,
    }),
    upsert: (row: any) => {
      state.lastUpsert = row;
      captureUpsert?.(row);
      return chain;
    },
  };

  return {
    from: vi.fn(() => chain),
    __state: state,
  } as any;
}
