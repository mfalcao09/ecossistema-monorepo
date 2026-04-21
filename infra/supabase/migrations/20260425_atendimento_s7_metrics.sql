-- =============================================================================
-- Atendimento · Sprint S7 — Dashboards + Relatórios + Widgets Externos
-- -----------------------------------------------------------------------------
-- Cria:
--   metrics_snapshots           — snapshots diários pré-agregados (20+ métricas)
--   dashboard_widgets           — configuração dos widgets na home /atendimento
--   report_definitions          — relatórios salvos (com filtros reutilizáveis)
--   widget_share_tokens         — tokens JWT de curta duração p/ iframes externos
-- RPC:
--   compute_daily_metrics(DATE) — agrega 20+ métricas para um dia (UPSERT)
--   get_conversation_funnel     — helper para relatório de funil
--   get_lead_origin_breakdown   — helper para relatório origem dos leads
-- RLS:
--   permissiva (Fase 1 single-tenant; refinado quando multi-tenant vier)
-- -----------------------------------------------------------------------------
-- Feature flag: ATENDIMENTO_DASHBOARDS_ENABLED
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. metrics_snapshots (tabela append-only por (account_id, day))
-- =============================================================================
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              UUID,
  day                     DATE        NOT NULL,

  -- Volume de conversas
  conversations_opened    INTEGER     NOT NULL DEFAULT 0,
  conversations_closed    INTEGER     NOT NULL DEFAULT 0,
  conversations_pending   INTEGER     NOT NULL DEFAULT 0,
  conversations_snoozed   INTEGER     NOT NULL DEFAULT 0,
  conversations_open_end  INTEGER     NOT NULL DEFAULT 0,  -- snapshot aberto às 23:59

  -- Volume de mensagens
  messages_in             INTEGER     NOT NULL DEFAULT 0,
  messages_out            INTEGER     NOT NULL DEFAULT 0,
  templates_sent          INTEGER     NOT NULL DEFAULT 0,

  -- SLA (em segundos — evita divisão na UI)
  avg_first_response_sec  INTEGER,                         -- tempo até 1ª resposta humana
  p50_first_response_sec  INTEGER,
  p90_first_response_sec  INTEGER,
  avg_resolution_sec      INTEGER,                         -- tempo até fechar
  p50_resolution_sec      INTEGER,
  p90_resolution_sec      INTEGER,

  -- Funil CRM
  deals_created           INTEGER     NOT NULL DEFAULT 0,
  deals_won               INTEGER     NOT NULL DEFAULT 0,
  deals_lost              INTEGER     NOT NULL DEFAULT 0,
  deals_value_won_cents   BIGINT      NOT NULL DEFAULT 0,
  deals_value_lost_cents  BIGINT      NOT NULL DEFAULT 0,
  conversion_rate_bp      INTEGER,                         -- base points (0–10000)

  -- Origem
  leads_by_source         JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- {"instagram":12, ...}
  volume_by_inbox         JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- {"<inbox_id>":34, ...}

  -- Atividade dos agentes
  active_agents           INTEGER     NOT NULL DEFAULT 0,
  avg_conversations_per_agent NUMERIC(10,2),

  -- Metadados
  computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source                  VARCHAR(16) NOT NULL DEFAULT 'cron'
                          CHECK (source IN ('cron','manual','backfill')),

  UNIQUE (account_id, day)
);

COMMENT ON TABLE metrics_snapshots IS
  'Snapshots diários pré-agregados para dashboards S7. Computed via RPC compute_daily_metrics(day). UPSERT por (account_id, day).';

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_day
  ON metrics_snapshots (day DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_account_day
  ON metrics_snapshots (account_id, day DESC);

-- =============================================================================
-- 2. dashboard_widgets (configuração do dashboard da home)
-- =============================================================================
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID,
  owner_id        UUID,                                    -- NULL = compartilhado no tenant
  title           VARCHAR(120) NOT NULL,
  widget_type     VARCHAR(32)  NOT NULL
                  CHECK (widget_type IN (
                    'kpi_card',
                    'line_chart',
                    'bar_chart',
                    'pie_chart',
                    'funnel',
                    'table',
                    'heatmap'
                  )),
  metric_key      VARCHAR(64)  NOT NULL,                   -- ex.: 'conversations_opened'
  filters         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  range_days      INTEGER      NOT NULL DEFAULT 30,
  layout          JSONB        NOT NULL DEFAULT '{"x":0,"y":0,"w":4,"h":2}'::jsonb,
  sort_order      INTEGER      NOT NULL DEFAULT 0,
  is_public       BOOLEAN      NOT NULL DEFAULT false,     -- controla se pode gerar share token
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_account
  ON dashboard_widgets (account_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_owner
  ON dashboard_widgets (owner_id);

-- =============================================================================
-- 3. report_definitions (relatórios salvos pelos usuários)
-- =============================================================================
CREATE TABLE IF NOT EXISTS report_definitions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID,
  owner_id        UUID,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  report_type     VARCHAR(32) NOT NULL
                  CHECK (report_type IN (
                    'volume',
                    'sla',
                    'funnel',
                    'agent_performance',
                    'lead_origin',
                    'custom'
                  )),
  filters         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  columns         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  group_by        VARCHAR(32),
  date_range_days INTEGER     NOT NULL DEFAULT 30,
  is_favorite     BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_definitions_account
  ON report_definitions (account_id, is_favorite DESC);

-- =============================================================================
-- 4. widget_share_tokens (iframe externo com JWT curto)
-- =============================================================================
CREATE TABLE IF NOT EXISTS widget_share_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id       UUID        NOT NULL REFERENCES dashboard_widgets ON DELETE CASCADE,
  token_hash      TEXT        NOT NULL UNIQUE,             -- sha256 do JWT (jamais guardar token bruto)
  created_by      UUID,
  expires_at      TIMESTAMPTZ NOT NULL,
  last_used_at    TIMESTAMPTZ,
  use_count       INTEGER     NOT NULL DEFAULT 0,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_widget_share_tokens_widget
  ON widget_share_tokens (widget_id);
CREATE INDEX IF NOT EXISTS idx_widget_share_tokens_active
  ON widget_share_tokens (expires_at)
  WHERE revoked_at IS NULL;

-- =============================================================================
-- 5. Trigger auto-UPDATE updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dashboard_widgets_touch ON dashboard_widgets;
CREATE TRIGGER trg_dashboard_widgets_touch
  BEFORE UPDATE ON dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_report_definitions_touch ON report_definitions;
CREATE TRIGGER trg_report_definitions_touch
  BEFORE UPDATE ON report_definitions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- 6. RPC compute_daily_metrics(target_day DATE)
-- -----------------------------------------------------------------------------
-- Agrega 20+ métricas para o dia em questão (UTC) e faz UPSERT.
-- Idempotente — pode rodar várias vezes no mesmo dia.
-- =============================================================================
CREATE OR REPLACE FUNCTION compute_daily_metrics(target_day DATE)
RETURNS metrics_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  day_start       TIMESTAMPTZ := target_day::timestamptz;
  day_end         TIMESTAMPTZ := (target_day + INTERVAL '1 day')::timestamptz;
  row             metrics_snapshots;
BEGIN
  -- ── Volumes de conversa ──────────────────────────────────────────────────
  WITH conv_day AS (
    SELECT
      c.id,
      c.status,
      c.created_at,
      c.updated_at,
      c.inbox_id
    FROM atendimento_conversations c
    WHERE c.created_at >= day_start AND c.created_at < day_end
  ),
  closed_day AS (
    SELECT id FROM atendimento_conversations
    WHERE status = 'resolved'
      AND updated_at >= day_start AND updated_at < day_end
  ),
  pending_day AS (
    SELECT id FROM atendimento_conversations
    WHERE status = 'pending'
      AND updated_at >= day_start AND updated_at < day_end
  ),
  snoozed_day AS (
    SELECT id FROM atendimento_conversations
    WHERE status = 'snoozed'
      AND updated_at >= day_start AND updated_at < day_end
  ),
  open_end AS (
    SELECT id FROM atendimento_conversations
    WHERE status = 'open'
      AND created_at < day_end
  ),
  msg_day AS (
    SELECT
      message_type,
      content_type
    FROM atendimento_messages
    WHERE created_at >= day_start AND created_at < day_end
  ),
  -- ── Tempo de primeira resposta ────────────────────────────────────────────
  first_reply AS (
    SELECT
      c.id,
      EXTRACT(EPOCH FROM (
        (SELECT MIN(m.created_at)
           FROM atendimento_messages m
          WHERE m.conversation_id = c.id
            AND m.message_type IN ('outgoing','template')
            AND m.sender_type IN ('agent','system')
        ) - c.created_at
      ))::INTEGER AS reply_sec
    FROM atendimento_conversations c
    WHERE c.created_at >= day_start AND c.created_at < day_end
  ),
  first_reply_clean AS (
    SELECT reply_sec FROM first_reply
    WHERE reply_sec IS NOT NULL AND reply_sec >= 0
  ),
  -- ── Tempo de resolução ─────────────────────────────────────────────────────
  resolution AS (
    SELECT
      EXTRACT(EPOCH FROM (c.updated_at - c.created_at))::INTEGER AS res_sec
    FROM atendimento_conversations c
    WHERE c.status = 'resolved'
      AND c.updated_at >= day_start AND c.updated_at < day_end
      AND c.updated_at > c.created_at
  ),
  -- ── CRM Deals ──────────────────────────────────────────────────────────────
  deals_day AS (
    SELECT id, value_cents, won_at, lost_at
    FROM deals
    WHERE created_at >= day_start AND created_at < day_end
  ),
  deals_won_day AS (
    SELECT id, value_cents FROM deals
    WHERE won_at IS NOT NULL
      AND won_at >= day_start AND won_at < day_end
  ),
  deals_lost_day AS (
    SELECT id, value_cents FROM deals
    WHERE lost_at IS NOT NULL
      AND lost_at >= day_start AND lost_at < day_end
  ),
  -- ── Origem dos leads (deals + contacts.source fallback) ────────────────────
  lead_origin AS (
    SELECT
      COALESCE(NULLIF(TRIM(d.source), ''), 'unknown') AS src,
      COUNT(*)::INTEGER AS n
    FROM deals d
    WHERE d.created_at >= day_start AND d.created_at < day_end
    GROUP BY 1
  ),
  lead_origin_json AS (
    SELECT COALESCE(jsonb_object_agg(src, n), '{}'::jsonb) AS j FROM lead_origin
  ),
  -- ── Volume por inbox ───────────────────────────────────────────────────────
  vol_inbox AS (
    SELECT inbox_id::text AS ibx, COUNT(*)::INTEGER AS n
    FROM atendimento_conversations
    WHERE created_at >= day_start AND created_at < day_end
    GROUP BY inbox_id
  ),
  vol_inbox_json AS (
    SELECT COALESCE(jsonb_object_agg(ibx, n), '{}'::jsonb) AS j FROM vol_inbox
  ),
  -- ── Agentes ativos no dia ──────────────────────────────────────────────────
  agents_active AS (
    SELECT DISTINCT sender_id
    FROM atendimento_messages
    WHERE created_at >= day_start AND created_at < day_end
      AND sender_id IS NOT NULL
      AND sender_type = 'agent'
  )
  INSERT INTO metrics_snapshots (
    account_id, day,
    conversations_opened, conversations_closed, conversations_pending,
    conversations_snoozed, conversations_open_end,
    messages_in, messages_out, templates_sent,
    avg_first_response_sec, p50_first_response_sec, p90_first_response_sec,
    avg_resolution_sec, p50_resolution_sec, p90_resolution_sec,
    deals_created, deals_won, deals_lost,
    deals_value_won_cents, deals_value_lost_cents, conversion_rate_bp,
    leads_by_source, volume_by_inbox,
    active_agents, avg_conversations_per_agent,
    computed_at, source
  )
  SELECT
    NULL::UUID,
    target_day,
    (SELECT COUNT(*) FROM conv_day)::INTEGER,
    (SELECT COUNT(*) FROM closed_day)::INTEGER,
    (SELECT COUNT(*) FROM pending_day)::INTEGER,
    (SELECT COUNT(*) FROM snoozed_day)::INTEGER,
    (SELECT COUNT(*) FROM open_end)::INTEGER,
    (SELECT COUNT(*) FROM msg_day WHERE message_type = 'incoming')::INTEGER,
    (SELECT COUNT(*) FROM msg_day WHERE message_type IN ('outgoing','template'))::INTEGER,
    (SELECT COUNT(*) FROM msg_day WHERE message_type = 'template')::INTEGER,
    (SELECT AVG(reply_sec)::INTEGER FROM first_reply_clean),
    (SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY reply_sec)::INTEGER FROM first_reply_clean),
    (SELECT percentile_disc(0.9) WITHIN GROUP (ORDER BY reply_sec)::INTEGER FROM first_reply_clean),
    (SELECT AVG(res_sec)::INTEGER FROM resolution),
    (SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY res_sec)::INTEGER FROM resolution),
    (SELECT percentile_disc(0.9) WITHIN GROUP (ORDER BY res_sec)::INTEGER FROM resolution),
    (SELECT COUNT(*) FROM deals_day)::INTEGER,
    (SELECT COUNT(*) FROM deals_won_day)::INTEGER,
    (SELECT COUNT(*) FROM deals_lost_day)::INTEGER,
    COALESCE((SELECT SUM(value_cents) FROM deals_won_day), 0)::BIGINT,
    COALESCE((SELECT SUM(value_cents) FROM deals_lost_day), 0)::BIGINT,
    CASE
      WHEN (SELECT COUNT(*) FROM deals_day) > 0
      THEN ((SELECT COUNT(*) FROM deals_won_day)::NUMERIC
            / (SELECT COUNT(*) FROM deals_day) * 10000)::INTEGER
      ELSE NULL
    END,
    (SELECT j FROM lead_origin_json),
    (SELECT j FROM vol_inbox_json),
    (SELECT COUNT(*) FROM agents_active)::INTEGER,
    CASE
      WHEN (SELECT COUNT(*) FROM agents_active) > 0
      THEN ((SELECT COUNT(*) FROM conv_day)::NUMERIC
            / (SELECT COUNT(*) FROM agents_active))::NUMERIC(10,2)
      ELSE NULL
    END,
    NOW(),
    'cron'
  ON CONFLICT (account_id, day) DO UPDATE SET
    conversations_opened        = EXCLUDED.conversations_opened,
    conversations_closed        = EXCLUDED.conversations_closed,
    conversations_pending       = EXCLUDED.conversations_pending,
    conversations_snoozed       = EXCLUDED.conversations_snoozed,
    conversations_open_end      = EXCLUDED.conversations_open_end,
    messages_in                 = EXCLUDED.messages_in,
    messages_out                = EXCLUDED.messages_out,
    templates_sent              = EXCLUDED.templates_sent,
    avg_first_response_sec      = EXCLUDED.avg_first_response_sec,
    p50_first_response_sec      = EXCLUDED.p50_first_response_sec,
    p90_first_response_sec      = EXCLUDED.p90_first_response_sec,
    avg_resolution_sec          = EXCLUDED.avg_resolution_sec,
    p50_resolution_sec          = EXCLUDED.p50_resolution_sec,
    p90_resolution_sec          = EXCLUDED.p90_resolution_sec,
    deals_created               = EXCLUDED.deals_created,
    deals_won                   = EXCLUDED.deals_won,
    deals_lost                  = EXCLUDED.deals_lost,
    deals_value_won_cents       = EXCLUDED.deals_value_won_cents,
    deals_value_lost_cents      = EXCLUDED.deals_value_lost_cents,
    conversion_rate_bp          = EXCLUDED.conversion_rate_bp,
    leads_by_source             = EXCLUDED.leads_by_source,
    volume_by_inbox             = EXCLUDED.volume_by_inbox,
    active_agents               = EXCLUDED.active_agents,
    avg_conversations_per_agent = EXCLUDED.avg_conversations_per_agent,
    computed_at                 = EXCLUDED.computed_at,
    source                      = EXCLUDED.source
  RETURNING * INTO row;

  RETURN row;
END;
$$;

COMMENT ON FUNCTION compute_daily_metrics(DATE) IS
  'S7: agrega 20+ métricas do dia em metrics_snapshots (UPSERT). Idempotente.';

-- =============================================================================
-- 7. Helpers de relatório — funil + origem (usados pela UI sem recomputar)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_conversation_funnel(
  range_start DATE,
  range_end   DATE
)
RETURNS TABLE (
  stage          TEXT,
  count          BIGINT,
  pct_of_total   NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH tot AS (
    SELECT COUNT(*)::BIGINT AS total
    FROM atendimento_conversations
    WHERE created_at >= range_start AND created_at < (range_end + 1)
  )
  SELECT
    s.stage,
    s.count,
    CASE WHEN tot.total > 0 THEN ROUND(s.count::NUMERIC / tot.total * 100, 2) ELSE 0 END
  FROM (
    SELECT 'created'::TEXT AS stage, COUNT(*)::BIGINT AS count
      FROM atendimento_conversations
      WHERE created_at >= range_start AND created_at < (range_end + 1)
    UNION ALL
    SELECT 'replied'::TEXT, COUNT(*)::BIGINT
      FROM atendimento_conversations c
      WHERE c.created_at >= range_start AND c.created_at < (range_end + 1)
        AND EXISTS (
          SELECT 1 FROM atendimento_messages m
          WHERE m.conversation_id = c.id
            AND m.message_type IN ('outgoing','template')
        )
    UNION ALL
    SELECT 'resolved'::TEXT, COUNT(*)::BIGINT
      FROM atendimento_conversations
      WHERE status = 'resolved'
        AND updated_at >= range_start AND updated_at < (range_end + 1)
    UNION ALL
    SELECT 'with_deal'::TEXT, COUNT(DISTINCT c.id)::BIGINT
      FROM atendimento_conversations c
      WHERE c.created_at >= range_start AND c.created_at < (range_end + 1)
        AND c.deal_id IS NOT NULL
    UNION ALL
    SELECT 'deal_won'::TEXT, COUNT(*)::BIGINT
      FROM deals
      WHERE won_at IS NOT NULL
        AND won_at >= range_start AND won_at < (range_end + 1)
  ) s CROSS JOIN tot;
$$;

CREATE OR REPLACE FUNCTION get_lead_origin_breakdown(
  range_start DATE,
  range_end   DATE
)
RETURNS TABLE (
  source        TEXT,
  leads_count   BIGINT,
  deals_won     BIGINT,
  conversion_bp INTEGER
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(TRIM(d.source), ''), 'unknown') AS src,
      d.won_at IS NOT NULL AS is_won
    FROM deals d
    WHERE d.created_at >= range_start AND d.created_at < (range_end + 1)
  )
  SELECT
    src,
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE is_won)::BIGINT,
    CASE
      WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE is_won)::NUMERIC / COUNT(*) * 10000)::INTEGER
      ELSE 0
    END
  FROM base
  GROUP BY src
  ORDER BY COUNT(*) DESC;
$$;

-- =============================================================================
-- 8. Seed — widgets padrão do dashboard (6 widgets canônicos S7)
-- -----------------------------------------------------------------------------
-- Idempotente via ON CONFLICT DO NOTHING (pares (account_id NULL, title))
-- =============================================================================
INSERT INTO dashboard_widgets (account_id, owner_id, title, widget_type, metric_key, range_days, sort_order, layout)
VALUES
  (NULL, NULL, 'Conversas Abertas',        'kpi_card',   'conversations_open_end',  1,  0,  '{"x":0,"y":0,"w":3,"h":1}'::jsonb),
  (NULL, NULL, 'Tempo Médio de Resposta',  'kpi_card',   'avg_first_response_sec',  7,  1,  '{"x":3,"y":0,"w":3,"h":1}'::jsonb),
  (NULL, NULL, 'Conversão CRM',            'kpi_card',   'conversion_rate_bp',      30, 2,  '{"x":6,"y":0,"w":3,"h":1}'::jsonb),
  (NULL, NULL, 'Valor Ganho (R$)',         'kpi_card',   'deals_value_won_cents',   30, 3,  '{"x":9,"y":0,"w":3,"h":1}'::jsonb),
  (NULL, NULL, 'Volume de Conversas (30d)','line_chart', 'conversations_opened',    30, 4,  '{"x":0,"y":1,"w":8,"h":3}'::jsonb),
  (NULL, NULL, 'Origem dos Leads',         'pie_chart',  'leads_by_source',         30, 5,  '{"x":8,"y":1,"w":4,"h":3}'::jsonb)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 9. RLS — permissiva Fase 1 (refinar em S8/S9)
-- =============================================================================
ALTER TABLE metrics_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_definitions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_share_tokens    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read metrics_snapshots"    ON metrics_snapshots;
DROP POLICY IF EXISTS "auth read dashboard_widgets"    ON dashboard_widgets;
DROP POLICY IF EXISTS "auth write dashboard_widgets"   ON dashboard_widgets;
DROP POLICY IF EXISTS "auth read report_definitions"   ON report_definitions;
DROP POLICY IF EXISTS "auth write report_definitions"  ON report_definitions;
DROP POLICY IF EXISTS "auth read widget_share_tokens"  ON widget_share_tokens;
DROP POLICY IF EXISTS "auth write widget_share_tokens" ON widget_share_tokens;

CREATE POLICY "auth read metrics_snapshots"
  ON metrics_snapshots FOR SELECT
  USING (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth read dashboard_widgets"
  ON dashboard_widgets FOR SELECT
  USING (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth write dashboard_widgets"
  ON dashboard_widgets FOR ALL
  USING (auth.role() IN ('authenticated','service_role'))
  WITH CHECK (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth read report_definitions"
  ON report_definitions FOR SELECT
  USING (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth write report_definitions"
  ON report_definitions FOR ALL
  USING (auth.role() IN ('authenticated','service_role'))
  WITH CHECK (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth read widget_share_tokens"
  ON widget_share_tokens FOR SELECT
  USING (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "auth write widget_share_tokens"
  ON widget_share_tokens FOR ALL
  USING (auth.role() IN ('authenticated','service_role'))
  WITH CHECK (auth.role() IN ('authenticated','service_role'));

COMMIT;
