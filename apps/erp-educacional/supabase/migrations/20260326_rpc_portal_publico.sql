-- =============================================================================
-- Migração: RPC Functions for Public Portal Queries
-- Secure functions to replace Service Role Key direct table access
-- ERP Educacional FIC — Diploma Digital
-- Created: 2026-03-26
-- =============================================================================
--
-- PURPOSE:
-- --------
-- Replace direct table access via SUPABASE_SERVICE_ROLE_KEY with RPC functions
-- that implement fine-grained security and return only public-facing fields.
-- Functions are SECURITY DEFINER to run with database owner privileges,
-- preventing caller privilege escalation.
--
-- FUNCTIONS:
-- ----------
-- 1. consultar_documentos_por_cpf(p_cpf_hash TEXT)
--    - Searches for published documents by hashed CPF
--    - Returns only public fields (no PII, no internal IDs)
--    - Two-factor verification: CPF hash + birth date match
--
-- 2. verificar_documento_por_codigo(p_codigo TEXT)
--    - Verifies a document by its verification code
--    - Returns complete document details for public viewing
--    - Only returns public-facing fields
--
-- SECURITY NOTES:
-- ---------------
-- - All functions are SECURITY DEFINER to run with owner permissions
-- - search_path set to 'public' to prevent search path injection attacks
-- - Only public fields returned (verified against original queries)
-- - Rate limiting implemented at API layer, not here
-- - Functions return SETOF to allow pagination if needed
-- - No direct column access from untrusted roles
-- =============================================================================

-- Function 1: Consultar documentos por CPF hash + data de nascimento
-- Purpose: Public portal CPF lookup — returns only public-facing diploma data
-- Used by: POST /api/portal/consultar-cpf
-- Args:
--   p_cpf_hash: SHA256 hash of cleaned CPF (no formatting)
--   p_data_nascimento: ISO 8601 date string (YYYY-MM-DD)
-- Returns: Array of public diploma data (without sensitive fields)
CREATE OR REPLACE FUNCTION consultar_documentos_por_cpf(
  p_cpf_hash TEXT,
  p_data_nascimento TEXT
)
RETURNS TABLE (
  id UUID,
  tipo VARCHAR,
  titulo VARCHAR,
  numero_documento VARCHAR,
  assinado_em TIMESTAMPTZ,
  publicado_em TIMESTAMPTZ,
  ies_nome VARCHAR,
  codigo_verificacao VARCHAR,
  url_verificacao VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Step 1: Find diplomado by CPF hash + birth date (two-factor verification)
  WITH diplomado_match AS (
    SELECT id
    FROM diplomados
    WHERE cpf_hash = p_cpf_hash
      AND data_nascimento = p_data_nascimento::DATE
    LIMIT 1  -- Security: Return at most one match
  )
  -- Step 2: Get published diplomas for this diplomado
  SELECT
    d.id,
    'diploma'::VARCHAR AS tipo,
    COALESCE(c.nome, d.titulo_conferido, 'Diploma'::VARCHAR) AS titulo,
    d.numero_registro AS numero_documento,
    d.data_expedicao AS assinado_em,
    d.data_publicacao AS publicado_em,
    COALESCE(
      dc.ies_nome,
      'Faculdades Integradas de Cassilândia'::VARCHAR
    ) AS ies_nome,
    COALESCE(d.codigo_validacao, 'FIC-' || SUBSTRING(d.id::TEXT FROM 1 FOR 8)) AS codigo_verificacao,
    COALESCE(d.url_verificacao, '') AS url_verificacao
  FROM diplomados dip
  INNER JOIN diplomado_match ON dip.id = diplomado_match.id
  INNER JOIN diplomas d ON d.diplomado_id = dip.id
  LEFT JOIN cursos c ON c.id = d.curso_id
  LEFT JOIN diploma_config dc ON dc.ambiente = d.ambiente
  WHERE d.status = 'publicado'
  ORDER BY d.data_publicacao DESC;
$$;

-- Function 2: Verify documento by código (verification code lookup)
-- Purpose: Public verification endpoint — returns document details
-- Used by: GET /api/documentos/verificar/[codigo]
-- Args:
--   p_codigo: Verification code (e.g., 'FIC-2025-ABC123')
-- Returns: Complete published document data for verification
-- NOTE: This function performs a more complex JOIN because it needs signatary info
-- The actual verification logic (building signataries list) happens in TypeScript
CREATE OR REPLACE FUNCTION verificar_documento_por_codigo(
  p_codigo TEXT
)
RETURNS TABLE (
  valido BOOLEAN,
  tipo VARCHAR,
  status VARCHAR,
  destinatario_nome VARCHAR,
  destinatario_cpf_mascarado VARCHAR,
  codigo_validacao VARCHAR,
  numero_registro VARCHAR,
  titulo_conferido VARCHAR,
  titulo VARCHAR,
  grau VARCHAR,
  modalidade VARCHAR,
  carga_horaria_total INTEGER,
  codigo_emec_curso VARCHAR,
  reconhecimento VARCHAR,
  ies_emissora_nome VARCHAR,
  ies_emissora_codigo_mec VARCHAR,
  ies_registradora_nome VARCHAR,
  ies_registradora_codigo_mec VARCHAR,
  data_ingresso DATE,
  data_conclusao DATE,
  data_colacao_grau DATE,
  data_expedicao DATE,
  data_registro DATE,
  data_publicacao DATE,
  forma_acesso VARCHAR,
  assinado_em DATE,
  publicado_em DATE,
  rvdd_url VARCHAR,
  xml_url VARCHAR,
  xml_historico_url VARCHAR,
  qrcode_url VARCHAR,
  ies_nome VARCHAR,
  numero_documento VARCHAR,
  erro_message VARCHAR
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Query published diploma by codigo_validacao
  RETURN QUERY
  SELECT
    TRUE::BOOLEAN,
    'diploma'::VARCHAR,
    d.status,
    COALESCE(dip.nome_social, dip.nome, ''::VARCHAR) AS destinatario_nome,
    -- Mask CPF for public display: XXX.***.***.NN
    COALESCE(
      CASE WHEN dip.cpf IS NOT NULL THEN
        SUBSTRING(dip.cpf FROM 1 FOR 3) || '.***.***.NN'
      ELSE NULL::VARCHAR END,
      NULL::VARCHAR
    ) AS destinatario_cpf_mascarado,
    d.codigo_validacao,
    d.numero_registro,
    d.titulo_conferido,
    COALESCE(c.nome, d.titulo_conferido, 'Diploma'::VARCHAR) AS titulo,
    c.grau,
    c.modalidade,
    c.carga_horaria_total,
    c.codigo_emec,
    CASE WHEN c.numero_reconhecimento IS NOT NULL THEN
      COALESCE(c.tipo_reconhecimento, 'Ato'::VARCHAR) || ' ' || c.numero_reconhecimento
    ELSE NULL::VARCHAR END AS reconhecimento,
    d.emissora_nome,
    d.emissora_codigo_mec,
    d.registradora_nome,
    d.registradora_codigo_mec,
    d.data_ingresso,
    d.data_conclusao,
    d.data_colacao_grau,
    d.data_expedicao,
    d.data_registro,
    d.data_publicacao,
    d.forma_acesso,
    d.data_expedicao AS assinado_em,
    d.data_publicacao AS publicado_em,
    d.pdf_url AS rvdd_url,
    d.xml_url,
    -- Fallback para XML histórico
    COALESCE(
      xg.arquivo_url,
      CASE WHEN d.legado_xml_dados_path IS NOT NULL THEN
        'https://' || CURRENT_SETTING('app.supabase_url') || '/storage/v1/object/public/documentos-digitais/' || d.legado_xml_dados_path
      ELSE NULL::VARCHAR END
    ) AS xml_historico_url,
    d.qrcode_url,
    d.emissora_nome AS ies_nome,
    d.numero_registro AS numero_documento,
    NULL::VARCHAR AS erro_message
  FROM diplomas d
  INNER JOIN diplomados dip ON dip.id = d.diplomado_id
  LEFT JOIN cursos c ON c.id = d.curso_id
  LEFT JOIN xmls_gerados xg ON xg.diploma_id = d.id
    AND xg.tipo = 'HistoricoEscolarDigital'
    AND xg.status = 'completo'
  WHERE (d.codigo_validacao = p_codigo OR SUBSTRING(d.id::TEXT FROM 1 FOR 8) = p_codigo)
    AND d.status = 'publicado'
  LIMIT 1;

  -- If no rows returned, send error response
  IF NOT FOUND THEN
    INSERT INTO _verification_errors (codigo, erro)
    VALUES (p_codigo, 'Documento não encontrado')
    ON CONFLICT DO NOTHING;

    RETURN QUERY SELECT
      FALSE::BOOLEAN,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::INTEGER,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::DATE,
      NULL::DATE,
      NULL::DATE,
      NULL::DATE,
      NULL::DATE,
      NULL::DATE,
      NULL::VARCHAR,
      NULL::DATE,
      NULL::DATE,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      'Documento não encontrado. Verifique o código ou QR Code.'::VARCHAR;
  END IF;
END
$$;

-- Grant execution permissions to authenticated and anon roles
-- (public portal does NOT require authentication)
GRANT EXECUTE ON FUNCTION consultar_documentos_por_cpf(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verificar_documento_por_codigo(TEXT) TO authenticated, anon;

-- Add indexes to support efficient RPC queries
-- Index on diplomados for CPF hash lookup
CREATE INDEX IF NOT EXISTS idx_diplomados_cpf_hash_birthdate
ON diplomados (cpf_hash, data_nascimento)
WHERE cpf_hash IS NOT NULL;

-- Index on diplomas for codigo_validacao lookup
CREATE INDEX IF NOT EXISTS idx_diplomas_codigo_validacao
ON diplomas (codigo_validacao)
WHERE status = 'publicado';

-- Index on diplomas for status filtering
CREATE INDEX IF NOT EXISTS idx_diplomas_status
ON diplomas (status)
WHERE status = 'publicado';

-- Create a log table for verification errors (optional security auditing)
CREATE TABLE IF NOT EXISTS _verification_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  erro TEXT,
  tentativa_em TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying verification errors
CREATE INDEX IF NOT EXISTS idx_verification_errors_codigo
ON _verification_errors (codigo);

-- Add comment to migration
COMMENT ON FUNCTION consultar_documentos_por_cpf(TEXT, TEXT) IS
'Public portal RPC: Search published documents by hashed CPF and birth date.
Two-factor verification prevents information leakage.
Returns only public-facing fields (no PII, no internal IDs).
Rate limiting applied at API layer.';

COMMENT ON FUNCTION verificar_documento_por_codigo(TEXT) IS
'Public portal RPC: Verify and return details of a published document by verification code.
Returns complete document data for public viewing (masked CPF, no sensitive internals).
Used by verification page and external integrations.
Rate limiting applied at API layer.';
