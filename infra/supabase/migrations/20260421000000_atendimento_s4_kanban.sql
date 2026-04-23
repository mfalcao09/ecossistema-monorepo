-- =============================================================================
-- Atendimento · Sprint S4 — Kanban CRM + Lead Detail + Protocolos
-- -----------------------------------------------------------------------------
-- Cria:
--   pipelines, pipeline_stages
--   deals, deal_activities, deal_notes, deal_history_events
--   protocols, campaigns, contact_custom_fields
-- Altera:
--   atendimento_conversations (+ deal_id, + protocol_count)
--   atendimento_contacts      (+ aluno_id, + source, + color_hex)
-- Seed:
--   2 pipelines FIC (ATENDIMENTOS-GERAL, Alunos) + 11 stages
-- Trigger:
--   auto-INSERT em deal_history_events quando deals.stage_id muda
--   auto-UPDATE em deals.updated_at
-- RLS:
--   permissiva (Fase 1 single-tenant; refinado em S6-Cargos)
-- -----------------------------------------------------------------------------
-- Referência: apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md
--             · Parte 4 · Sprint S4
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TABELAS NOVAS
-- =============================================================================

CREATE TABLE IF NOT EXISTS pipelines (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID,
  key                   VARCHAR(32) NOT NULL,
  name                  VARCHAR(100) NOT NULL,
  description           TEXT,
  color_hex             VARCHAR(7),
  is_pinned             BOOLEAN     NOT NULL DEFAULT false,
  admin_role_ids        UUID[]      NOT NULL DEFAULT '{}',
  access_role_ids       UUID[]      NOT NULL DEFAULT '{}',
  cards_visibility      VARCHAR(16) NOT NULL DEFAULT 'owner'
                        CHECK (cards_visibility IN ('all','owner','team')),
  visible_to_restricted BOOLEAN     NOT NULL DEFAULT true,
  sort_order            INTEGER     NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, key)
);

COMMENT ON TABLE pipelines IS 'Pipelines CRM (ATENDIMENTOS-GERAL, Alunos, etc). Multi-tenant via account_id.';

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id       UUID        NOT NULL REFERENCES pipelines ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  sort_order        INTEGER     NOT NULL,
  color_hex         VARCHAR(7),
  sla_warning_days  INTEGER,  -- card fica amarelo após X dias sem mover
  sla_danger_days   INTEGER,  -- card fica vermelho após Y dias sem mover
  is_won            BOOLEAN     NOT NULL DEFAULT false,
  is_lost           BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pipeline_id, sort_order),
  CHECK (NOT (is_won AND is_lost))
);

CREATE TABLE IF NOT EXISTS deals (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID,
  pipeline_id        UUID        NOT NULL REFERENCES pipelines,
  stage_id           UUID        NOT NULL REFERENCES pipeline_stages,
  contact_id         UUID        REFERENCES atendimento_contacts,
  assignee_id        UUID,
  queue_id           UUID        REFERENCES atendimento_queues,
  campaign_id        UUID,  -- FK adicionado após campaigns (mesma migration, ver §4)
  title              VARCHAR(200) NOT NULL,
  value_cents        BIGINT,
  currency           VARCHAR(3)  NOT NULL DEFAULT 'BRL',
  source             VARCHAR(64),
  custom_fields      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  entered_stage_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  won_at             TIMESTAMPTZ,
  lost_at            TIMESTAMPTZ,
  lost_reason        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deal_activities (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           UUID        NOT NULL REFERENCES deals ON DELETE CASCADE,
  type              VARCHAR(16) NOT NULL
                    CHECK (type IN ('call','meeting','task','email','whatsapp','note')),
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  scheduled_at      TIMESTAMPTZ,
  duration_minutes  INTEGER,
  assignee_id       UUID,
  completed_at      TIMESTAMPTZ,
  attachment_url    TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deal_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID        NOT NULL REFERENCES deals ON DELETE CASCADE,
  author_id       UUID,
  body            TEXT        NOT NULL,
  attachment_url  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deal_history_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID        NOT NULL REFERENCES deals ON DELETE CASCADE,
  actor_id    UUID,
  event_type  VARCHAR(32) NOT NULL,
    -- stage_transfer | note_added | activity_added | tag_added | tag_removed
    -- | ticket_transferred | deal_created | deal_won | deal_lost | assignee_changed
  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protocols (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL REFERENCES atendimento_conversations,
  protocol_number  BIGSERIAL   NOT NULL,
  subject          VARCHAR(200) NOT NULL,
  status           VARCHAR(16) NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','resolved','canceled')),
  assignee_id      UUID,
  resolved_at      TIMESTAMPTZ,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  audience_filter   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  channel           VARCHAR(32),
  template_id       UUID,
  status            VARCHAR(16) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','scheduled','running','done','canceled')),
  scheduled_at      TIMESTAMPTZ,
  stats             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_custom_fields (
  contact_id  UUID        NOT NULL REFERENCES atendimento_contacts ON DELETE CASCADE,
  field_key   VARCHAR(64) NOT NULL,
  field_value TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contact_id, field_key)
);

-- =============================================================================
-- 2. ALTERAÇÕES EM TABELAS EXISTENTES (S3 produção)
-- =============================================================================

ALTER TABLE atendimento_conversations
  ADD COLUMN IF NOT EXISTS deal_id         UUID REFERENCES deals,
  ADD COLUMN IF NOT EXISTS protocol_count  INTEGER NOT NULL DEFAULT 0;

ALTER TABLE atendimento_contacts
  ADD COLUMN IF NOT EXISTS aluno_id   UUID,      -- FK futura p/ tabela de alunos
  ADD COLUMN IF NOT EXISTS source     VARCHAR(64),
  ADD COLUMN IF NOT EXISTS color_hex  VARCHAR(7);

-- =============================================================================
-- 3. ÍNDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_pipelines_account         ON pipelines (account_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline  ON pipeline_stages (pipeline_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage      ON deals (pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact             ON deals (contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_assignee            ON deals (assignee_id);
CREATE INDEX IF NOT EXISTS idx_deals_queue               ON deals (queue_id);
CREATE INDEX IF NOT EXISTS idx_deals_entered_stage_at    ON deals (entered_stage_at);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal      ON deal_activities (deal_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_deal_activities_assignee
  ON deal_activities (assignee_id, scheduled_at)
  WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deal_notes_deal           ON deal_notes (deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_history_deal         ON deal_history_events (deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_protocols_conversation    ON protocols (conversation_id);
CREATE INDEX IF NOT EXISTS idx_protocols_status          ON protocols (status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_atnd_conversations_deal   ON atendimento_conversations (deal_id);

-- =============================================================================
-- 4. TRIGGERS
-- =============================================================================

-- 4.1 updated_at genérico
CREATE OR REPLACE FUNCTION atnd_s4_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pipelines_updated_at         BEFORE UPDATE ON pipelines
  FOR EACH ROW EXECUTE FUNCTION atnd_s4_touch_updated_at();
CREATE TRIGGER trg_pipeline_stages_updated_at   BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION atnd_s4_touch_updated_at();
CREATE TRIGGER trg_deals_updated_at             BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION atnd_s4_touch_updated_at();
CREATE TRIGGER trg_deal_activities_updated_at   BEFORE UPDATE ON deal_activities
  FOR EACH ROW EXECUTE FUNCTION atnd_s4_touch_updated_at();
CREATE TRIGGER trg_protocols_updated_at         BEFORE UPDATE ON protocols
  FOR EACH ROW EXECUTE FUNCTION atnd_s4_touch_updated_at();
CREATE TRIGGER trg_campaigns_updated_at         BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION atnd_s4_touch_updated_at();

-- 4.2 Auto-histórico de deals (stage_transfer + deal_created + assignee_changed)
CREATE OR REPLACE FUNCTION atnd_s4_log_deal_history()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO deal_history_events (deal_id, actor_id, event_type, payload)
      VALUES (
        NEW.id,
        NEW.assignee_id,
        'deal_created',
        jsonb_build_object(
          'pipeline_id', NEW.pipeline_id,
          'stage_id',    NEW.stage_id,
          'title',       NEW.title
        )
      );
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
      -- Mantém entered_stage_at sincronizado (só se a aplicação não tocou)
      IF NEW.entered_stage_at = OLD.entered_stage_at THEN
        NEW.entered_stage_at = NOW();
      END IF;

      INSERT INTO deal_history_events (deal_id, actor_id, event_type, payload)
        VALUES (
          NEW.id,
          NEW.assignee_id,
          'stage_transfer',
          jsonb_build_object('from', OLD.stage_id, 'to', NEW.stage_id)
        );
    END IF;

    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO deal_history_events (deal_id, actor_id, event_type, payload)
        VALUES (
          NEW.id,
          NEW.assignee_id,
          'assignee_changed',
          jsonb_build_object('from', OLD.assignee_id, 'to', NEW.assignee_id)
        );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deals_history_insert
  AFTER INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION atnd_s4_log_deal_history();

CREATE TRIGGER trg_deals_history_update
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION atnd_s4_log_deal_history();

-- 4.3 Incrementar protocol_count ao inserir protocol
CREATE OR REPLACE FUNCTION atnd_s4_bump_protocol_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE atendimento_conversations
     SET protocol_count = COALESCE(protocol_count, 0) + 1
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protocols_bump_count
  AFTER INSERT ON protocols
  FOR EACH ROW EXECUTE FUNCTION atnd_s4_bump_protocol_count();

-- =============================================================================
-- 5. RLS (Fase 1: permissiva — refinado em S6-Cargos)
-- =============================================================================

ALTER TABLE pipelines             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_history_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols             ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_custom_fields ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'pipelines','pipeline_stages','deals','deal_activities','deal_notes',
    'deal_history_events','protocols','campaigns','contact_custom_fields'
  ])
  LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);
    $f$, 'p_' || tbl || '_auth_all', tbl);

    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true);
    $f$, 'p_' || tbl || '_service_all', tbl);
  END LOOP;
END$$;

-- =============================================================================
-- 6. SEEDS FIC
-- =============================================================================

-- 6.1 Pipelines
INSERT INTO pipelines (key, name, description, color_hex, is_pinned, sort_order)
VALUES
  ('ATND', 'ATENDIMENTOS-GERAL',
    'Pipeline principal de atendimentos da FIC: triagem → secretaria → financeiro → matrícula.',
    '#345EF3', true,  0),
  ('ALUN', 'Alunos',
    'Pipeline de matrícula e jornada do aluno: interesse → formado.',
    '#12B76A', false, 1)
ON CONFLICT (account_id, key) DO NOTHING;

-- 6.2 Stages ATENDIMENTOS-GERAL (4 etapas reais FIC)
INSERT INTO pipeline_stages (pipeline_id, name, sort_order, color_hex, sla_warning_days, sla_danger_days)
SELECT p.id, s.name, s.sort_order, s.color_hex, s.sla_warning, s.sla_danger
FROM pipelines p
JOIN (VALUES
  ('AGUARDANDO',        0, '#98A2B3', 2, 5),
  ('SECRETARIA',        1, '#345EF3', 3, 7),
  ('FINANCEIRO',        2, '#F79009', 5, 10),
  ('NOVAS MATRÍCULAS',  3, '#12B76A', 7, 14)
) AS s(name, sort_order, color_hex, sla_warning, sla_danger) ON true
WHERE p.key = 'ATND'
  AND NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps
    WHERE ps.pipeline_id = p.id AND ps.name = s.name
  );

-- 6.3 Stages Alunos (7 etapas)
INSERT INTO pipeline_stages (pipeline_id, name, sort_order, color_hex, sla_warning_days, sla_danger_days, is_won)
SELECT p.id, s.name, s.sort_order, s.color_hex, s.sla_warning, s.sla_danger, s.is_won
FROM pipelines p
JOIN (VALUES
  ('Interesse',        0, '#98A2B3',  3,    7, false),
  ('Visita',           1, '#345EF3',  7,   14, false),
  ('Documentação',     2, '#F79009', 10,   21, false),
  ('Financeiro',       3, '#F79009',  5,   10, false),
  ('Matrícula ativa',  4, '#12B76A', NULL, NULL, true),
  ('Cursando',         5, '#12B76A', NULL, NULL, false),
  ('Formado',          6, '#0BA5EC', NULL, NULL, true)
) AS s(name, sort_order, color_hex, sla_warning, sla_danger, is_won) ON true
WHERE p.key = 'ALUN'
  AND NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps
    WHERE ps.pipeline_id = p.id AND ps.name = s.name
  );

COMMIT;
