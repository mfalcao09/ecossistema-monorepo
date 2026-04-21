-- Migration: billing idempotency cache
-- Usado por @ecossistema/billing para garantir idempotência de webhooks e emissão de boletos.
-- Art. VIII (Confirmação por Baixa Real) — nunca processar o mesmo evento duas vezes.

CREATE TABLE IF NOT EXISTS idempotency_cache (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key text    UNIQUE NOT NULL,
  result      jsonb       NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idempotency_cache_key_idx
  ON idempotency_cache (idempotency_key);

CREATE INDEX IF NOT EXISTS idempotency_cache_expires_idx
  ON idempotency_cache (expires_at);

-- RLS: service-role pode ler/escrever; anon não acessa
ALTER TABLE idempotency_cache ENABLE ROW LEVEL SECURITY;

-- Cleanup via pg_cron (pode ser ativado depois via: SELECT cron.schedule(...))
-- O TTL de 7 dias é suficiente para janela de retry de webhooks do Inter.
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_cache()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM idempotency_cache WHERE expires_at < now();
$$;

COMMENT ON TABLE idempotency_cache IS
  'Cache de idempotência para operações de billing (webhooks, emissão de boletos). TTL padrão: 7 dias.';

COMMENT ON COLUMN idempotency_cache.idempotency_key IS
  'Chave única: ex. webhook:<event_id>, boleto:<alunoId>:<mesRef>';
