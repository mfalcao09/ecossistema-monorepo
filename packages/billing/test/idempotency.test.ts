import { describe, expect, it } from 'vitest';
import {
  checkIdempotency,
  setIdempotency,
  supabaseIdempotencyStore,
} from '../src/idempotency.js';
import { makeFakeSupabase } from './helpers.js';

describe('checkIdempotency', () => {
  it('retorna null quando ausente', async () => {
    const sb = makeFakeSupabase({ existing: null });
    const r = await checkIdempotency(sb, 'k');
    expect(r).toBeNull();
  });

  it('retorna entry normalizada quando presente', async () => {
    const sb = makeFakeSupabase({
      existing: {
        key: 'k',
        result: { ok: true },
        created_at: '2026-04-20T10:00:00Z',
        expires_at: '2026-04-21T10:00:00Z',
      },
    });
    const r = await checkIdempotency(sb, 'k');
    expect(r).toEqual({
      key: 'k',
      result: { ok: true },
      createdAt: '2026-04-20T10:00:00Z',
      expiresAt: '2026-04-21T10:00:00Z',
    });
  });

  it('lança erro claro quando supabase retorna erro', async () => {
    const sb = makeFakeSupabase({ selectError: 'boom' });
    await expect(checkIdempotency(sb, 'k')).rejects.toThrow(/checkIdempotency.*boom/);
  });

  it('valida key obrigatória', async () => {
    const sb = makeFakeSupabase({});
    await expect(checkIdempotency(sb, '')).rejects.toThrow(/key/);
  });
});

describe('setIdempotency', () => {
  it('faz upsert com TTL default de 24h', async () => {
    let captured: any;
    const sb = makeFakeSupabase({ captureUpsert: (r) => (captured = r) });
    const before = Date.now();
    await setIdempotency(sb, 'k2', { foo: 1 });
    const after = Date.now();

    expect(captured.key).toBe('k2');
    expect(captured.result).toEqual({ foo: 1 });
    const expires = new Date(captured.expires_at).getTime();
    const created = new Date(captured.created_at).getTime();
    expect(expires - created).toBeGreaterThanOrEqual(24 * 3600 * 1000 - 100);
    expect(expires - created).toBeLessThanOrEqual(24 * 3600 * 1000 + 100);
    expect(created).toBeGreaterThanOrEqual(before);
    expect(created).toBeLessThanOrEqual(after);
  });

  it('aceita TTL customizado', async () => {
    let captured: any;
    const sb = makeFakeSupabase({ captureUpsert: (r) => (captured = r) });
    await setIdempotency(sb, 'k', { a: 1 }, 60);
    const expires = new Date(captured.expires_at).getTime();
    const created = new Date(captured.created_at).getTime();
    expect(expires - created).toBeGreaterThanOrEqual(60 * 1000 - 50);
    expect(expires - created).toBeLessThanOrEqual(60 * 1000 + 50);
  });

  it('rejeita ttl <= 0', async () => {
    const sb = makeFakeSupabase({});
    await expect(setIdempotency(sb, 'k', {}, 0)).rejects.toThrow(/ttlSeconds/);
    await expect(setIdempotency(sb, 'k', {}, -1)).rejects.toThrow(/ttlSeconds/);
  });

  it('lança erro quando upsert falha', async () => {
    const sb = makeFakeSupabase({ upsertError: 'db-off' });
    await expect(setIdempotency(sb, 'k', {})).rejects.toThrow(/setIdempotency.*db-off/);
  });

  it('valida key obrigatória', async () => {
    const sb = makeFakeSupabase({});
    await expect(setIdempotency(sb, '', {})).rejects.toThrow(/key/);
  });
});

describe('supabaseIdempotencyStore', () => {
  it('retorna adaptador compatível com IdempotencyStore', async () => {
    const sb = makeFakeSupabase({});
    const store = supabaseIdempotencyStore(sb);
    expect(typeof store.check).toBe('function');
    expect(typeof store.set).toBe('function');
    expect(await store.check('missing')).toBeNull();
  });
});
