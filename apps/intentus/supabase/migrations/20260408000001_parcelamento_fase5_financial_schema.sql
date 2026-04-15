-- =============================================================================
-- Migration: parcelamento_fase5_financial_schema
-- Módulo:    Parcelamento de Solo — Fase 5 Bloco A (Engenharia Financeira)
-- Data:      2026-04-08
-- Sessão:    123
-- Autor:     Claudinho (Claude Sonnet 4.6)
-- Decisão:   Marcelo aprovou Opção B (híbrido) — manter tabela
--            development_parcelamento_financial como "header" e adicionar
--            3 tabelas-filhas especializadas.
-- Princípio: Design pedagógico — cada tabela guarda metadados explicativos
--            (componentes, fórmulas, descrições) para drill-down in-loco
--            sem recalcular. Ver: memory/projects/
--            parcelamento-solo-FASE5-DESIGN-PEDAGOGICO.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Evoluir development_parcelamento_financial (header)
--    Adiciona suporte a múltiplos cenários + metadados pedagógicos
-- ---------------------------------------------------------------------------
ALTER TABLE development_parcelamento_financial
  -- Novo: scenario_type facilita comparação lado a lado na aba "Comparação"
  ADD COLUMN IF NOT EXISTS scenario_type text DEFAULT 'realista'
    CHECK (scenario_type IN ('conservador','realista','otimista','custom')),
  -- Nome amigável do cenário mostrado na UI
  ADD COLUMN IF NOT EXISTS scenario_label text,
  -- WACC (custo médio ponderado de capital) — necessário para VPL correto
  ADD COLUMN IF NOT EXISTS wacc_pct numeric(6,3),
  -- VPL descontado pelo WACC (mais "honesto" que VPL com taxa fixa)
  ADD COLUMN IF NOT EXISTS vpl_wacc numeric(14,2),
  -- Payback descontado (considerando valor do dinheiro no tempo)
  ADD COLUMN IF NOT EXISTS payback_descontado_meses integer,
  -- Performance Score 0-100 (aba 6)
  ADD COLUMN IF NOT EXISTS performance_score numeric(5,2),
  -- Estrutura de capital (aba 7): dívida x equity x SCP
  ADD COLUMN IF NOT EXISTS capital_structure jsonb,
  -- Resultado cacheado do Monte Carlo (aba 5) — 1000 iterações
  ADD COLUMN IF NOT EXISTS monte_carlo jsonb,
  -- Metadados pedagógicos: fórmulas, componentes, explicações por KPI
  -- Shape esperado: { "tir": { "formula": "...", "componentes": {...}, "explicacao": "..." }, ... }
  ADD COLUMN IF NOT EXISTS kpi_metadata jsonb DEFAULT '{}'::jsonb,
  -- Flag: análise já foi calculada ou ainda é rascunho de premissas?
  ADD COLUMN IF NOT EXISTS is_calculated boolean DEFAULT false,
  -- Timestamp do último cálculo (cache invalidation)
  ADD COLUMN IF NOT EXISTS calculated_at timestamptz;

-- Remove a unique constraint antiga (só um active por dev) porque agora
-- queremos 3 cenários active simultaneamente por development
DROP INDEX IF EXISTS idx_dpfin_dev_version;

-- Nova unique: um cenário por tipo por dev (conservador, realista, otimista, custom)
-- permite comparação lado a lado sem conflito
CREATE UNIQUE INDEX IF NOT EXISTS idx_dpfin_dev_scenario
  ON development_parcelamento_financial(development_id, scenario_type, version)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_dpfin_calculated
  ON development_parcelamento_financial(is_calculated)
  WHERE is_calculated = true;


-- ---------------------------------------------------------------------------
-- 2. development_parcelamento_scenarios
--    Premissas versionadas do cenário. Separar de "financial" permite
--    o usuário brincar com premissas (sliders de sensibilidade) sem
--    sobrescrever o resultado calculado anterior.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS development_parcelamento_scenarios (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_id        uuid NOT NULL REFERENCES development_parcelamento_financial(id) ON DELETE CASCADE,
  development_id      uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL,

  -- Identificação
  nome                text NOT NULL,                -- "Base Conservador v1", etc.
  descricao           text,

  -- Premissas de tempo
  prazo_obra_meses              integer NOT NULL,
  prazo_comercializacao_meses   integer NOT NULL,
  mes_inicio_vendas             integer NOT NULL DEFAULT 0,

  -- Premissas de preço e vendas
  preco_medio_lote              numeric(12,2),
  qtd_lotes                     integer,
  velocidade_vendas_pct_mes     numeric(5,2),        -- % do estoque vendido por mês
  inadimplencia_pct             numeric(5,2) DEFAULT 3,

  -- Premissas financeiras
  taxa_desconto_anual_pct       numeric(6,3) NOT NULL DEFAULT 12,
  indice_correcao_mensal_pct    numeric(6,3) DEFAULT 0.5,
  wacc_pct                      numeric(6,3),
  equity_pct                    numeric(5,2) DEFAULT 100,
  divida_pct                    numeric(5,2) DEFAULT 0,
  custo_divida_anual_pct        numeric(6,3) DEFAULT 0,
  aliquota_ir_pct               numeric(5,2),  -- SEM default: usuário DEVE informar (Lucro Presumido 6,73% / RET 4% / etc)

  -- Premissas de recebimento (condições de pagamento médias)
  entrada_pct                   numeric(5,2) DEFAULT 20,
  parcelas_qtd                  integer DEFAULT 60,
  balao_final_pct               numeric(5,2) DEFAULT 0,

  -- Regime tributário — SEM default, obrigatório informar na UI
  regime_tributario             text
    CHECK (regime_tributario IN (
      'lucro_presumido',
      'lucro_real',
      'ret_afetacao',      -- Regime Especial de Tributação (Lei 10.931/04)
      'simples_nacional',
      'nao_definido'
    )) DEFAULT 'nao_definido',

  -- Patrimônio de Afetação (Lei 10.931/04)
  -- Quando true, ATIVA controle de obrigações acessórias no módulo CLM
  patrimonio_afetacao           boolean DEFAULT false,
  ret_ativo                     boolean DEFAULT false,  -- RET 4% (normalmente vinculado à afetação)

  -- Rastreabilidade do "por quê" de cada premissa (pedagógico)
  -- Ex: { "taxa_desconto_anual_pct": "Benchmark Selic + spread de 3pp" }
  premissas_justificativa      jsonb DEFAULT '{}'::jsonb,

  -- Auditoria
  created_by    uuid NOT NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  is_active     boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_dpsc_financial ON development_parcelamento_scenarios(financial_id);
CREATE INDEX IF NOT EXISTS idx_dpsc_dev       ON development_parcelamento_scenarios(development_id);
CREATE INDEX IF NOT EXISTS idx_dpsc_tenant    ON development_parcelamento_scenarios(tenant_id);

CREATE TRIGGER trg_dpsc_updated_at
  BEFORE UPDATE ON development_parcelamento_scenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ---------------------------------------------------------------------------
-- 3. development_parcelamento_cost_items
--    Catálogo de itens de custo. Dois usos:
--    (a) SINAPI seed global (tenant_id NULL, is_catalog=true)
--    (b) itens específicos de um cenário (tenant_id + scenario_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS development_parcelamento_cost_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vínculos — NULL quando é item do catálogo global
  scenario_id     uuid REFERENCES development_parcelamento_scenarios(id) ON DELETE CASCADE,
  tenant_id       uuid,

  -- Taxonomia (alinhada ao SINAPI)
  categoria       text NOT NULL
    CHECK (categoria IN (
      'terreno',          -- aquisição e correlatos
      'projeto',          -- topografia, paisagismo, eng, arq
      'infraestrutura',   -- terraplanagem, pavimentação, drenagem, águas, esgoto, energia
      'legalizacao',      -- taxas, registro, alvarás, licenciamento ambiental
      'obras_complementares', -- portaria, guarita, muros
      'marketing_vendas', -- estande, mídia, comissões
      'tributos',         -- IR, contribuições
      'administrativo',   -- contábil, jurídico, overhead
      'contingencia',     -- reserva
      'financeiro'        -- juros, IOF
    )),
  subcategoria    text,                  -- livre (ex: "pavimentação asfáltica 5cm")
  codigo_sinapi   text,                  -- código oficial quando aplicável
  descricao       text NOT NULL,
  unidade         text,                  -- m², m³, un, vb, %
  quantidade      numeric(14,4),
  valor_unitario  numeric(14,4),
  valor_total     numeric(14,2) GENERATED ALWAYS AS (
    COALESCE(quantidade,0) * COALESCE(valor_unitario,0)
  ) STORED,

  -- Controle de tempo — quando esse custo ocorre no cronograma
  mes_inicio      integer DEFAULT 0,
  mes_fim         integer,               -- NULL = pontual (paga tudo em mes_inicio)
  curva_desembolso text DEFAULT 'linear'
    CHECK (curva_desembolso IN ('linear','front_load','back_load','custom','pontual')),
  curva_custom    jsonb,                 -- {mes: pct} quando curva_desembolso='custom'

  -- Metadados pedagógicos
  fonte_referencia text,                 -- "SINAPI SP jan/2026", "orçamento fornecedor X"
  observacao       text,                 -- explicação livre

  -- Catálogo global (sem tenant, sem scenario)
  is_catalog      boolean DEFAULT false,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  is_active       boolean DEFAULT true,

  -- Ou é item de catálogo global, ou pertence a um cenário — nunca ambos
  CONSTRAINT chk_catalog_or_scenario CHECK (
    (is_catalog = true  AND scenario_id IS NULL AND tenant_id IS NULL)
    OR
    (is_catalog = false AND scenario_id IS NOT NULL AND tenant_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_dpci_scenario ON development_parcelamento_cost_items(scenario_id);
CREATE INDEX IF NOT EXISTS idx_dpci_tenant   ON development_parcelamento_cost_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dpci_categoria ON development_parcelamento_cost_items(categoria);
CREATE INDEX IF NOT EXISTS idx_dpci_catalog
  ON development_parcelamento_cost_items(categoria)
  WHERE is_catalog = true;

CREATE TRIGGER trg_dpci_updated_at
  BEFORE UPDATE ON development_parcelamento_cost_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ---------------------------------------------------------------------------
-- 4. development_parcelamento_cash_flow_rows
--    Série temporal mês-a-mês queryável. Uma linha por mês do cronograma.
--    Permite gráficos rápidos e drill-down por categoria sem parsear JSONB.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS development_parcelamento_cash_flow_rows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     uuid NOT NULL REFERENCES development_parcelamento_scenarios(id) ON DELETE CASCADE,
  financial_id    uuid NOT NULL REFERENCES development_parcelamento_financial(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,

  -- Tempo
  mes_numero      integer NOT NULL,               -- 0, 1, 2, 3... (relativo ao início)
  mes_data        date,                           -- data absoluta quando definida
  periodo_label   text,                           -- "Mês 1", "Jan/2026"

  -- Entradas
  entrada_vendas        numeric(14,2) DEFAULT 0,
  entrada_financiamento numeric(14,2) DEFAULT 0,
  entrada_outras        numeric(14,2) DEFAULT 0,
  entrada_total         numeric(14,2) GENERATED ALWAYS AS (
    COALESCE(entrada_vendas,0) + COALESCE(entrada_financiamento,0) + COALESCE(entrada_outras,0)
  ) STORED,

  -- Saídas por categoria (mesma taxonomia dos cost_items)
  saida_terreno         numeric(14,2) DEFAULT 0,
  saida_projeto         numeric(14,2) DEFAULT 0,
  saida_infraestrutura  numeric(14,2) DEFAULT 0,
  saida_legalizacao     numeric(14,2) DEFAULT 0,
  saida_obras_comp      numeric(14,2) DEFAULT 0,
  saida_marketing       numeric(14,2) DEFAULT 0,
  saida_tributos        numeric(14,2) DEFAULT 0,
  saida_administrativo  numeric(14,2) DEFAULT 0,
  saida_contingencia    numeric(14,2) DEFAULT 0,
  saida_financeiro      numeric(14,2) DEFAULT 0,
  saida_total           numeric(14,2) GENERATED ALWAYS AS (
    COALESCE(saida_terreno,0) + COALESCE(saida_projeto,0) +
    COALESCE(saida_infraestrutura,0) + COALESCE(saida_legalizacao,0) +
    COALESCE(saida_obras_comp,0) + COALESCE(saida_marketing,0) +
    COALESCE(saida_tributos,0) + COALESCE(saida_administrativo,0) +
    COALESCE(saida_contingencia,0) + COALESCE(saida_financeiro,0)
  ) STORED,

  -- Saldo do período e acumulado
  saldo_periodo         numeric(14,2) GENERATED ALWAYS AS (
    (COALESCE(entrada_vendas,0) + COALESCE(entrada_financiamento,0) + COALESCE(entrada_outras,0)) -
    (COALESCE(saida_terreno,0) + COALESCE(saida_projeto,0) +
     COALESCE(saida_infraestrutura,0) + COALESCE(saida_legalizacao,0) +
     COALESCE(saida_obras_comp,0) + COALESCE(saida_marketing,0) +
     COALESCE(saida_tributos,0) + COALESCE(saida_administrativo,0) +
     COALESCE(saida_contingencia,0) + COALESCE(saida_financeiro,0))
  ) STORED,

  saldo_acumulado       numeric(14,2),            -- calculado pela EF (roll-up)
  saldo_acumulado_vp    numeric(14,2),            -- valor presente do saldo acumulado

  created_at            timestamptz DEFAULT now(),
  UNIQUE (scenario_id, mes_numero)
);

CREATE INDEX IF NOT EXISTS idx_dpcfr_scenario ON development_parcelamento_cash_flow_rows(scenario_id);
CREATE INDEX IF NOT EXISTS idx_dpcfr_financial ON development_parcelamento_cash_flow_rows(financial_id);
CREATE INDEX IF NOT EXISTS idx_dpcfr_tenant ON development_parcelamento_cash_flow_rows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dpcfr_mes ON development_parcelamento_cash_flow_rows(scenario_id, mes_numero);


-- ---------------------------------------------------------------------------
-- 4B. development_parcelamento_afetacao_obligations
--     Controle de obrigações acessórias do Patrimônio de Afetação (Lei 10.931/04)
--     Ativadas automaticamente quando scenarios.patrimonio_afetacao = true
--     Cada obrigação tem periodicidade, base legal, responsável e status
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS development_parcelamento_afetacao_obligations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     uuid NOT NULL REFERENCES development_parcelamento_scenarios(id) ON DELETE CASCADE,
  development_id  uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,

  -- Taxonomia da obrigação
  obligation_key  text NOT NULL,
  -- Valores possíveis (catálogo inicial):
  --   'averbacao_registro_imoveis'        — averbar termo de afetação (única)
  --   'conta_bancaria_segregada'          — manter conta separada (contínua)
  --   'contabilidade_segregada'           — contabilidade da afetação (contínua)
  --   'demonstracoes_trimestrais'         — DF trimestrais (trimestral)
  --   'relatorio_comissao_representantes' — relatório à comissão (trimestral)
  --   'prestacao_contas_adquirentes'      — prestação mensal aos compradores (mensal)
  --   'nomeacao_comissao_representantes'  — comissão (única)
  --   'ret_recolhimento_mensal'           — guia RET mensal (mensal, só se ret_ativo)
  --   'obrigacao_acessoria_receita'       — EFD, DCTF, etc (mensal)

  obligation_label text NOT NULL,
  legal_basis      text,                 -- "Lei 10.931/04 art. 31-D", etc.

  -- Periodicidade
  periodicity      text NOT NULL
    CHECK (periodicity IN ('unica','mensal','trimestral','semestral','anual','continua')),
  due_day          integer,              -- dia do mês (1-31) quando mensal/trimestral
  next_due_date    date,                 -- próxima data de vencimento calculada

  -- Status
  status           text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_dia','atrasada','cumprida','dispensada','suspensa')),

  -- Responsável (quem cumpre)
  responsible_role text,                 -- 'contador','juridico','comissao','incorporador'
  responsible_user uuid,                 -- profile específico opcional

  -- Conteúdo/comprovante
  last_evidence_url text,                -- link para documento no storage
  last_evidence_at  timestamptz,
  observacoes       text,

  -- Auditoria
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  is_active    boolean DEFAULT true,
  UNIQUE (scenario_id, obligation_key)
);

CREATE INDEX IF NOT EXISTS idx_dpao_scenario ON development_parcelamento_afetacao_obligations(scenario_id);
CREATE INDEX IF NOT EXISTS idx_dpao_dev      ON development_parcelamento_afetacao_obligations(development_id);
CREATE INDEX IF NOT EXISTS idx_dpao_tenant   ON development_parcelamento_afetacao_obligations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dpao_status   ON development_parcelamento_afetacao_obligations(status)
  WHERE status IN ('pendente','atrasada');
CREATE INDEX IF NOT EXISTS idx_dpao_due      ON development_parcelamento_afetacao_obligations(next_due_date)
  WHERE is_active = true AND status IN ('pendente','em_dia');

CREATE TRIGGER trg_dpao_updated_at
  BEFORE UPDATE ON development_parcelamento_afetacao_obligations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ---------------------------------------------------------------------------
-- 5. RLS Policies
-- ---------------------------------------------------------------------------

-- 5A. scenarios
ALTER TABLE development_parcelamento_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpsc_select_own" ON development_parcelamento_scenarios FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpsc_insert_own" ON development_parcelamento_scenarios FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND created_by = auth.uid());
CREATE POLICY "dpsc_update_own" ON development_parcelamento_scenarios FOR UPDATE
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpsc_delete_own" ON development_parcelamento_scenarios FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- 5B. cost_items — catálogo é leitura pública; itens de cenário só do tenant
ALTER TABLE development_parcelamento_cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpci_select_catalog_or_own" ON development_parcelamento_cost_items FOR SELECT
  USING (
    is_catalog = true
    OR tenant_id = auth_tenant_id()
  );
CREATE POLICY "dpci_insert_own_scenario" ON development_parcelamento_cost_items FOR INSERT
  WITH CHECK (
    is_catalog = false
    AND tenant_id = auth_tenant_id()
  );
CREATE POLICY "dpci_update_own" ON development_parcelamento_cost_items FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND is_catalog = false);
CREATE POLICY "dpci_delete_own" ON development_parcelamento_cost_items FOR DELETE
  USING (tenant_id = auth_tenant_id() AND is_catalog = false);

-- 5C-bis. afetacao_obligations
ALTER TABLE development_parcelamento_afetacao_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpao_select_own" ON development_parcelamento_afetacao_obligations FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpao_insert_own" ON development_parcelamento_afetacao_obligations FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "dpao_update_own" ON development_parcelamento_afetacao_obligations FOR UPDATE
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpao_delete_own" ON development_parcelamento_afetacao_obligations FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- 5D. cash_flow_rows
ALTER TABLE development_parcelamento_cash_flow_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpcfr_select_own" ON development_parcelamento_cash_flow_rows FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpcfr_insert_own" ON development_parcelamento_cash_flow_rows FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "dpcfr_update_own" ON development_parcelamento_cash_flow_rows FOR UPDATE
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpcfr_delete_own" ON development_parcelamento_cash_flow_rows FOR DELETE
  USING (tenant_id = auth_tenant_id());


-- ---------------------------------------------------------------------------
-- 6. Seed mínimo do catálogo SINAPI — referências genéricas iniciais
--    Ingestão mensal completa será tratada em sessão separada (backlog #14)
-- ---------------------------------------------------------------------------
INSERT INTO development_parcelamento_cost_items
  (categoria, codigo_sinapi, descricao, unidade, valor_unitario, is_catalog, fonte_referencia)
VALUES
  ('infraestrutura', 'SINAPI-72961', 'Pavimentação asfáltica CBUQ 5cm',       'm2', 58.00, true, 'SINAPI jan/2026 (seed inicial)'),
  ('infraestrutura', 'SINAPI-74079', 'Terraplanagem — corte e aterro mecânico', 'm3', 12.50, true, 'SINAPI jan/2026 (seed inicial)'),
  ('infraestrutura', 'SINAPI-98547', 'Rede de drenagem pluvial DN 400',       'm',  180.00, true, 'SINAPI jan/2026 (seed inicial)'),
  ('infraestrutura', 'SINAPI-89502', 'Rede de água DN 50 PVC',                'm',  42.00, true, 'SINAPI jan/2026 (seed inicial)'),
  ('infraestrutura', 'SINAPI-89797', 'Rede coletora de esgoto DN 150',        'm',  95.00, true, 'SINAPI jan/2026 (seed inicial)'),
  ('infraestrutura', 'SINAPI-73998', 'Meio-fio pré-moldado de concreto',      'm',  38.00, true, 'SINAPI jan/2026 (seed inicial)'),
  ('projeto',        NULL,           'Projeto urbanístico completo',          'vb', 50000.00, true, 'Benchmark de mercado (seed)'),
  ('projeto',        NULL,           'Levantamento topográfico planialtimétrico','ha', 1200.00, true, 'Benchmark de mercado (seed)'),
  ('legalizacao',    NULL,           'Taxa de registro de loteamento (CRI)',  'vb', 15000.00, true, 'Estimativa genérica (seed)'),
  ('legalizacao',    NULL,           'Licenciamento ambiental (LP+LI+LO)',    'vb', 25000.00, true, 'Estimativa genérica (seed)'),
  ('marketing_vendas', NULL,         'Comissão de vendas (% sobre VGV)',      '%',  6.0,    true, 'Padrão de mercado'),
  ('contingencia',   NULL,           'Reserva de contingência (% sobre obra)', '%', 5.0,    true, 'Boa prática de engenharia')
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- FIM — Migration Fase 5 Bloco A: Schema Financeiro Híbrido
-- Próximo passo: Edge Function parcelamento-financial-calc
-- ---------------------------------------------------------------------------
