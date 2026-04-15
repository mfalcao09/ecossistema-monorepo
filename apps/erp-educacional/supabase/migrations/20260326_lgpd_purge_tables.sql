-- ============================================================
-- LGPD — Purge Tables e Configuração de Retenção
-- ERP Educacional FIC — Data: 2026-03-26
--
-- Suporta processamento assíncrono de purgas LGPD:
-- - Fila de requisições de purga (exclusão, retenção, consentimento)
-- - Logs de auditoria de purgas executadas
-- - Configuração de políticas de retenção por tabela
--
-- Atende à Lei 13.709/2018 (LGPD) para:
-- - Direito ao esquecimento (right to be forgotten)
-- - Retenção de dados conforme necessidade legal
-- - Auditoria de operações sensíveis
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. Fila de Requisições de Purga
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lgpd_purge_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Tipo de purga
  tipo TEXT NOT NULL CHECK (tipo IN ('retencao', 'exclusao', 'consentimento')),

  -- Alvo da purga
  alvo_user_id UUID,
  alvo_tabela TEXT,
  alvo_registro_id TEXT,

  -- Status do processamento
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),

  -- Contexto e metadados
  contexto JSONB DEFAULT '{}'::JSONB,

  -- Timestamps
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  processado_em TIMESTAMPTZ,

  -- Informações de erro (se ocorrer)
  erro_mensagem TEXT,

  -- RLS
  created_by UUID DEFAULT auth.uid()
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_lgpd_purge_status ON lgpd_purge_queue(status);
CREATE INDEX IF NOT EXISTS idx_lgpd_purge_tipo ON lgpd_purge_queue(tipo);
CREATE INDEX IF NOT EXISTS idx_lgpd_purge_user ON lgpd_purge_queue(alvo_user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_purge_criado ON lgpd_purge_queue(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_lgpd_purge_status_criado ON lgpd_purge_queue(status, criado_em DESC);

-- RLS
ALTER TABLE lgpd_purge_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role can manage purge queue"
  ON lgpd_purge_queue
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Admins can view purge queue"
  ON lgpd_purge_queue
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  ));

COMMENT ON TABLE lgpd_purge_queue IS 'Fila de requisições de purga LGPD — processadas assincronamente por Edge Function';
COMMENT ON COLUMN lgpd_purge_queue.tipo IS 'Tipo: retencao (auto-purga por prazo), exclusao (direito ao esquecimento), consentimento (retirada de consentimento)';
COMMENT ON COLUMN lgpd_purge_queue.status IS 'pendente → processando → concluido/erro';

-- ──────────────────────────────────────────────────────────
-- 2. Log de Purgas Executadas
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lgpd_purge_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Referência à requisição
  purge_queue_id UUID NOT NULL REFERENCES lgpd_purge_queue(id) ON DELETE CASCADE,

  -- O que foi purgado
  tabela TEXT NOT NULL,
  coluna TEXT,
  registros_afetados INTEGER DEFAULT 0,

  -- Ação executada
  acao TEXT NOT NULL CHECK (acao IN ('anonimizado', 'excluido')),

  -- Detalhes
  detalhes JSONB DEFAULT '{}'::JSONB,

  -- Timestamp
  executado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lgpd_log_purge_queue ON lgpd_purge_log(purge_queue_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_log_tabela ON lgpd_purge_log(tabela);
CREATE INDEX IF NOT EXISTS idx_lgpd_log_executado ON lgpd_purge_log(executado_em DESC);

-- RLS
ALTER TABLE lgpd_purge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role can write purge logs"
  ON lgpd_purge_log
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Admins can read purge logs"
  ON lgpd_purge_log
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  ));

COMMENT ON TABLE lgpd_purge_log IS 'Log de auditoria de todas as purgas executadas — imutável para compliance';
COMMENT ON COLUMN lgpd_purge_log.acao IS 'anonimizado (substitui com DADOS_REMOVIDOS) ou excluido (hard delete)';

-- ──────────────────────────────────────────────────────────
-- 3. Configuração de Políticas de Retenção
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lgpd_retencao_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Tabela e coluna de data
  tabela TEXT NOT NULL,
  coluna_data TEXT NOT NULL,

  -- Política de retenção
  dias_retencao INTEGER NOT NULL CHECK (dias_retencao > 0),

  -- Ação ao vencer prazo
  acao TEXT NOT NULL DEFAULT 'anonimizar' CHECK (acao IN ('anonimizar', 'excluir')),

  -- Campos a anonimizar (se aplicável)
  campos_anonimizar TEXT[] DEFAULT '{}',

  -- Ativo/Inativo
  ativo BOOLEAN DEFAULT true,

  -- Descrição e contexto
  descricao TEXT,
  motivo TEXT,

  -- Auditoria
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  criado_por UUID DEFAULT auth.uid()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lgpd_retencao_tabela ON lgpd_retencao_config(tabela);
CREATE INDEX IF NOT EXISTS idx_lgpd_retencao_ativo ON lgpd_retencao_config(ativo);

-- RLS
ALTER TABLE lgpd_retencao_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role can read retention config"
  ON lgpd_retencao_config
  TO service_role
  USING (true);

CREATE POLICY IF NOT EXISTS "Admins can manage retention config"
  ON lgpd_retencao_config
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  ));

COMMENT ON TABLE lgpd_retencao_config IS 'Configuração de políticas de retenção — aplicadas automaticamente por cron';
COMMENT ON COLUMN lgpd_retencao_config.dias_retencao IS 'Dias após criado_em para reter dados. Após esse prazo, acao é executada.';
COMMENT ON COLUMN lgpd_retencao_config.campos_anonimizar IS 'Array de nomes de coluna a anonimizar (ex: ARRAY[''nome'', ''email'', ''cpf''])';

-- ──────────────────────────────────────────────────────────
-- 4. Políticas de Retenção Iniciais
-- ──────────────────────────────────────────────────────────
-- Baseadas em LGPD (Lei 13.709/2018) e requisitos de compliance MEC

INSERT INTO lgpd_retencao_config (tabela, coluna_data, dias_retencao, acao, campos_anonimizar, descricao, motivo)
VALUES
  -- Logs operacionais: 90 dias (propósito de segurança vencido)
  ('audit_trail', 'criado_em', 90, 'excluir', '{}', 'Trilha de auditoria operacional', 'Compliance LGPD — propósito de investigação/segurança vencido após 90 dias'),
  ('ia_usage_log', 'created_at', 90, 'excluir', '{}', 'Logs de uso de IA', 'Compliance LGPD — dados de processamento temporário'),

  -- Logs de consulta pública: 365 dias (rastreamento de acesso vencido)
  ('portal_logs_consulta', 'created_at', 365, 'anonimizar', ARRAY['cpf_hash', 'ip_hash'], 'Logs de consulta do portal público', 'Compliance LGPD — retenção por 1 ano para segurança'),

  -- Sessões de extração: 30 dias (sessão temporária)
  ('extracao_sessoes', 'created_at', 30, 'excluir', '{}', 'Sessões de extração de dados', 'Compliance LGPD — sessões temporárias'),

  -- Configurações alteradas: 365 dias (auditoria legal)
  ('config_audit_log', 'created_at', 365, 'excluir', '{}', 'Logs de alteração de configurações', 'Compliance legal — rastreamento de modificações críticas')

ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 5. Função Helper para Anonimizar Registros
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION anonimizar_registro(
  p_tabela TEXT,
  p_id TEXT,
  p_campos JSONB
)
RETURNS TABLE (sucesso BOOLEAN, registros_afetados INTEGER) AS $$
DECLARE
  v_campo TEXT;
  v_valor TEXT;
  v_query TEXT;
  v_count INTEGER := 0;
BEGIN
  -- Construir UPDATE dinâmico com campos específicos
  v_query := 'UPDATE ' || quote_ident(p_tabela) || ' SET ';

  FOR v_campo IN SELECT jsonb_object_keys(p_campos)
  LOOP
    v_valor := p_campos ->> v_campo;
    v_query := v_query || quote_ident(v_campo) || ' = ' || quote_literal(v_valor) || ', ';
  END LOOP;

  -- Remover a última vírgula e adicionar cláusula WHERE
  v_query := SUBSTRING(v_query FROM 1 FOR LENGTH(v_query) - 2);
  v_query := v_query || ' WHERE id = ' || quote_literal(p_id);

  EXECUTE v_query;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT true AS sucesso, v_count AS registros_afetados;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false AS sucesso, 0 AS registros_afetados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION anonimizar_registro IS 'Função helper para anonimizar um registro dinâmicamente';

-- ──────────────────────────────────────────────────────────
-- 6. View para Monitoramento de Purgas
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_lgpd_purge_status AS
SELECT
  pq.id,
  pq.tipo,
  pq.status,
  pq.alvo_user_id,
  pq.alvo_tabela,
  COUNT(pl.id) as logs_count,
  SUM(pl.registros_afetados) as registros_total,
  pq.criado_em,
  pq.processado_em,
  pq.erro_mensagem,
  (pq.processado_em - pq.criado_em) as duracao_processamento
FROM lgpd_purge_queue pq
LEFT JOIN lgpd_purge_log pl ON pq.id = pl.purge_queue_id
GROUP BY pq.id;

COMMENT ON VIEW v_lgpd_purge_status IS 'View para monitoramento de status de purgas LGPD';

-- ──────────────────────────────────────────────────────────
-- 7. Triggers de Auditoria
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_lgpd_purge_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'concluido' THEN
    INSERT INTO audit_trail (usuario_id, acao, entidade, entidade_id, detalhes)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
      'lgpd_purge_completed',
      'lgpd_purge',
      NEW.id::TEXT,
      jsonb_build_object(
        'tipo', NEW.tipo,
        'alvo_user_id', NEW.alvo_user_id,
        'alvo_tabela', NEW.alvo_tabela,
        'processado_em', NEW.processado_em,
        'contexto', NEW.contexto
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_purge_changes
  AFTER UPDATE ON lgpd_purge_queue
  FOR EACH ROW
  EXECUTE FUNCTION audit_lgpd_purge_changes();

COMMENT ON TRIGGER trg_audit_purge_changes ON lgpd_purge_queue IS 'Auditoria automática de mudanças de status em purgas';
