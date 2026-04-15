-- =============================================================================
-- Migração: Ativação da Criptografia PII (Epic 1.1 — MASTERPLAN v4 Sprint 1)
-- ERP Educacional FIC — Diploma Digital
-- Created: 2026-04-11 (Sessão 052)
-- =============================================================================
--
-- PURPOSE:
-- --------
-- Ativar a infraestrutura de criptografia de dados pessoais (PII) que já existe
-- no código TypeScript (pii-encryption.ts) mas nunca foi deployada no banco.
--
-- O QUE ESTA MIGRATION FAZ:
-- -------------------------
-- 1. Garante extensão pgcrypto
-- 2. Cria 3 RPCs: hash_cpf, encrypt_pii, decrypt_pii
-- 3. Adiciona colunas criptografadas à tabela diplomados
-- 4. Cria índice para busca por cpf_hash
--
-- SEGURANÇA:
-- ----------
-- - HMAC-SHA256 para hash de CPF (NÃO digest puro — vulnerável a rainbow table)
-- - pgp_sym_encrypt/decrypt para AES-256 com IV aleatório
-- - SECURITY DEFINER + search_path fixo em todas as RPCs
-- - Chave de criptografia NUNCA armazenada no banco (passada via parâmetro)
--
-- NOTA: pgcrypto está no schema 'extensions' no Supabase, por isso
-- search_path inclui 'public, extensions'.
--
-- SQUAD: DeepSeek (lógica SQL) + Claude (arquitetura)
-- =============================================================================

-- ── Passo 1: Garantir extensão pgcrypto ─────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- ── Passo 2: RPC hash_cpf ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hash_cpf(
  cpf_raw TEXT,
  salt TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cpf_limpo TEXT;
BEGIN
  IF cpf_raw IS NULL OR cpf_raw = '' THEN
    RAISE EXCEPTION 'CPF não pode ser nulo ou vazio' USING ERRCODE = 'P0001';
  END IF;

  IF salt IS NULL OR length(salt) < 16 THEN
    RAISE EXCEPTION 'Salt deve ter pelo menos 16 caracteres' USING ERRCODE = 'P0001';
  END IF;

  cpf_limpo := regexp_replace(cpf_raw, '[^0-9]', '', 'g');

  IF length(cpf_limpo) <> 11 THEN
    RAISE EXCEPTION 'CPF deve ter exatamente 11 dígitos (recebido: %)', length(cpf_limpo) USING ERRCODE = 'P0002';
  END IF;

  RETURN encode(hmac(cpf_limpo::bytea, salt::bytea, 'sha256'), 'hex');
END;
$$;

COMMENT ON FUNCTION hash_cpf IS 'Gera HMAC-SHA256 de CPF para busca segura. Limpa formatação automaticamente.';

-- ── Passo 3: RPC encrypt_pii ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION encrypt_pii(
  plaintext TEXT,
  encryption_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;

  IF encryption_key IS NULL OR length(encryption_key) < 32 THEN
    RAISE EXCEPTION 'Chave de criptografia deve ter pelo menos 32 caracteres' USING ERRCODE = 'P0001';
  END IF;

  RETURN encode(
    pgp_sym_encrypt(plaintext, encryption_key, 'cipher-algo=aes256, compress-algo=0')::bytea,
    'base64'
  );
END;
$$;

COMMENT ON FUNCTION encrypt_pii IS 'Criptografa PII com AES-256 via pgp_sym_encrypt. IV aleatório.';

-- ── Passo 4: RPC decrypt_pii ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION decrypt_pii(
  encrypted_data TEXT,
  encryption_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF encrypted_data IS NULL OR encrypted_data = '' THEN
    RETURN NULL;
  END IF;

  IF encryption_key IS NULL OR length(encryption_key) < 32 THEN
    RAISE EXCEPTION 'Chave de criptografia deve ter pelo menos 32 caracteres' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    RETURN pgp_sym_decrypt(decode(encrypted_data, 'base64'), encryption_key);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Falha ao descriptografar: chave incorreta ou dados corrompidos' USING ERRCODE = 'P0003';
  END;
END;
$$;

COMMENT ON FUNCTION decrypt_pii IS 'Descriptografa PII criptografado por encrypt_pii().';

-- ── Passo 5: Adicionar colunas criptografadas à tabela diplomados ───────────

ALTER TABLE diplomados
  ADD COLUMN IF NOT EXISTS cpf_hash TEXT,
  ADD COLUMN IF NOT EXISTS cpf_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS rg_encrypted TEXT;

-- ── Passo 6: Índices para busca por cpf_hash ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_diplomados_cpf_hash
  ON diplomados (cpf_hash)
  WHERE cpf_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diplomados_cpf_hash_nascimento
  ON diplomados (cpf_hash, data_nascimento)
  WHERE cpf_hash IS NOT NULL;

-- ── Passo 7: Audit log da ativação ──────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'security_events') THEN
    INSERT INTO security_events (tipo, ip, rota, metodo, status_code, risco, detalhes, criado_em)
    VALUES (
      'pii_crypto_activated',
      '0.0.0.0'::inet,
      '/migration/20260411_pii_crypto_activate',
      'MIGRATION',
      200,
      'baixo',
      jsonb_build_object(
        'migration', '20260411_pii_crypto_activate',
        'epics', 'Sprint 1 Epic 1.1',
        'funcoes_criadas', jsonb_build_array('hash_cpf', 'encrypt_pii', 'decrypt_pii'),
        'colunas_adicionadas', jsonb_build_array('cpf_hash', 'cpf_encrypted', 'email_encrypted', 'rg_encrypted')
      ),
      NOW()
    );
  END IF;
END;
$$;
