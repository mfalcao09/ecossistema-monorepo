-- =============================================================================
-- Migração: Vault Secrets + Audit Trail (Epic 1.2 + 1.3 — Sprint 1)
-- ERP Educacional FIC — Diploma Digital
-- Created: 2026-04-11 (Sessão 056)
-- =============================================================================
--
-- EPIC 1.2 — SUPABASE VAULT:
-- ---------------------------
-- 1. Habilita pgsodium (dependência do vault)
-- 2. Cria helper get_vault_secret() (SECURITY DEFINER)
-- 3. Reescreve RPCs encrypt_pii/decrypt_pii/hash_cpf para ler chave do Vault
--    → A chave NUNCA mais sai do banco de dados
--    → Node.js não precisa mais conhecer a PII_ENCRYPTION_KEY
--
-- EPIC 1.3 — AUDIT TRAIL:
-- ------------------------
-- 4. Cria tabela extracao_sessoes_audit
-- 5. Cria trigger automático (AFTER INSERT/UPDATE/DELETE)
-- 6. RLS na tabela de auditoria
--
-- SECRETS (NÃO ESTÃO NESTE ARQUIVO):
-- -----------------------------------
-- Os valores reais dos secrets são inseridos via SQL direto no Supabase
-- (vault.create_secret), NUNCA em arquivos commitados no git.
--
-- SQUAD: Claude (arquitetura) + Buchecha/MiniMax (audit trail design)
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1: SUPABASE VAULT — Infraestrutura
-- ═══════════════════════════════════════════════════════════════════════════════

-- pgsodium já vem habilitado no Supabase (infraestrutura interna)
-- vault extension já está instalada (v0.3.1 confirmado)

-- ── 1.1: Helper para ler secrets do Vault ──────────────────────────────────

CREATE OR REPLACE FUNCTION get_vault_secret(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  IF secret_name IS NULL OR secret_name = '' THEN
    RAISE EXCEPTION 'Nome do secret não pode ser vazio' USING ERRCODE = 'P0001';
  END IF;

  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;

  IF secret_value IS NULL THEN
    RAISE EXCEPTION 'Secret "%" não encontrado no Vault', secret_name USING ERRCODE = 'P0004';
  END IF;

  RETURN secret_value;
END;
$$;

COMMENT ON FUNCTION get_vault_secret IS
  'Lê um secret descriptografado do Supabase Vault. Uso exclusivo de SECURITY DEFINER RPCs.';

-- Revogar acesso direto — só funções SECURITY DEFINER podem chamar
REVOKE ALL ON FUNCTION get_vault_secret(TEXT) FROM public;
REVOKE ALL ON FUNCTION get_vault_secret(TEXT) FROM anon;
REVOKE ALL ON FUNCTION get_vault_secret(TEXT) FROM authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2: RPCs REESCRITAS — Chave vem do Vault
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 2.1: hash_cpf (V2 — Vault-aware) ──────────────────────────────────────
-- Mantém parâmetro salt como OPCIONAL para backward compatibility.
-- Se salt não for fornecido, lê do Vault.

CREATE OR REPLACE FUNCTION hash_cpf(
  cpf_raw TEXT,
  salt TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  cpf_limpo TEXT;
  effective_salt TEXT;
BEGIN
  IF cpf_raw IS NULL OR cpf_raw = '' THEN
    RAISE EXCEPTION 'CPF não pode ser nulo ou vazio' USING ERRCODE = 'P0001';
  END IF;

  -- Prioridade: Vault > parâmetro
  BEGIN
    effective_salt := get_vault_secret('pii_encryption_key');
  EXCEPTION
    WHEN OTHERS THEN
      -- Fallback para parâmetro se Vault não disponível
      effective_salt := salt;
  END;

  IF effective_salt IS NULL OR length(effective_salt) < 16 THEN
    RAISE EXCEPTION 'Salt deve ter pelo menos 16 caracteres (Vault e parâmetro ambos falharam)' USING ERRCODE = 'P0001';
  END IF;

  cpf_limpo := regexp_replace(cpf_raw, '[^0-9]', '', 'g');

  IF length(cpf_limpo) <> 11 THEN
    RAISE EXCEPTION 'CPF deve ter exatamente 11 dígitos (recebido: %)', length(cpf_limpo) USING ERRCODE = 'P0002';
  END IF;

  RETURN encode(hmac(cpf_limpo::bytea, effective_salt::bytea, 'sha256'), 'hex');
END;
$$;

-- ── 2.2: encrypt_pii (V2 — Vault-aware) ───────────────────────────────────

CREATE OR REPLACE FUNCTION encrypt_pii(
  plaintext TEXT,
  encryption_key TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  effective_key TEXT;
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;

  -- Prioridade: Vault > parâmetro
  BEGIN
    effective_key := get_vault_secret('pii_encryption_key');
  EXCEPTION
    WHEN OTHERS THEN
      effective_key := encryption_key;
  END;

  IF effective_key IS NULL OR length(effective_key) < 32 THEN
    RAISE EXCEPTION 'Chave de criptografia indisponível (Vault e parâmetro ambos falharam)' USING ERRCODE = 'P0001';
  END IF;

  RETURN encode(
    pgp_sym_encrypt(plaintext, effective_key, 'cipher-algo=aes256, compress-algo=0')::bytea,
    'base64'
  );
END;
$$;

-- ── 2.3: decrypt_pii (V2 — Vault-aware) ───────────────────────────────────

CREATE OR REPLACE FUNCTION decrypt_pii(
  encrypted_data TEXT,
  encryption_key TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  effective_key TEXT;
BEGIN
  IF encrypted_data IS NULL OR encrypted_data = '' THEN
    RETURN NULL;
  END IF;

  -- Prioridade: Vault > parâmetro
  BEGIN
    effective_key := get_vault_secret('pii_encryption_key');
  EXCEPTION
    WHEN OTHERS THEN
      effective_key := encryption_key;
  END;

  IF effective_key IS NULL OR length(effective_key) < 32 THEN
    RAISE EXCEPTION 'Chave de descriptografia indisponível (Vault e parâmetro ambos falharam)' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    RETURN pgp_sym_decrypt(decode(encrypted_data, 'base64'), effective_key);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Falha ao descriptografar: chave incorreta ou dados corrompidos' USING ERRCODE = 'P0003';
  END;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3: AUDIT TRAIL — Rastreabilidade de escritas Railway
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 3.1: Tabela de auditoria ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS extracao_sessoes_audit (
  id            BIGSERIAL PRIMARY KEY,
  sessao_id     UUID NOT NULL,
  operacao      TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  executado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dados_antigos JSONB,
  dados_novos   JSONB,
  -- Contexto capturado via set_config do serviço Railway
  auth_uid      UUID,
  auth_role     TEXT DEFAULT 'service',
  client_ip     INET,
  request_id    TEXT,
  -- Campos derivados para consulta rápida
  status_antigo TEXT,
  status_novo   TEXT
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_audit_sessao_tempo
  ON extracao_sessoes_audit (sessao_id, executado_em DESC);

CREATE INDEX IF NOT EXISTS idx_audit_tempo
  ON extracao_sessoes_audit (executado_em DESC);

CREATE INDEX IF NOT EXISTS idx_audit_operacao
  ON extracao_sessoes_audit (operacao, executado_em DESC);

COMMENT ON TABLE extracao_sessoes_audit IS
  'Audit trail automático de todas as operações na tabela extracao_sessoes. Trigger-based — não pode ser burlado.';

-- ── 3.2: Função trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION extracao_sessoes_audit_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO extracao_sessoes_audit (
    sessao_id,
    operacao,
    dados_antigos,
    dados_novos,
    auth_uid,
    auth_role,
    client_ip,
    request_id,
    status_antigo,
    status_novo
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    NULLIF(current_setting('app.audit_uid', true), '')::UUID,
    COALESCE(NULLIF(current_setting('app.audit_role', true), ''), 'service'),
    NULLIF(current_setting('app.audit_ip', true), '')::INET,
    NULLIF(current_setting('app.audit_req_id', true), ''),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.status ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.status ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION extracao_sessoes_audit_fn IS
  'Trigger function que captura audit trail de extracao_sessoes. Lê contexto via current_setting (app.audit_*).';

-- ── 3.3: Attach trigger ──────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_extracao_sessoes_audit ON extracao_sessoes;

CREATE TRIGGER trg_extracao_sessoes_audit
  AFTER INSERT OR UPDATE OR DELETE ON extracao_sessoes
  FOR EACH ROW EXECUTE FUNCTION extracao_sessoes_audit_fn();

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4: RLS — Proteção da tabela de auditoria
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE extracao_sessoes_audit ENABLE ROW LEVEL SECURITY;

-- Somente usuários autenticados podem LER auditoria (admins)
CREATE POLICY "audit_read_authenticated"
  ON extracao_sessoes_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Ninguém pode INSERT/UPDATE/DELETE diretamente — só o trigger (SECURITY DEFINER)
-- O trigger roda como postgres, bypassa RLS automaticamente

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 5: Evento de auditoria desta migração
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'security_events') THEN
    INSERT INTO security_events (tipo, ip, rota, metodo, status_code, risco, detalhes, criado_em)
    VALUES (
      'vault_audit_trail_activated',
      '0.0.0.0'::inet,
      '/migration/20260411_vault_audit_trail',
      'MIGRATION',
      200,
      'baixo',
      jsonb_build_object(
        'migration', '20260411_vault_audit_trail',
        'epics', 'Sprint 1 Epic 1.2 + 1.3',
        'vault_helper', 'get_vault_secret()',
        'rpcs_atualizadas', jsonb_build_array('hash_cpf', 'encrypt_pii', 'decrypt_pii'),
        'audit_table', 'extracao_sessoes_audit',
        'audit_trigger', 'trg_extracao_sessoes_audit'
      ),
      NOW()
    );
  END IF;
END;
$$;
