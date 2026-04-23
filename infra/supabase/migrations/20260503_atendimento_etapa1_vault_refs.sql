-- ═══════════════════════════════════════════════════════════════════════════
-- Etapa 1-D · P-066 · Vault refs para tokens (Google + WABA)
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto:
--   Hoje `atendimento_google_tokens.refresh_token` e
--   `atendimento_inboxes.provider_config.access_token` são armazenados em
--   plaintext. A migração gradual para o vault SC-29
--   (`@ecossistema/credentials` → credential-gateway Edge Function) usa
--   uma *ref* (nome da credencial no vault) em paralelo ao valor plaintext.
--
--   O resolver em `apps/erp-educacional/src/lib/atendimento/credentials-resolver.ts`
--   prefere a ref quando presente, caindo para o plaintext em ambientes
--   que ainda não seedaram o vault (dev/staging). Após o seed em Etapa 2-A
--   (deploy FIC), basta popular `*_vault_ref` e zerar o plaintext — sem
--   release de código.
--
-- O que esta migration faz:
--   1. Adiciona coluna `refresh_token_vault_ref TEXT` em
--      `atendimento_google_tokens` (NULL = usar refresh_token plaintext).
--   2. Comenta o shape esperado em `atendimento_inboxes.provider_config`
--      (JSONB já aceita chave nova sem migration).
--
-- Rollback seguro:
--   ALTER TABLE public.atendimento_google_tokens
--     DROP COLUMN IF EXISTS refresh_token_vault_ref;
--
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Adiciona coluna vault_ref em atendimento_google_tokens (idempotente).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'atendimento_google_tokens'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'atendimento_google_tokens'
      AND column_name = 'refresh_token_vault_ref'
  ) THEN
    EXECUTE '
      ALTER TABLE public.atendimento_google_tokens
        ADD COLUMN refresh_token_vault_ref TEXT
    ';
    RAISE NOTICE 'coluna atendimento_google_tokens.refresh_token_vault_ref adicionada.';
  ELSE
    RAISE NOTICE 'coluna refresh_token_vault_ref já existe OU tabela ausente — skip.';
  END IF;
END $$;

-- 2. Comentário de documentação do shape esperado em provider_config.
--    A migration S5 (20260421000000) declarou provider_config JSONB genérico;
--    aqui apenas documentamos a convenção de chave nova (vault ref WABA).
COMMENT ON COLUMN public.atendimento_inboxes.provider_config IS
  'JSONB do canal. WABA aceita: { phone_number_id, waba_id, access_token?, access_token_vault_ref?, ... }. '
  'Quando access_token_vault_ref presente, o token é resolvido via SC-29 credential-gateway.';

-- Sanity check (manual, comentado):
--   SELECT user_id, refresh_token IS NOT NULL AS has_plain, refresh_token_vault_ref IS NOT NULL AS has_ref
--     FROM public.atendimento_google_tokens;
