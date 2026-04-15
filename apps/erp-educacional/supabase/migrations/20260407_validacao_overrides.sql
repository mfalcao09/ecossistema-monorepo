-- ============================================================
-- Tabela validacao_overrides — Princípio do Override Humano
-- ERP Educacional FIC — Data: 2026-04-07
--
-- Princípio: Toda validação automática de regra de NEGÓCIO
-- (não confundir com validação de schema XSD obrigatório)
-- DEVE permitir que o operador humano sobrescreva a regra
-- mediante justificativa textual obrigatória.
--
-- Por que: o domínio (educação) tem infinitas exceções
-- legítimas que nenhuma regra automática consegue cobrir
-- (grades antigas, casos especiais aprovados pelo conselho,
-- alunos transferidos, dispensas, etc.). Se o sistema bloquear
-- em definitivo, o operador contornará via SQL direto e
-- perderemos o rastro. Permitindo override registrado,
-- mantemos auditoria completa e o operador tem autonomia.
--
-- Esta tabela é a base de TODOS os overrides do sistema.
-- Cada regra de negócio com guardrail deve gravar aqui.
-- ============================================================

CREATE TABLE IF NOT EXISTS validacao_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identificação da entidade afetada (ex: 'diploma', 'historico', 'curso')
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT NOT NULL,

  -- Código da regra que foi sobrescrita
  -- Ex: 'CARGA_HORARIA_INTEGRALIZADA_MENOR_QUE_TOTAL'
  --     'DATA_COLACAO_ANTES_DATA_INGRESSO'
  --     'CPF_INVALIDO_FORMATO'
  regra_codigo TEXT NOT NULL,

  -- Snapshot dos valores que dispararam o aviso
  -- (formato livre, depende da regra)
  valores_originais JSONB NOT NULL,

  -- Justificativa textual obrigatória (mínimo 10 caracteres)
  justificativa TEXT NOT NULL CHECK (length(trim(justificativa)) >= 10),

  -- Quem aprovou o override
  usuario_id UUID NOT NULL,

  -- Quando
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para auditoria e consultas comuns
CREATE INDEX IF NOT EXISTS idx_validacao_overrides_entidade
  ON validacao_overrides(entidade_tipo, entidade_id);

CREATE INDEX IF NOT EXISTS idx_validacao_overrides_regra
  ON validacao_overrides(regra_codigo);

CREATE INDEX IF NOT EXISTS idx_validacao_overrides_usuario
  ON validacao_overrides(usuario_id);

CREATE INDEX IF NOT EXISTS idx_validacao_overrides_created_at
  ON validacao_overrides(created_at DESC);

-- Comentários (visíveis no dashboard Supabase)
COMMENT ON TABLE validacao_overrides IS
  'Registro de todos os overrides humanos a validações automáticas de regra de negócio. NÃO inclui overrides de schema XSD (que não podem ser sobrescritos). Auditoria completa: regra, valores originais, justificativa, usuário, timestamp.';

COMMENT ON COLUMN validacao_overrides.regra_codigo IS
  'Código da regra sobrescrita. Convenção: SCREAMING_SNAKE_CASE descritivo. Ex: CARGA_HORARIA_INTEGRALIZADA_MENOR_QUE_TOTAL.';

COMMENT ON COLUMN validacao_overrides.valores_originais IS
  'Snapshot JSON dos valores que dispararam a regra. Permite reconstruir o contexto da decisão.';

COMMENT ON COLUMN validacao_overrides.justificativa IS
  'Texto livre obrigatório (mínimo 10 caracteres) explicando POR QUE o operador decidiu sobrescrever.';
