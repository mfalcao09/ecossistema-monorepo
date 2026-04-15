-- ============================================================
-- KEY ROTATION METADATA — Rastreamento de Rotação de Chaves
-- ERP Educacional FIC — Data: 2026-03-26
--
-- Tabela para rastrear histórico de rotações de chaves de
-- criptografia PII e status das versões em uso.
--
-- Status possíveis:
-- - 'active': Versão em uso para novas criptografias
-- - 'deprecated': Versão antiga, mas ainda usada para descriptografar dados antigos
-- - 'retired': Versão completamente fora de uso (dados já re-criptografados)
-- ============================================================

-- Tabela de log de rotação de chaves
CREATE TABLE IF NOT EXISTS key_rotation_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  rotated_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_by TEXT DEFAULT 'system',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'retired')),
  deprecated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  notes TEXT,

  CONSTRAINT key_rotation_version_positive CHECK (version > 0),
  CONSTRAINT valid_deprecated_timestamp CHECK (
    (status = 'deprecated' AND deprecated_at IS NOT NULL) OR
    (status != 'deprecated' AND deprecated_at IS NULL)
  ),
  CONSTRAINT valid_retired_timestamp CHECK (
    (status = 'retired' AND retired_at IS NOT NULL) OR
    (status != 'retired' AND retired_at IS NULL)
  )
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_key_rotation_status ON key_rotation_log(status);
CREATE INDEX IF NOT EXISTS idx_key_rotation_rotated_at ON key_rotation_log(rotated_at DESC);
CREATE INDEX IF NOT EXISTS idx_key_rotation_active ON key_rotation_log(version) WHERE status = 'active';

-- Habilitar Row Level Security (logs de rotação são sensíveis)
ALTER TABLE key_rotation_log ENABLE ROW LEVEL SECURITY;

-- Política 1: Apenas admins podem ler o log
-- Nota: Implementar verificação de admin_role na aplicação
CREATE POLICY IF NOT EXISTS "Admin users can read key rotation log"
  ON key_rotation_log
  FOR SELECT
  TO authenticated
  USING (true); -- Será filtrado na aplicação

-- Política 2: Apenas sistema/admins podem inserir
CREATE POLICY IF NOT EXISTS "System can insert key rotation log"
  ON key_rotation_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Será validado na aplicação

-- Política 3: Apenas admins podem atualizar status
CREATE POLICY IF NOT EXISTS "Admin users can update key rotation status"
  ON key_rotation_log
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true); -- Será validado na aplicação

-- Comentários
COMMENT ON TABLE key_rotation_log IS 'Log de rotação de chaves de criptografia PII do ERP FIC. Rastreia todas as versões de chaves e seu status.';
COMMENT ON COLUMN key_rotation_log.id IS 'UUID único do registro';
COMMENT ON COLUMN key_rotation_log.version IS 'Número da versão da chave (ex: 1, 2, 3). Deve ser único e positivo.';
COMMENT ON COLUMN key_rotation_log.rotated_at IS 'Timestamp quando a chave foi ativada';
COMMENT ON COLUMN key_rotation_log.rotated_by IS 'Identificação do admin/sistema que fez a rotação';
COMMENT ON COLUMN key_rotation_log.status IS 'Estado da versão: active (em uso), deprecated (antiga mas usável), retired (fora de uso)';
COMMENT ON COLUMN key_rotation_log.deprecated_at IS 'Timestamp quando a chave foi marcada como deprecated (se aplicável)';
COMMENT ON COLUMN key_rotation_log.retired_at IS 'Timestamp quando a chave foi aposentada (se todos os dados foram re-criptografados)';
COMMENT ON COLUMN key_rotation_log.notes IS 'Notas livres sobre a rotação (motivo, contexto, etc.)';

-- Inserir versão inicial (V1) se não existir
INSERT INTO key_rotation_log (version, status, notes)
VALUES (1, 'active', 'Versão inicial da chave PII')
ON CONFLICT (version) DO NOTHING;

-- Função helper para obter a versão ativa (para queries SQL)
CREATE OR REPLACE FUNCTION get_active_key_version()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT version
  FROM key_rotation_log
  WHERE status = 'active'
  ORDER BY rotated_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_active_key_version() IS 'Retorna o número da versão de chave ativa no momento. Usada em contextos SQL.';

-- Função helper para listar todas as versões (debugging)
CREATE OR REPLACE FUNCTION list_key_versions()
RETURNS TABLE (
  version INTEGER,
  status TEXT,
  rotated_at TIMESTAMPTZ,
  rotated_by TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT version, status, rotated_at, rotated_by
  FROM key_rotation_log
  ORDER BY version DESC;
$$;

COMMENT ON FUNCTION list_key_versions() IS 'Lista todas as versões de chave com seu status. Útil para debugging e auditoria.';
