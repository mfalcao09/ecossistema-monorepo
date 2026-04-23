-- ============================================================
-- ATENDIMENTO S8a — Automações + Webhooks + API Pública + n8n
-- ============================================================
-- Criado: 2026-04-26
-- Sprint: S8a (Atendimento)
-- Dependências:
--   - 20260412_atendimento_modulo_init.sql (atendimento_automation_rules, atendimento_*)
--   - 20260413_atendimento_s3_queues.sql (atendimento_queues com n8n_integration_id)
--   - 20260421000000_atendimento_s4_kanban.sql (deals, pipeline_stages)
--   - 20260421_atendimento_s6_cargos.sql (agent_roles, teams)
--
-- Objetivo:
--   Motor IF/THEN completo + webhooks bidirecionais + API REST pública +
--   integração n8n (plugar ID 2967 da FIC) + catálogo de Apps.
--
-- Tabelas novas:
--   - automation_executions        (log idempotente de execuções)
--   - webhook_inbound_endpoints    (entradas com HMAC + slug)
--   - webhook_outbound_urls        (saídas com eventos subscritos + retry)
--   - webhook_attempts             (tentativas com backoff exponencial)
--   - api_keys                     (hash SHA-256 + scopes + rotation)
--   - app_installations            (catálogo de integrações habilitáveis)
--   - n8n_integrations             (config n8n por conta — plugar ID 2967)
--
-- Expansão de atendimento_automation_rules:
--   - conditions_logic VARCHAR (AND | OR)
--   - scope VARCHAR (global | pipeline | stage | queue)
--   - scope_id UUID
--   - last_executed_at TIMESTAMPTZ
--   - execution_count INT
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Expansão de atendimento_automation_rules
-- ============================================================
ALTER TABLE public.atendimento_automation_rules
  ADD COLUMN IF NOT EXISTS conditions_logic VARCHAR(10) NOT NULL DEFAULT 'AND'
    CHECK (conditions_logic IN ('AND', 'OR')),
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'global'
    CHECK (scope IN ('global', 'pipeline', 'stage', 'queue')),
  ADD COLUMN IF NOT EXISTS scope_id UUID,
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_count INT NOT NULL DEFAULT 0;

-- Novos eventos suportados (S8a expande a lista original do S1)
DO $$
BEGIN
  -- Atualiza CHECK permitido se constraint existir (nome pode variar)
  -- Mantém evento legado 'message_created' funcionando (alias de 'message_received')
  PERFORM 1
    FROM information_schema.table_constraints
   WHERE table_name = 'atendimento_automation_rules'
     AND constraint_type = 'CHECK'
     AND constraint_name LIKE '%event_name%';

  IF FOUND THEN
    -- Encontra e dropa qualquer check constraint em event_name
    EXECUTE (
      SELECT 'ALTER TABLE public.atendimento_automation_rules DROP CONSTRAINT ' || quote_ident(constraint_name)
        FROM information_schema.table_constraints
       WHERE table_name = 'atendimento_automation_rules'
         AND constraint_type = 'CHECK'
         AND constraint_name LIKE '%event_name%'
       LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.atendimento_automation_rules
  ADD CONSTRAINT atendimento_automation_rules_event_name_check
    CHECK (event_name IN (
      'message_received',
      'message_created',            -- alias legado
      'conversation_created',
      'conversation_status_changed',
      'conversation_assigned',
      'conversation_unassigned',
      'tag_added',
      'deal_stage_changed',
      'scheduled_message_sent',
      'time_elapsed'
    ));

CREATE INDEX IF NOT EXISTS idx_automation_rules_active_event
  ON public.atendimento_automation_rules (active, event_name);

COMMENT ON COLUMN public.atendimento_automation_rules.conditions_logic IS 'AND = todas as condições | OR = qualquer condição';
COMMENT ON COLUMN public.atendimento_automation_rules.scope            IS 'Escopo: global (todas) | pipeline | stage | queue — combina com scope_id';
COMMENT ON COLUMN public.atendimento_automation_rules.execution_count  IS 'Contador reativo, incrementado em automation_executions INSERT';


-- ============================================================
-- 2. Log de execuções de regras
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_executions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id             UUID NOT NULL REFERENCES public.atendimento_automation_rules(id) ON DELETE CASCADE,
  triggered_by_event  VARCHAR(60) NOT NULL,
  payload             JSONB NOT NULL DEFAULT '{}',
  actions_run         JSONB NOT NULL DEFAULT '[]',
  status              VARCHAR(20) NOT NULL DEFAULT 'success'
                        CHECK (status IN ('success', 'partial', 'failed', 'skipped')),
  error               TEXT,
  dry_run             BOOLEAN NOT NULL DEFAULT false,
  account_id          UUID,
  executed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule
  ON public.automation_executions (rule_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_executions_status
  ON public.automation_executions (status, executed_at DESC);

COMMENT ON TABLE public.automation_executions IS 'Log de cada execução de regra — até 50 linhas recentes ficam na UI';


-- Trigger para atualizar execution_count e last_executed_at na regra
CREATE OR REPLACE FUNCTION public.automation_executions_bump_rule()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.dry_run THEN
    RETURN NEW;
  END IF;
  UPDATE public.atendimento_automation_rules
     SET last_executed_at = NEW.executed_at,
         execution_count  = execution_count + 1
   WHERE id = NEW.rule_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_automation_executions_bump ON public.automation_executions;
CREATE TRIGGER trg_automation_executions_bump
  AFTER INSERT ON public.automation_executions
  FOR EACH ROW EXECUTE FUNCTION public.automation_executions_bump_rule();


-- ============================================================
-- 3. Webhook inbound endpoints (entrada)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_inbound_endpoints (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID,
  name                VARCHAR(120) NOT NULL,
  slug                VARCHAR(120) NOT NULL UNIQUE,     -- /api/atendimento/webhooks/inbound/<slug>
  description         TEXT,
  secret              VARCHAR(200) NOT NULL,            -- HMAC secret (obrigatório)
  tags_auto           UUID[] NOT NULL DEFAULT '{}',     -- atendimento_labels.id adicionados no hit
  active              BOOLEAN NOT NULL DEFAULT true,
  last_call_at        TIMESTAMPTZ,
  call_count          INT NOT NULL DEFAULT 0,
  created_by          UUID,                             -- auth.users.id
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_inbound_slug
  ON public.webhook_inbound_endpoints (slug) WHERE active;

COMMENT ON TABLE  public.webhook_inbound_endpoints IS 'Endpoints públicos de entrada — HMAC-SHA256 obrigatório no header x-signature';
COMMENT ON COLUMN public.webhook_inbound_endpoints.tags_auto IS 'Array de atendimento_labels.id adicionados ao contato quando o webhook recebe hit';


-- ============================================================
-- 4. Webhook outbound URLs (saída)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_outbound_urls (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID,
  name                VARCHAR(120) NOT NULL,
  url                 TEXT NOT NULL,
  description         TEXT,
  secret              VARCHAR(200),                         -- assina saída com HMAC
  events              VARCHAR(60)[] NOT NULL DEFAULT '{}',  -- eventos subscritos
  retry_policy        JSONB NOT NULL DEFAULT '{"max":5,"backoff_s":[5,15,30,60,120]}',
  headers_extra       JSONB NOT NULL DEFAULT '{}',          -- headers customizados (auth etc.)
  active              BOOLEAN NOT NULL DEFAULT true,
  last_delivery_at    TIMESTAMPTZ,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_outbound_active
  ON public.webhook_outbound_urls (active);

-- GIN index para busca rápida por evento subscrito
CREATE INDEX IF NOT EXISTS idx_webhook_outbound_events
  ON public.webhook_outbound_urls USING GIN (events);

COMMENT ON COLUMN public.webhook_outbound_urls.events IS 'Eventos subscritos: message.received, message.sent, conversation.assigned, conversation.resolved, deal.created, deal.stage_changed, deal.won, deal.lost, contact.created';


-- ============================================================
-- 5. Tentativas de webhook outbound (retry exponencial)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_id         UUID NOT NULL REFERENCES public.webhook_outbound_urls(id) ON DELETE CASCADE,
  event_type          VARCHAR(60) NOT NULL,
  payload             JSONB NOT NULL,
  status_code         INT,                          -- NULL = ainda não tentado
  response_body       TEXT,
  response_headers    JSONB,
  attempt             INT NOT NULL DEFAULT 0,       -- 0-indexed; 0 = 1ª tentativa
  next_retry_at       TIMESTAMPTZ,                  -- NULL = não retenta
  delivered_at        TIMESTAMPTZ,                  -- preenchido quando 2xx
  error               TEXT,
  account_id          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_attempts_retry
  ON public.webhook_attempts (next_retry_at)
  WHERE delivered_at IS NULL AND next_retry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_attempts_outbound_created
  ON public.webhook_attempts (outbound_id, created_at DESC);

COMMENT ON TABLE public.webhook_attempts IS 'Fila de tentativas de entrega — worker cron 1min escaneia next_retry_at <= NOW()';


-- ============================================================
-- 6. API keys (hash SHA-256 + scopes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID,
  name                VARCHAR(120) NOT NULL,
  key_prefix          VARCHAR(12) NOT NULL,          -- primeiros chars para display (ex: "sk_live_ab")
  key_hash            VARCHAR(120) NOT NULL UNIQUE,  -- SHA-256 hex da chave completa
  scopes              VARCHAR(60)[] NOT NULL DEFAULT '{}',  -- messages:send, messages:read, contacts:*, deals:*, dashboard:read
  last_used_at        TIMESTAMPTZ,
  rotated_at          TIMESTAMPTZ,
  active              BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash
  ON public.api_keys (key_hash) WHERE active;

CREATE INDEX IF NOT EXISTS idx_api_keys_account
  ON public.api_keys (account_id, active);

COMMENT ON TABLE  public.api_keys             IS 'API keys para /api/public/v1/** — chave plaintext NUNCA armazenada (só hash SHA-256)';
COMMENT ON COLUMN public.api_keys.key_prefix  IS 'Primeiros 12 chars para exibir na UI (ex: "sk_live_ab12")';
COMMENT ON COLUMN public.api_keys.scopes      IS 'Escopos: messages:send, messages:read, contacts:read, contacts:write, deals:read, deals:write, dashboard:read, *';


-- ============================================================
-- 7. Catálogo de Apps / Integrações
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_installations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID,
  app_key             VARCHAR(60) NOT NULL,        -- n8n, google_calendar, ia_transcription, meta_ads, ...
  config              JSONB NOT NULL DEFAULT '{}', -- config específica do app
  enabled             BOOLEAN NOT NULL DEFAULT false,
  installed_at        TIMESTAMPTZ,
  installed_by        UUID,
  last_used_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_installations_account_app
  ON public.app_installations (COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid), app_key);

COMMENT ON TABLE public.app_installations IS 'Catálogo de integrações habilitáveis — 1 linha por app por account';


-- ============================================================
-- 8. n8n integrations (config real da FIC plugando ID 2967)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.n8n_integrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID,
  name                VARCHAR(120) NOT NULL,
  n8n_flow_id         VARCHAR(120) NOT NULL,           -- ex: "2967" (FIC – AF EDUCACIONAL)
  webhook_url         TEXT NOT NULL,                   -- URL de produção do n8n
  webhook_token       VARCHAR(200),                    -- token bearer (opcional, alguns flows usam)
  description         TEXT,
  active              BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at   TIMESTAMPTZ,
  trigger_count       INT NOT NULL DEFAULT 0,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_n8n_integrations_flow
  ON public.n8n_integrations (COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid), n8n_flow_id);

CREATE INDEX IF NOT EXISTS idx_n8n_integrations_active
  ON public.n8n_integrations (active);

COMMENT ON TABLE public.n8n_integrations IS 'Integrações n8n — 1 linha por flow. A FIC pluga aqui o ID 2967 "N8N – AF EDUCACIONAL"';


-- ============================================================
-- 9. updated_at triggers
-- ============================================================
-- Reaproveita atendimento_set_updated_at() do S1

DROP TRIGGER IF EXISTS trg_webhook_inbound_updated_at ON public.webhook_inbound_endpoints;
CREATE TRIGGER trg_webhook_inbound_updated_at
  BEFORE UPDATE ON public.webhook_inbound_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_set_updated_at();

DROP TRIGGER IF EXISTS trg_webhook_outbound_updated_at ON public.webhook_outbound_urls;
CREATE TRIGGER trg_webhook_outbound_updated_at
  BEFORE UPDATE ON public.webhook_outbound_urls
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_set_updated_at();

DROP TRIGGER IF EXISTS trg_app_installations_updated_at ON public.app_installations;
CREATE TRIGGER trg_app_installations_updated_at
  BEFORE UPDATE ON public.app_installations
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_set_updated_at();

DROP TRIGGER IF EXISTS trg_n8n_integrations_updated_at ON public.n8n_integrations;
CREATE TRIGGER trg_n8n_integrations_updated_at
  BEFORE UPDATE ON public.n8n_integrations
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_set_updated_at();


-- ============================================================
-- 10. RLS — authenticated only (Fase 1 single-tenant)
-- ============================================================
ALTER TABLE public.automation_executions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_inbound_endpoints    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_outbound_urls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_attempts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_installations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_integrations             ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'automation_executions',
    'webhook_inbound_endpoints',
    'webhook_outbound_urls',
    'webhook_attempts',
    'api_keys',
    'app_installations',
    'n8n_integrations'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS auth_only_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS auth_only_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS auth_only_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS auth_only_delete ON public.%I', t);

    EXECUTE format('CREATE POLICY auth_only_select ON public.%I FOR SELECT USING (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY auth_only_insert ON public.%I FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY auth_only_update ON public.%I FOR UPDATE USING (auth.uid() IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY auth_only_delete ON public.%I FOR DELETE USING (auth.uid() IS NOT NULL)', t);
  END LOOP;
END $$;


-- ============================================================
-- 11. Seed do catálogo de Apps
-- ============================================================
INSERT INTO public.app_installations (app_key, config, enabled)
VALUES
  ('n8n',             '{"description": "Disparar fluxos n8n a partir de automações"}',              false),
  ('google_calendar', '{"description": "Sincronizar agendamentos com Google Calendar"}',            false),
  ('ia_transcription','{"description": "Transcrever áudios recebidos via IA (Gemini/Whisper)"}',    false),
  ('meta_ads',        '{"description": "Tracking de conversões Meta ADS (futuro)"}',                false)
ON CONFLICT DO NOTHING;


COMMIT;

-- ============================================================
-- FIM DA MIGRATION S8a
-- Próximo passo:
--   - S8b (Chat Interno + Links Redirecionamento)
--   - S9 (DS Voice — biblioteca)
-- ============================================================
