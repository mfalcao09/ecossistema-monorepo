-- Init do Postgres Langfuse
-- Langfuse roda suas próprias migrations via Prisma no boot do `web`.
-- Este init existe só para:
--   1. Garantir extensions (pgcrypto para UUIDs e hashing)
--   2. Log inicial de provisionamento (timestamp serve como "fingerprint" do cluster)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de auditoria do bootstrap (uso interno — Langfuse não toca aqui)
CREATE TABLE IF NOT EXISTS _ecossistema_bootstrap_log (
    id          SERIAL PRIMARY KEY,
    event       TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    meta        JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO _ecossistema_bootstrap_log (event, meta)
VALUES (
    'langfuse_postgres_initialized',
    jsonb_build_object('component', 'langfuse', 'stage', 'init')
);
