import type { SupabaseClient } from '@supabase/supabase-js';
import type { IdempotencyEntry, IdempotencyStore } from './types.js';

/**
 * Cache de idempotência genérico em `idempotency_cache` (Supabase ECOSYSTEM).
 * Schema esperado (ver migration 20260420000000_idempotency_cache.sql):
 *
 *   key         text primary key
 *   result      jsonb
 *   created_at  timestamptz default now()
 *   expires_at  timestamptz not null
 *
 * RLS: service_role apenas. Use o client com service key.
 *
 * Semântica:
 * - `checkIdempotency` retorna a entry se existir e não estiver expirada.
 * - `setIdempotency` faz upsert com `expires_at = now + ttlSeconds`.
 *   TTL default 24h — alinhado com webhook_idempotency (SC-10).
 */

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const TABLE = 'idempotency_cache';

export async function checkIdempotency(
  supabase: SupabaseClient,
  key: string,
): Promise<IdempotencyEntry | null> {
  if (!key) throw new Error('checkIdempotency: key obrigatória');

  const { data, error } = await supabase
    .from(TABLE)
    .select('key, result, created_at, expires_at')
    .eq('key', key)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`checkIdempotency: ${error.message}`);
  if (!data) return null;

  return {
    key: data.key,
    result: data.result,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

export async function setIdempotency(
  supabase: SupabaseClient,
  key: string,
  result: unknown,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<IdempotencyEntry> {
  if (!key) throw new Error('setIdempotency: key obrigatória');
  if (ttlSeconds <= 0) throw new Error('setIdempotency: ttlSeconds deve ser > 0');

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const row = {
    key,
    result: result as object,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: 'key' })
    .select('key, result, created_at, expires_at')
    .single();

  if (error) throw new Error(`setIdempotency: ${error.message}`);

  return {
    key: data.key,
    result: data.result,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

/**
 * Adaptador para o contrato `IdempotencyStore`. Útil para injeção em funções
 * que não querem depender de SupabaseClient diretamente.
 */
export function supabaseIdempotencyStore(supabase: SupabaseClient): IdempotencyStore {
  return {
    check: (key) => checkIdempotency(supabase, key),
    set: (key, result, ttl) => setIdempotency(supabase, key, result, ttl),
  };
}
