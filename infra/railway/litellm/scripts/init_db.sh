#!/usr/bin/env bash
# ============================================================
# LiteLLM — bootstrap de schema no Supabase ECOSYSTEM
# ------------------------------------------------------------
# Rodar UMA VEZ após o primeiro boot do proxy.
# LiteLLM auto-cria as tabelas no schema "public"; movemos para
# "litellm_proxy" para não poluir o schema canônico V9.
#
# Pré-requisitos:
#   - psql client instalado
#   - DATABASE_URL exportada (postgres do Supabase ECOSYSTEM)
#   - Proxy já bootou pelo menos uma vez (para criar as tabelas)
# ============================================================
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL não definida — exporte antes de rodar}"

echo "==> criando schema litellm_proxy se não existir"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA IF NOT EXISTS litellm_proxy;"

echo "==> movendo tabelas LiteLLM para schema litellm_proxy"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename LIKE 'LiteLLM_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I SET SCHEMA litellm_proxy;', tbl);
    RAISE NOTICE 'moved public.% → litellm_proxy.%', tbl, tbl;
  END LOOP;
END$$;
SQL

echo "==> listando tabelas em litellm_proxy"
psql "$DATABASE_URL" -c "\dt litellm_proxy.*"

echo "✅ init_db.sh concluído"
