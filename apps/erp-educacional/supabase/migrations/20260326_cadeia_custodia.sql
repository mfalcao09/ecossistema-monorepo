-- ============================================================
-- CADEIA DE CUSTÓDIA — Sistema de rastreamento do diploma
-- ERP Educacional FIC — Data: 2026-03-26
--
-- Registra CADA mudança de estado de um diploma, criando
-- uma cadeia imutável (blockchain-like) para compliance MEC
-- e auditoria legal.
--
-- Etapas rastreadas:
-- 1. criacao — Diploma criado no sistema
-- 2. dados_preenchidos — Todos os dados preenchidos
-- 3. xml_gerado — XMLs gerados com sucesso
-- 4. xml_validado — XMLs validados contra XSD
-- 5. assinatura_emissora — Assinado pela emissora
-- 6. assinatura_registradora — Assinado pela registradora
-- 7. rvdd_gerado — RVDD (PDF visual) gerado
-- 8. publicado — Disponível no portal público
-- 9. verificado — Verificado por terceiros
-- 10. revogado — Diploma revogado
-- 11. retificado — Diploma retificado
--
-- Segurança: hash_anterior cria uma cadeia — se alguém
-- tentar deletar/alterar um registro, a integridade quebra
-- ============================================================

CREATE TABLE IF NOT EXISTS cadeia_custodia_diplomas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Referência ao diploma
  diploma_id UUID NOT NULL REFERENCES diplomas(id) ON DELETE CASCADE,

  -- Etapa no pipeline (enum no TypeScript)
  etapa TEXT NOT NULL,

  -- Status desta etapa: sucesso | erro | pendente
  status TEXT NOT NULL,

  -- Contexto da ação
  usuario_id UUID,
  ip_address TEXT,
  user_agent TEXT,

  -- Hashes para integridade (blockchain-like chain)
  -- hash_estado = SHA-256(diploma_state_json) no momento
  -- hash_anterior = SHA-256(previous_record.id + previous_record.hash_estado + previous_record.created_at)
  hash_estado TEXT,
  hash_anterior TEXT,

  -- Detalhes específicos desta etapa (JSONB)
  detalhes JSONB,

  -- Para etapas de assinatura: serial do certificado A3 usado
  certificado_serial TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_custodia_diploma_id ON cadeia_custodia_diplomas(diploma_id);
CREATE INDEX IF NOT EXISTS idx_custodia_etapa ON cadeia_custodia_diplomas(etapa);
CREATE INDEX IF NOT EXISTS idx_custodia_status ON cadeia_custodia_diplomas(status);
CREATE INDEX IF NOT EXISTS idx_custodia_created_at ON cadeia_custodia_diplomas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custodia_diploma_created ON cadeia_custodia_diplomas(diploma_id, created_at DESC);

-- Índice para verificação de integridade (detectar hashes faltando)
CREATE INDEX IF NOT EXISTS idx_custodia_hash_estado ON cadeia_custodia_diplomas(hash_estado) WHERE hash_estado IS NOT NULL;

-- Habilitar Row Level Security
ALTER TABLE cadeia_custodia_diplomas ENABLE ROW LEVEL SECURITY;

-- RLS: Usuários autenticados do mesmo tenant podem LER a cadeia
-- (implementar filter por tenant_id quando necessário)
CREATE POLICY IF NOT EXISTS "Authenticated users can read custody chain"
  ON cadeia_custodia_diplomas
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS: Apenas a aplicação pode INSERIR (via service role)
-- Usuários normais não podem inserir diretamente
CREATE POLICY IF NOT EXISTS "Only service role can insert custody records"
  ON cadeia_custodia_diplomas
  FOR INSERT
  WITH CHECK (false);

-- RLS: Ninguém pode UPDATE ou DELETE (imutável)
CREATE POLICY IF NOT EXISTS "No updates or deletes on custody records"
  ON cadeia_custodia_diplomas
  FOR UPDATE
  USING (false);

CREATE POLICY IF NOT EXISTS "No deletes on custody records"
  ON cadeia_custodia_diplomas
  FOR DELETE
  USING (false);

-- Comentários descritivos
COMMENT ON TABLE cadeia_custodia_diplomas IS 'Cadeia de custódia do diploma — rastreamento imutável de cada etapa do ciclo de vida. Blockchain-like com hashing SHA-256.';

COMMENT ON COLUMN cadeia_custodia_diplomas.id IS 'UUID único do registro de custodia';
COMMENT ON COLUMN cadeia_custodia_diplomas.diploma_id IS 'UUID do diploma rastreado';
COMMENT ON COLUMN cadeia_custodia_diplomas.etapa IS 'Etapa do pipeline: criacao, dados_preenchidos, xml_gerado, xml_validado, assinatura_emissora, assinatura_registradora, rvdd_gerado, publicado, verificado, revogado, retificado';
COMMENT ON COLUMN cadeia_custodia_diplomas.status IS 'sucesso | erro | pendente';
COMMENT ON COLUMN cadeia_custodia_diplomas.usuario_id IS 'UUID do usuário que acionou esta etapa (null se automatizado)';
COMMENT ON COLUMN cadeia_custodia_diplomas.ip_address IS 'IP do cliente que acionou (para auditoria)';
COMMENT ON COLUMN cadeia_custodia_diplomas.user_agent IS 'User-Agent do cliente (para auditoria)';
COMMENT ON COLUMN cadeia_custodia_diplomas.hash_estado IS 'SHA-256(diploma_state_json) — prova criptográfica do estado neste momento';
COMMENT ON COLUMN cadeia_custodia_diplomas.hash_anterior IS 'SHA-256(id_anterior + hash_estado_anterior + created_at_anterior) — elo da cadeia';
COMMENT ON COLUMN cadeia_custodia_diplomas.detalhes IS 'JSONB: dados específicos desta etapa (ex: erros de validação, hash dos XMLs, nomes dos assinantes)';
COMMENT ON COLUMN cadeia_custodia_diplomas.certificado_serial IS 'Serial do certificado A3 ICP-Brasil (preenchido em etapas de assinatura)';
COMMENT ON COLUMN cadeia_custodia_diplomas.created_at IS 'Timestamp UTC quando o registro foi criado (imutável)';

-- Trigger para impedir updates acidentais (extra protection)
CREATE OR REPLACE FUNCTION bloquear_update_cadeia_custodia()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Cadeia de custódia é imutável. Update bloqueado.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloquear_update_custodia
  BEFORE UPDATE ON cadeia_custodia_diplomas
  FOR EACH ROW
  EXECUTE FUNCTION bloquear_update_cadeia_custodia();

-- Função auxiliar: obter último registro da cadeia para um diploma
CREATE OR REPLACE FUNCTION obter_ultimo_registro_custodia(p_diploma_id UUID)
RETURNS cadeia_custodia_diplomas AS $$
SELECT *
FROM cadeia_custodia_diplomas
WHERE diploma_id = p_diploma_id
ORDER BY created_at DESC
LIMIT 1;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION obter_ultimo_registro_custodia IS 'Retorna o registro mais recente de custodia para um diploma';
