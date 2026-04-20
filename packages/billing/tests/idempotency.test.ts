import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkIdempotency, setIdempotency } from '../src/idempotency.js';

function makeMockSupabase(
  selectResult: unknown | null,
  expired = false,
): SupabaseClient {
  const futureDate = new Date(Date.now() + 86400_000).toISOString();
  const pastDate = new Date(Date.now() - 1000).toISOString();

  const record = selectResult
    ? { ...(selectResult as object), expires_at: expired ? pastDate : futureDate }
    : null;

  const singleFn = vi.fn().mockResolvedValue(
    record ? { data: record, error: null } : { data: null, error: { message: 'not found' } },
  );

  const insertFn = vi.fn().mockResolvedValue({ data: null, error: null });

  const fromFn = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: singleFn,
    insert: insertFn,
  });

  return { from: fromFn } as unknown as SupabaseClient;
}

describe('checkIdempotency', () => {
  it('retorna registro existente quando chave encontrada e não expirada', async () => {
    const existing = { idempotency_key: 'k1', result: { ok: true }, created_at: new Date().toISOString() };
    const supabase = makeMockSupabase(existing);

    const result = await checkIdempotency('k1', supabase);
    expect(result).not.toBeNull();
    expect((result as NonNullable<typeof result>).idempotency_key).toBe('k1');
  });

  it('retorna null quando chave não existe', async () => {
    const supabase = makeMockSupabase(null);
    const result = await checkIdempotency('not-found', supabase);
    expect(result).toBeNull();
  });

  it('retorna null quando registro expirado', async () => {
    const existing = { idempotency_key: 'k2', result: { ok: true }, created_at: new Date().toISOString() };
    const supabase = makeMockSupabase(existing, true /* expired */);

    const result = await checkIdempotency('k2', supabase);
    expect(result).toBeNull();
  });
});

describe('setIdempotency', () => {
  it('insere registro com TTL de 7 dias', async () => {
    const insertFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });
    const supabase = { from: fromFn } as unknown as SupabaseClient;

    await setIdempotency('k3', { nossoNumero: '001' }, supabase);

    expect(fromFn).toHaveBeenCalledWith('idempotency_cache');
    expect(insertFn).toHaveBeenCalledOnce();

    const [inserted] = insertFn.mock.calls[0] as [Record<string, unknown>][];
    expect(inserted.idempotency_key).toBe('k3');
    expect(inserted.result).toEqual({ nossoNumero: '001' });

    const expiresAt = new Date(inserted.expires_at as string).getTime();
    const expectedMin = Date.now() + 6 * 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThan(expectedMin);
  });

  it('insere resultado nulo sem lançar erro', async () => {
    const insertFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });
    const supabase = { from: fromFn } as unknown as SupabaseClient;

    await expect(setIdempotency('k4', null, supabase)).resolves.toBeUndefined();
  });
});
