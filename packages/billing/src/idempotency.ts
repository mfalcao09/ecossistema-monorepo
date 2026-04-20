import type { SupabaseClient } from '@supabase/supabase-js';
import type { IdempotencyRecord } from './types.js';

const TABLE = 'idempotency_cache';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

/**
 * Busca resultado cacheado para a chave. Retorna null se não existir ou expirado.
 */
export async function checkIdempotency(
  key: string,
  supabase: SupabaseClient,
): Promise<IdempotencyRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('idempotency_key, result, expires_at, created_at')
    .eq('idempotency_key', key)
    .single();

  if (error || !data) return null;

  // Checa expiração no cliente (DB também tem check via RLS/query, mas garantimos aqui)
  if (new Date(data.expires_at) < new Date()) return null;

  return data as IdempotencyRecord;
}

/**
 * Persiste resultado para a chave. Ignora conflito (upsert silencioso).
 */
export async function setIdempotency(
  key: string,
  result: unknown,
  supabase: SupabaseClient,
): Promise<void> {
  await supabase.from(TABLE).insert({
    idempotency_key: key,
    result,
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
  });
}
