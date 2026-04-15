-- ============================================================
-- Migration: Bloco F — Premissas Profundas
-- Sessão 138 — Adiciona coluna deep_premises JSONB à tabela
-- development_parcelamento_scenarios
-- ============================================================

-- Coluna JSONB para armazenar as premissas profundas (4 abas)
-- Estrutura: { project, sales, land, costs }
ALTER TABLE development_parcelamento_scenarios
ADD COLUMN IF NOT EXISTS deep_premises JSONB DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN development_parcelamento_scenarios.deep_premises IS
  'Premissas profundas do Bloco F: { project, sales, land, costs }. Armazena premissas detalhadas de Projeto, Vendas, Terreno e Custos incluindo tabela de infraestrutura, viário, terraplanagem, etc.';

-- Index GIN para eventual busca dentro do JSONB (útil para queries futuras)
CREATE INDEX IF NOT EXISTS idx_scenarios_deep_premises
  ON development_parcelamento_scenarios
  USING GIN (deep_premises);
