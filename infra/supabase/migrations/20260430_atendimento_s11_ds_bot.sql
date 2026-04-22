-- =============================================================================
-- Atendimento · Sprint S11 — DS Bot (Visual Flow Builder)
-- -----------------------------------------------------------------------------
-- Cria:
--   ds_bots            (metadata + flow_json publicado)
--   ds_bot_versions    (histórico versionado; rollback)
--   ds_bot_executions  (máquina de estados por conversa)
-- Altera (defensivo — só se atendimento_queues existir):
--   atendimento_queues  (+ ds_bot_id, + run_bot_first BOOL)
-- RLS permissiva (Fase 1 single-tenant, coerente com S4/S6/S7/S8a).
-- -----------------------------------------------------------------------------
-- Referência:
--   apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md
--   docs/sessions/BRIEFING-ATND-S11-DS-BOT.md
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ds_bots — bot ativo / publicado
-- =============================================================================
CREATE TABLE IF NOT EXISTS ds_bots (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID,
  name                VARCHAR(140) NOT NULL,
  description         TEXT,
  trigger_type        VARCHAR(32)  NOT NULL DEFAULT 'manual'
                      CHECK (trigger_type IN ('keyword','tag_added','new_conversation','manual')),
  trigger_value       TEXT,                          -- keyword ou tag name
  channels            VARCHAR(32)[] NOT NULL DEFAULT '{}',  -- ['whatsapp','instagram',...]
  flow_json           JSONB        NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'::jsonb,
  start_node_id       VARCHAR(64),                    -- id do node inicial no grafo
  enabled             BOOLEAN      NOT NULL DEFAULT false,
  version             INTEGER      NOT NULL DEFAULT 1,
  created_by          UUID,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  ds_bots                IS 'DS Bot — visual flow builder. flow_json = grafo serializável (@xyflow).';
COMMENT ON COLUMN ds_bots.trigger_type   IS 'Como o bot começa: keyword | tag_added | new_conversation | manual.';
COMMENT ON COLUMN ds_bots.trigger_value  IS 'Valor do gatilho (ex: "matricula" para keyword).';
COMMENT ON COLUMN ds_bots.channels       IS 'Canais onde o bot pode rodar.';
COMMENT ON COLUMN ds_bots.start_node_id  IS 'Node inicial do grafo (geralmente um trigger node).';

CREATE INDEX IF NOT EXISTS idx_ds_bots_enabled_trigger
  ON ds_bots (enabled, trigger_type) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_ds_bots_account
  ON ds_bots (account_id);

-- =============================================================================
-- 2. ds_bot_versions — histórico imutável para rollback / audit
-- =============================================================================
CREATE TABLE IF NOT EXISTS ds_bot_versions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id       UUID        NOT NULL REFERENCES ds_bots ON DELETE CASCADE,
  version      INTEGER     NOT NULL,
  flow_json    JSONB       NOT NULL,
  change_note  TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bot_id, version)
);

COMMENT ON TABLE ds_bot_versions IS 'Snapshots imutáveis do flow_json; cada "Salvar versão" cria uma row.';

CREATE INDEX IF NOT EXISTS idx_ds_bot_versions_bot
  ON ds_bot_versions (bot_id, version DESC);

-- =============================================================================
-- 3. ds_bot_executions — máquina de estados runtime
-- =============================================================================
CREATE TABLE IF NOT EXISTS ds_bot_executions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id            UUID        NOT NULL REFERENCES ds_bots ON DELETE CASCADE,
  version           INTEGER     NOT NULL DEFAULT 1,
  conversation_id   UUID,                              -- FK lógica p/ atendimento_conversations (sem constraint p/ não acoplar)
  contact_id        UUID,                              -- FK lógica p/ atendimento_contacts
  channel           VARCHAR(32),                       -- 'whatsapp' | 'playground' | ...
  current_node_id   VARCHAR(64),                       -- null = aguardando início; 'END' = terminou
  awaiting_input    BOOLEAN     NOT NULL DEFAULT false,
  variables         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  history           JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- array de {node_id, at, event, payload}
  status            VARCHAR(16) NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','awaiting','completed','aborted','error')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  error             TEXT
);

COMMENT ON TABLE ds_bot_executions IS 'Estado de cada execução do bot por conversa. Idempotente por (bot_id, conversation_id, status).';

CREATE INDEX IF NOT EXISTS idx_ds_bot_executions_status_updated
  ON ds_bot_executions (status, updated_at);

CREATE INDEX IF NOT EXISTS idx_ds_bot_executions_active_conv
  ON ds_bot_executions (conversation_id, status)
  WHERE status IN ('running','awaiting');

CREATE INDEX IF NOT EXISTS idx_ds_bot_executions_bot
  ON ds_bot_executions (bot_id, started_at DESC);

-- =============================================================================
-- 4. Alterações em atendimento_queues (defensivo — só se existir)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'atendimento_queues'
  ) THEN
    EXECUTE 'ALTER TABLE public.atendimento_queues
               ADD COLUMN IF NOT EXISTS ds_bot_id    UUID REFERENCES public.ds_bots ON DELETE SET NULL,
               ADD COLUMN IF NOT EXISTS run_bot_first BOOLEAN NOT NULL DEFAULT false';
  END IF;
END $$;

-- =============================================================================
-- 5. Trigger updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION ds_bot_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ds_bots_updated_at ON ds_bots;
CREATE TRIGGER trg_ds_bots_updated_at
BEFORE UPDATE ON ds_bots
FOR EACH ROW EXECUTE FUNCTION ds_bot_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ds_bot_executions_updated_at ON ds_bot_executions;
CREATE TRIGGER trg_ds_bot_executions_updated_at
BEFORE UPDATE ON ds_bot_executions
FOR EACH ROW EXECUTE FUNCTION ds_bot_touch_updated_at();

-- =============================================================================
-- 6. RLS permissiva (Fase 1 single-tenant; refinar em S6-Cargos)
-- =============================================================================
ALTER TABLE ds_bots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ds_bot_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ds_bot_executions  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ds_bots' AND policyname = 'auth_all_ds_bots') THEN
    CREATE POLICY auth_all_ds_bots ON ds_bots
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ds_bot_versions' AND policyname = 'auth_all_ds_bot_versions') THEN
    CREATE POLICY auth_all_ds_bot_versions ON ds_bot_versions
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ds_bot_executions' AND policyname = 'auth_all_ds_bot_executions') THEN
    CREATE POLICY auth_all_ds_bot_executions ON ds_bot_executions
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- service_role bypass para engine (runtime tem que ler/escrever independentemente de JWT)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ds_bot_executions' AND policyname = 'svc_all_ds_bot_executions') THEN
    CREATE POLICY svc_all_ds_bot_executions ON ds_bot_executions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;
