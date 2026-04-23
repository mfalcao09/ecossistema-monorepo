-- =============================================================================
-- Atendimento · Dashboards personalizados (ADR-020)
-- -----------------------------------------------------------------------------
-- Evolui o schema S7 (commit 588fdf1) para suportar múltiplos dashboards por
-- usuário, catálogo extensível de widgets e RBAC via S6 (role_permissions).
--
-- Cria:
--   atendimento_dashboards        — agrupador de widgets (por owner_user_id)
--   atendimento_widget_catalog    — catálogo plugável de tipos de widget
--
-- Altera:
--   dashboard_widgets             — adiciona dashboard_id, catalog_slug,
--                                   component_config; metric_key passa a ser NULL-permissive
--
-- Backfill:
--   - Cria dashboard default "Visão Geral" (is_shared=true, is_default=true)
--   - Move widgets seed do S7 (owner_id NULL) para o default
--
-- Idempotente (IF NOT EXISTS + ON CONFLICT DO NOTHING).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. atendimento_dashboards
-- =============================================================================
CREATE TABLE IF NOT EXISTS atendimento_dashboards (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID,                                        -- multi-tenant placeholder
  owner_user_id   UUID,                                        -- NULL = seed/global
  name            VARCHAR(120) NOT NULL,
  slug            VARCHAR(64),
  description     TEXT,
  icon            VARCHAR(32)  NOT NULL DEFAULT 'layout-dashboard',
  is_shared       BOOLEAN      NOT NULL DEFAULT false,          -- visível a todos autenticados (readonly p/ não-owner)
  is_default      BOOLEAN      NOT NULL DEFAULT false,          -- fallback inicial
  pinned_order    INTEGER      NOT NULL DEFAULT 0,
  layout_cols     INTEGER      NOT NULL DEFAULT 12,
  share_role_ids  UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[],-- cargos com acesso ({} = todos autenticados)
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  atendimento_dashboards IS
  'ADR-020: dashboards do módulo Atendimento. owner_user_id NULL = seed global / default.';
COMMENT ON COLUMN atendimento_dashboards.is_shared IS
  'true = visível a todos autenticados (ou cargos em share_role_ids). Edição: apenas owner.';
COMMENT ON COLUMN atendimento_dashboards.is_default IS
  'Dashboard exibido na primeira visita se o usuário não tiver preferência salva.';

CREATE INDEX IF NOT EXISTS idx_atendimento_dashboards_owner
  ON atendimento_dashboards (owner_user_id, pinned_order);
CREATE INDEX IF NOT EXISTS idx_atendimento_dashboards_shared
  ON atendimento_dashboards (is_shared) WHERE is_shared = true;
CREATE UNIQUE INDEX IF NOT EXISTS uq_atendimento_dashboards_owner_name
  ON atendimento_dashboards (COALESCE(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

-- =============================================================================
-- 2. atendimento_widget_catalog
-- -----------------------------------------------------------------------------
-- Catálogo "vivo" — novos widgets viram linha aqui + componente no front.
-- Pós-benchmark (Whaticket/Digisac/Zaapy/Chatwoot/PressTicket) expande via seed.
-- =============================================================================
CREATE TABLE IF NOT EXISTS atendimento_widget_catalog (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             VARCHAR(64) UNIQUE NOT NULL,
  label            VARCHAR(120) NOT NULL,
  description      TEXT,
  category         VARCHAR(32) NOT NULL
                   CHECK (category IN (
                     'kpi', 'chart', 'activity', 'onboarding',
                     'status', 'agent_ia', 'crm', 'quality', 'custom'
                   )),
  widget_type      VARCHAR(32) NOT NULL
                   CHECK (widget_type IN (
                     'kpi_card', 'line_chart', 'bar_chart', 'pie_chart',
                     'funnel', 'table', 'heatmap',
                     -- componentes customizados (render próprio no front):
                     'component'
                   )),
  metric_key       VARCHAR(64),                              -- NULL p/ componentes custom
  component_slug   VARCHAR(64),                              -- referencia componente React (ex: 'canal-status', 'onboarding-steps')
  default_layout   JSONB       NOT NULL DEFAULT '{"w":4,"h":2,"minW":2,"minH":1}'::jsonb,
  default_config   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  icon             VARCHAR(32),
  active           BOOLEAN     NOT NULL DEFAULT true,
  order_weight     INTEGER     NOT NULL DEFAULT 100,
  min_permission   VARCHAR(48) NOT NULL DEFAULT 'dashboard::view',  -- gate de visibilidade (S6)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  atendimento_widget_catalog IS
  'ADR-020: catálogo plugável de widgets. PR B (pós-benchmark) adiciona via INSERT, sem migration.';

CREATE INDEX IF NOT EXISTS idx_widget_catalog_active
  ON atendimento_widget_catalog (active, category, order_weight);

-- =============================================================================
-- 3. Alter dashboard_widgets (S7) — link ao dashboard + catalog_slug
-- =============================================================================
ALTER TABLE dashboard_widgets
  ADD COLUMN IF NOT EXISTS dashboard_id     UUID REFERENCES atendimento_dashboards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS catalog_slug     VARCHAR(64),
  ADD COLUMN IF NOT EXISTS component_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- metric_key passa a ser NULL-permissive (widgets custom sem métrica)
ALTER TABLE dashboard_widgets
  ALTER COLUMN metric_key DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard
  ON dashboard_widgets (dashboard_id, sort_order);

-- =============================================================================
-- 4. Backfill — cria dashboard default e vincula widgets seed S7
-- =============================================================================
DO $$
DECLARE
  default_dash_id UUID;
BEGIN
  -- Cria (ou reutiliza) o dashboard default "Visão Geral"
  SELECT id INTO default_dash_id
    FROM atendimento_dashboards
   WHERE owner_user_id IS NULL AND is_default = true
   LIMIT 1;

  IF default_dash_id IS NULL THEN
    INSERT INTO atendimento_dashboards
      (account_id, owner_user_id, name, description, icon,
       is_shared, is_default, pinned_order)
    VALUES
      (NULL, NULL, 'Visão Geral',
       'Dashboard inicial do módulo Atendimento. Personalize criando suas próprias dashboards.',
       'layout-dashboard', true, true, 0)
    RETURNING id INTO default_dash_id;
  END IF;

  -- Vincula widgets "órfãos" (seed S7 com owner_id NULL e sem dashboard_id) ao default
  UPDATE dashboard_widgets
     SET dashboard_id = default_dash_id
   WHERE dashboard_id IS NULL
     AND owner_id IS NULL;
END
$$;

-- =============================================================================
-- 5. Trigger auto updated_at
-- =============================================================================
DROP TRIGGER IF EXISTS trg_atendimento_dashboards_touch ON atendimento_dashboards;
CREATE TRIGGER trg_atendimento_dashboards_touch
  BEFORE UPDATE ON atendimento_dashboards
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_widget_catalog_touch ON atendimento_widget_catalog;
CREATE TRIGGER trg_widget_catalog_touch
  BEFORE UPDATE ON atendimento_widget_catalog
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- 6. Seed catálogo — 17 widgets (7 S7 existentes + 10 Helena-confirmados)
-- -----------------------------------------------------------------------------
-- PR B adiciona os widgets diferenciais descobertos no benchmark adicional.
-- =============================================================================
INSERT INTO atendimento_widget_catalog
  (slug, label, description, category, widget_type, metric_key, component_slug,
   default_layout, default_config, icon, order_weight, min_permission)
VALUES
  -- ── KPIs (S7) ─────────────────────────────────────────────────────────────
  ('kpi_conversations_open',    'Conversas Abertas',          'Conversas em aberto agora',
    'kpi', 'kpi_card', 'conversations_open_end', NULL,
    '{"w":3,"h":1,"minW":2,"minH":1}'::jsonb, '{"range_days":1}'::jsonb,
    'message-square', 10, 'dashboard::view'),
  ('kpi_first_response',        'Tempo Médio 1ª Resposta',    'Média do tempo até primeira resposta humana',
    'kpi', 'kpi_card', 'avg_first_response_sec', NULL,
    '{"w":3,"h":1,"minW":2,"minH":1}'::jsonb, '{"range_days":7}'::jsonb,
    'clock', 20, 'dashboard::view'),
  ('kpi_conversion_rate',       'Conversão CRM',              'Deals ganhos / criados no período',
    'kpi', 'kpi_card', 'conversion_rate_bp', NULL,
    '{"w":3,"h":1,"minW":2,"minH":1}'::jsonb, '{"range_days":30}'::jsonb,
    'target', 30, 'dashboard::view'),
  ('kpi_value_won',             'Valor Ganho (R$)',           'Valor total de deals ganhos',
    'kpi', 'kpi_card', 'deals_value_won_cents', NULL,
    '{"w":3,"h":1,"minW":2,"minH":1}'::jsonb, '{"range_days":30}'::jsonb,
    'dollar-sign', 40, 'dashboard::view'),

  -- ── Gráficos (S7) ─────────────────────────────────────────────────────────
  ('chart_volume_line',         'Volume de Conversas',        'Conversas criadas por dia',
    'chart', 'line_chart', 'conversations_opened', NULL,
    '{"w":8,"h":3,"minW":4,"minH":2}'::jsonb, '{"range_days":30}'::jsonb,
    'activity', 50, 'dashboard::view'),
  ('chart_lead_origin_pie',     'Origem dos Leads',           'Distribuição por canal/fonte',
    'chart', 'pie_chart', 'leads_by_source', NULL,
    '{"w":4,"h":3,"minW":3,"minH":2}'::jsonb, '{"range_days":30}'::jsonb,
    'pie-chart', 60, 'dashboard::view'),

  -- ── Helena-confirmados: capacidade e tempo ────────────────────────────────
  ('chart_capacity_bar',        'Capacidade de Atendimento',  'Novos vs Concluídos vs Pendentes por dia',
    'chart', 'bar_chart', 'conversations_opened', 'capacity-chart',
    '{"w":8,"h":3,"minW":4,"minH":2}'::jsonb,
    '{"range_days":30,"series":["opened","closed","pending"]}'::jsonb,
    'bar-chart-3', 70, 'dashboard::view'),
  ('chart_wait_time',           'Tempo de Espera',            'Distribuição p50 / p90 / p99',
    'chart', 'bar_chart', 'p90_first_response_sec', 'wait-time-chart',
    '{"w":4,"h":3,"minW":3,"minH":2}'::jsonb, '{"range_days":30}'::jsonb,
    'timer', 80, 'dashboard::view'),

  -- ── Helena-confirmados: qualidade ─────────────────────────────────────────
  ('quality_by_user',           'Qualidade por Usuário',      'Atendimentos, 1ª resposta e TMA por operador',
    'quality', 'table', NULL, 'quality-by-user',
    '{"w":6,"h":4,"minW":4,"minH":3}'::jsonb, '{"range_days":30,"limit":10}'::jsonb,
    'users', 90, 'dashboard::view'),
  ('quality_by_team',           'Qualidade por Equipe',       'Mesmas métricas agregadas por equipe',
    'quality', 'table', NULL, 'quality-by-team',
    '{"w":6,"h":4,"minW":4,"minH":3}'::jsonb, '{"range_days":30}'::jsonb,
    'users-2', 100, 'dashboard::view'),

  -- ── Operacionais Nexvy-style ──────────────────────────────────────────────
  ('onboarding_steps',          'Primeiros Passos',           'Checklist de configuração inicial (0/N)',
    'onboarding', 'component', NULL, 'onboarding-steps',
    '{"w":12,"h":2,"minW":6,"minH":2}'::jsonb, '{}'::jsonb,
    'check-circle-2', 5, 'dashboard::view'),
  ('channels_status',           'Status dos Canais',          'Saúde dos canais WhatsApp / Instagram / Messenger',
    'status', 'component', NULL, 'channel-status',
    '{"w":4,"h":3,"minW":3,"minH":2}'::jsonb, '{}'::jsonb,
    'wifi', 110, 'dashboard::view'),
  ('activities_today',          'Atividades do Dia',          'Tarefas/lembretes vencendo hoje',
    'activity', 'component', NULL, 'activities-today',
    '{"w":4,"h":3,"minW":3,"minH":2}'::jsonb, '{}'::jsonb,
    'calendar-check', 120, 'dashboard::view'),
  ('events_today',              'Eventos do Dia',             'Agenda integrada (Microsoft Graph)',
    'activity', 'component', NULL, 'events-today',
    '{"w":4,"h":3,"minW":3,"minH":2}'::jsonb, '{}'::jsonb,
    'calendar', 130, 'dashboard::view'),

  -- ── IA / CRM (S10 + S4) ───────────────────────────────────────────────────
  ('agents_ia_summary',         'Agentes IA',                 'Execuções 24h, taxa de erro e top-3 agentes',
    'agent_ia', 'component', NULL, 'agents-ia-summary',
    '{"w":6,"h":2,"minW":4,"minH":2}'::jsonb, '{}'::jsonb,
    'bot', 140, 'dashboard::view'),
  ('crm_mini',                  'CRM — Negócios em Aberto',   'Total em aberto, valor, taxa de fechamento',
    'crm', 'component', NULL, 'crm-mini',
    '{"w":6,"h":2,"minW":4,"minH":2}'::jsonb, '{}'::jsonb,
    'briefcase', 150, 'dashboard::view'),

  -- ── Classificação (Helena: Aba Resultados) ────────────────────────────────
  ('classification_distribution','Classificação de Atendimentos','Distribuição por tag/etiqueta no período',
    'chart', 'bar_chart', NULL, 'classification-distribution',
    '{"w":6,"h":3,"minW":4,"minH":2}'::jsonb, '{"range_days":30,"limit":8}'::jsonb,
    'tags', 160, 'dashboard::view')

ON CONFLICT (slug) DO UPDATE SET
  label            = EXCLUDED.label,
  description      = EXCLUDED.description,
  category         = EXCLUDED.category,
  widget_type      = EXCLUDED.widget_type,
  metric_key       = EXCLUDED.metric_key,
  component_slug   = EXCLUDED.component_slug,
  default_layout   = EXCLUDED.default_layout,
  default_config   = EXCLUDED.default_config,
  icon             = EXCLUDED.icon,
  order_weight     = EXCLUDED.order_weight,
  min_permission   = EXCLUDED.min_permission,
  updated_at       = NOW();

-- =============================================================================
-- 7. Backfill catalog_slug nos widgets seed S7 (por metric_key)
-- =============================================================================
UPDATE dashboard_widgets SET catalog_slug = 'kpi_conversations_open'
  WHERE catalog_slug IS NULL AND metric_key = 'conversations_open_end' AND widget_type = 'kpi_card';
UPDATE dashboard_widgets SET catalog_slug = 'kpi_first_response'
  WHERE catalog_slug IS NULL AND metric_key = 'avg_first_response_sec' AND widget_type = 'kpi_card';
UPDATE dashboard_widgets SET catalog_slug = 'kpi_conversion_rate'
  WHERE catalog_slug IS NULL AND metric_key = 'conversion_rate_bp' AND widget_type = 'kpi_card';
UPDATE dashboard_widgets SET catalog_slug = 'kpi_value_won'
  WHERE catalog_slug IS NULL AND metric_key = 'deals_value_won_cents' AND widget_type = 'kpi_card';
UPDATE dashboard_widgets SET catalog_slug = 'chart_volume_line'
  WHERE catalog_slug IS NULL AND metric_key = 'conversations_opened' AND widget_type = 'line_chart';
UPDATE dashboard_widgets SET catalog_slug = 'chart_lead_origin_pie'
  WHERE catalog_slug IS NULL AND metric_key = 'leads_by_source' AND widget_type = 'pie_chart';

-- =============================================================================
-- 8. RLS — permissiva (Fase 1). Refinar multi-tenant em sprint futura.
-- =============================================================================
ALTER TABLE atendimento_dashboards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento_widget_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read atendimento_dashboards"     ON atendimento_dashboards;
DROP POLICY IF EXISTS "auth write atendimento_dashboards"    ON atendimento_dashboards;
DROP POLICY IF EXISTS "auth read atendimento_widget_catalog" ON atendimento_widget_catalog;

CREATE POLICY "auth read atendimento_dashboards"
  ON atendimento_dashboards FOR SELECT
  USING (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth write atendimento_dashboards"
  ON atendimento_dashboards FOR ALL
  USING (auth.role() IN ('authenticated','service_role'))
  WITH CHECK (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth read atendimento_widget_catalog"
  ON atendimento_widget_catalog FOR SELECT
  USING (auth.role() IN ('authenticated','service_role'));

COMMIT;
