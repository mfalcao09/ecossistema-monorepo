-- ============================================================
-- Trilha de Auditoria — Compliance MEC
-- ERP Educacional FIC — Data: 2026-03-23
--
-- Rastreia todas as ações críticas no sistema para:
-- - Conformidade regulatória (Portarias MEC 554/2019 e 70/2025)
-- - Segurança e compliance LGPD
-- - Investigação de incidentes
-- ============================================================

-- Tabela principal de auditoria
CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  detalhes JSONB,
  ip TEXT,
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para otimizar consultas comuns
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON audit_trail(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_entidade ON audit_trail(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_acao ON audit_trail(acao);
CREATE INDEX IF NOT EXISTS idx_audit_data ON audit_trail(criado_em);

-- Índice composto para auditoria por usuário e data
CREATE INDEX IF NOT EXISTS idx_audit_usuario_data ON audit_trail(usuario_id, criado_em DESC);

-- Habilitar Row Level Security
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Política 1: Usuários autenticados podem inserir entradas de auditoria
CREATE POLICY IF NOT EXISTS "Authenticated users can insert audit entries"
  ON audit_trail
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política 2: Admins podem ler toda a trilha de auditoria
-- Nota: Implementar verificação de admin_role no trigger ou na aplicação
CREATE POLICY IF NOT EXISTS "Admin users can read audit trail"
  ON audit_trail
  FOR SELECT
  TO authenticated
  USING (true);

-- Comentário descritivo da tabela
COMMENT ON TABLE audit_trail IS 'Trilha de auditoria do ERP FIC — compliance MEC. Rastreia todas as ações críticas para segurança, investigação e compliance regulatória.';

-- Comentários das colunas
COMMENT ON COLUMN audit_trail.usuario_id IS 'UUID do usuário que realizou a ação';
COMMENT ON COLUMN audit_trail.acao IS 'Tipo de ação: criar, editar, excluir, visualizar, exportar, assinar, publicar, login, logout, alterar_senha, alterar_permissao';
COMMENT ON COLUMN audit_trail.entidade IS 'Tipo de entidade afetada: diploma, diplomado, curso, usuario, departamento, ies, assinatura, xml, relatorio';
COMMENT ON COLUMN audit_trail.entidade_id IS 'ID da entidade específica afetada (opcional)';
COMMENT ON COLUMN audit_trail.detalhes IS 'Contexto adicional em JSON: campos alterados, valores anteriores/novos, motivo da ação, etc.';
COMMENT ON COLUMN audit_trail.ip IS 'Endereço IP do cliente que realizou a ação';
COMMENT ON COLUMN audit_trail.user_agent IS 'User-Agent do navegador/cliente';
COMMENT ON COLUMN audit_trail.criado_em IS 'Timestamp da ação em UTC';

-- NOTA DE IMPLEMENTAÇÃO FUTURA:
-- Para suportar grandes volumes (>1M registros), converter para tabela particionada por mês:
--
-- CREATE TABLE audit_trail (
--   id UUID DEFAULT gen_random_uuid(),
--   usuario_id UUID NOT NULL,
--   acao TEXT NOT NULL,
--   entidade TEXT NOT NULL,
--   entidade_id TEXT,
--   detalhes JSONB,
--   ip TEXT,
--   user_agent TEXT,
--   criado_em TIMESTAMPTZ DEFAULT NOW()
-- ) PARTITION BY RANGE (criado_em);
--
-- CREATE TABLE audit_trail_202603 PARTITION OF audit_trail
--   FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
--
-- Isso melhora performance de leitura e permite arquivamento/purga de dados antigos
