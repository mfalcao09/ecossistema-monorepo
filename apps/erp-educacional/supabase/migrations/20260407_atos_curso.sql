-- ============================================================
-- Tabela atos_curso — Bug #G
-- ERP Educacional FIC — Data: 2026-04-07
--
-- Substitui os campos planos da tabela `cursos` (tipo_autorizacao,
-- numero_autorizacao, data_autorizacao, tipo_reconhecimento,
-- numero_reconhecimento, ..., tipo_renovacao, ...) por uma tabela
-- dedicada que espelha o padrão da `credenciamentos` (Bug #7).
--
-- Permite múltiplos registros históricos por curso e mantém a regra
-- de negócio "1 reconhecimento + renovação mais recente vai pro XML"
-- na função buscarAtosCurso() do montador.ts.
--
-- Os campos planos da tabela `cursos` permanecem por ora (deprecados)
-- para não quebrar imports legados; remoção em migração futura.
-- ============================================================

CREATE TABLE IF NOT EXISTS atos_curso (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('Autorizacao','Reconhecimento','RenovacaoReconhecimento')),
  vigente BOOLEAN DEFAULT TRUE,
  tipo_ato TEXT,
  numero TEXT,
  data DATE,
  veiculo_publicacao TEXT,
  numero_dou TEXT,
  data_publicacao_dou DATE,
  secao_dou TEXT,
  pagina_dou TEXT,
  observacoes TEXT,
  arquivo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atos_curso_curso ON atos_curso(curso_id);
CREATE INDEX IF NOT EXISTS idx_atos_curso_tipo ON atos_curso(curso_id, tipo);
CREATE INDEX IF NOT EXISTS idx_atos_curso_data ON atos_curso(data DESC);

COMMENT ON TABLE atos_curso IS
  'Atos regulatorios do curso (Autorizacao, Reconhecimento, RenovacaoReconhecimento). Espelha credenciamentos da IES. Bug #G — substitui campos planos de cursos.';

COMMENT ON COLUMN atos_curso.tipo IS
  'Tipo do ato: Autorizacao, Reconhecimento, RenovacaoReconhecimento';

-- ── Backfill a partir dos campos planos da tabela cursos ──────────────
-- Idempotente: usa NOT EXISTS para não duplicar em re-run.

INSERT INTO atos_curso (curso_id, tipo, tipo_ato, numero, data, veiculo_publicacao, numero_dou, data_publicacao_dou, secao_dou, pagina_dou)
SELECT c.id, 'Autorizacao', c.tipo_autorizacao, c.numero_autorizacao, c.data_autorizacao,
       c.veiculo_publicacao_autorizacao, c.numero_dou_autorizacao, c.data_publicacao_autorizacao,
       c.secao_publicacao_autorizacao::text, c.pagina_publicacao_autorizacao::text
FROM cursos c
WHERE (c.tipo_autorizacao IS NOT NULL OR c.numero_autorizacao IS NOT NULL OR c.data_autorizacao IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM atos_curso a WHERE a.curso_id = c.id AND a.tipo = 'Autorizacao');

INSERT INTO atos_curso (curso_id, tipo, tipo_ato, numero, data, veiculo_publicacao, numero_dou, data_publicacao_dou, secao_dou, pagina_dou)
SELECT c.id, 'Reconhecimento', c.tipo_reconhecimento, c.numero_reconhecimento, c.data_reconhecimento,
       c.veiculo_publicacao_reconhecimento, c.numero_dou_reconhecimento, c.data_publicacao_reconhecimento,
       c.secao_publicacao_reconhecimento::text, c.pagina_publicacao_reconhecimento::text
FROM cursos c
WHERE (c.tipo_reconhecimento IS NOT NULL OR c.numero_reconhecimento IS NOT NULL OR c.data_reconhecimento IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM atos_curso a WHERE a.curso_id = c.id AND a.tipo = 'Reconhecimento');

INSERT INTO atos_curso (curso_id, tipo, tipo_ato, numero, data, veiculo_publicacao, numero_dou, data_publicacao_dou, secao_dou, pagina_dou)
SELECT c.id, 'RenovacaoReconhecimento', c.tipo_renovacao, c.numero_renovacao, c.data_renovacao,
       c.veiculo_publicacao_renovacao, c.numero_dou_renovacao, c.data_publicacao_renovacao,
       c.secao_publicacao_renovacao::text, c.pagina_publicacao_renovacao::text
FROM cursos c
WHERE (c.tipo_renovacao IS NOT NULL OR c.numero_renovacao IS NOT NULL OR c.data_renovacao IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM atos_curso a WHERE a.curso_id = c.id AND a.tipo = 'RenovacaoReconhecimento');
