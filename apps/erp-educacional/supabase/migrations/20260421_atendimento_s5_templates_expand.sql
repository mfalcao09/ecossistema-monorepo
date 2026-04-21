-- ============================================================
-- MÓDULO ATENDIMENTO — Sprint S5 (2026-04-21)
-- Templates WABA expand + Agendamentos + Calendar Events
-- Sessão S089 | FIC single-tenant, account_id nullable (Fase 2 vira NOT NULL)
--
-- Idempotente: IF NOT EXISTS em todos os CREATE / ADD COLUMN.
-- Dependências: 20260412_atendimento_modulo_init.sql
-- ============================================================

-- ============================================================
-- 1. Expandir atendimento_conversations com window_expires_at
-- Fundamental para banner "janela WABA fechada" (regra 24h Meta).
-- ============================================================
ALTER TABLE public.atendimento_conversations
  ADD COLUMN IF NOT EXISTS window_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.atendimento_conversations.window_expires_at IS
  'Quando a janela WABA de 24h expira (atualizada a cada mensagem incoming). '
  'Se < now(), só é possível enviar templates HSM aprovados.';

-- Índice parcial para encontrar rapidamente conversas com janela aberta
CREATE INDEX IF NOT EXISTS idx_atendimento_conv_window
  ON public.atendimento_conversations(window_expires_at)
  WHERE window_expires_at IS NOT NULL;

-- ============================================================
-- 2. Expandir atendimento_whatsapp_templates
-- Campos derivados do sync com Meta Graph API.
-- Nota: coluna `language` já existe (default 'pt_BR') — NÃO criamos
-- `language_code` separada; usamos a existente. meta_template_id também existe.
-- ============================================================
ALTER TABLE public.atendimento_whatsapp_templates
  ADD COLUMN IF NOT EXISTS has_buttons        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS button_type        TEXT
    CHECK (button_type IN ('QUICK_REPLY', 'CTA', NULL)),
  ADD COLUMN IF NOT EXISTS rejected_reason    TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS header_type        TEXT
    CHECK (header_type IN ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', NULL));

-- Expandir check de status para incluir 'DRAFT' (templates locais antes de enviar p/ Meta)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'atendimento_whatsapp_templates_status_check'
  ) THEN
    ALTER TABLE public.atendimento_whatsapp_templates
      DROP CONSTRAINT atendimento_whatsapp_templates_status_check;
  END IF;
  ALTER TABLE public.atendimento_whatsapp_templates
    ADD CONSTRAINT atendimento_whatsapp_templates_status_check
    CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED', 'PAUSED'));
END $$;

-- Unicidade lógica: um meta_template_id não pode duplicar dentro do mesmo inbox
CREATE UNIQUE INDEX IF NOT EXISTS idx_atendimento_templates_meta_id
  ON public.atendimento_whatsapp_templates(inbox_id, meta_template_id)
  WHERE meta_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_atendimento_templates_status
  ON public.atendimento_whatsapp_templates(status, inbox_id);

-- ============================================================
-- 3. Mensagens agendadas (scheduled_messages)
-- Worker lê WHERE status='pending' AND scheduled_at <= now().
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_scheduled_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relacionamentos
  contact_id          UUID NOT NULL REFERENCES public.atendimento_contacts(id)    ON DELETE CASCADE,
  inbox_id            UUID NOT NULL REFERENCES public.atendimento_inboxes(id)     ON DELETE CASCADE,
  template_id         UUID          REFERENCES public.atendimento_whatsapp_templates(id) ON DELETE SET NULL,
  conversation_id     UUID          REFERENCES public.atendimento_conversations(id) ON DELETE SET NULL,

  -- Conteúdo
  content             TEXT,                     -- texto livre (se não for template)
  content_type        TEXT NOT NULL DEFAULT 'text'
                        CHECK (content_type IN ('text', 'template', 'image', 'audio', 'video', 'file')),
  variables           JSONB DEFAULT '[]',       -- array de strings para template

  -- Canal (denormalizado do inbox para filtro rápido)
  channel             TEXT NOT NULL DEFAULT 'whatsapp'
                        CHECK (channel IN ('whatsapp', 'instagram', 'messenger', 'telegram', 'email', 'sms', 'api')),

  -- Agendamento
  scheduled_at        TIMESTAMPTZ NOT NULL,
  timezone            TEXT NOT NULL DEFAULT 'America/Campo_Grande',
  recurrence_rule     JSONB,                    -- { freq: 'DAILY'|'WEEKLY'|'MONTHLY', interval, byday, until }

  -- Status do disparo
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts            INT NOT NULL DEFAULT 0,
  last_attempt_at     TIMESTAMPTZ,
  sent_message_id     UUID REFERENCES public.atendimento_messages(id) ON DELETE SET NULL,
  error_message       TEXT,

  -- Auditoria
  created_by          UUID,                     -- auth.users.id
  account_id          UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índice crítico para o worker (filtra status='pending' AND scheduled_at <= now())
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_worker
  ON public.atendimento_scheduled_messages(status, scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_contact
  ON public.atendimento_scheduled_messages(contact_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_inbox
  ON public.atendimento_scheduled_messages(inbox_id, status);

-- ============================================================
-- 4. Eventos Google Calendar (calendar_events)
-- Criação de reuniões vinculadas a deal/contact, sincronizadas via Google API.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_calendar_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relacionamentos (ambos opcionais — evento solto também é válido)
  deal_id             UUID,                       -- FK adicionada quando S4 mergear pipelines/deals
  contact_id          UUID REFERENCES public.atendimento_contacts(id)      ON DELETE SET NULL,
  conversation_id     UUID REFERENCES public.atendimento_conversations(id) ON DELETE SET NULL,

  -- Dados do evento Google
  google_event_id     TEXT UNIQUE NOT NULL,        -- id retornado por calendar.events.insert
  google_calendar_id  TEXT NOT NULL DEFAULT 'primary',
  summary             TEXT NOT NULL,
  description         TEXT,
  location            TEXT,

  -- Janela
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,
  timezone            TEXT NOT NULL DEFAULT 'America/Campo_Grande',

  -- Meeting
  meeting_url         TEXT,                        -- Google Meet link, se criado
  attendees           JSONB DEFAULT '[]',          -- [{ email, responseStatus }]

  -- Status do evento (espelha Google)
  status              TEXT NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed', 'tentative', 'cancelled')),

  -- Auditoria
  created_by          UUID,
  account_id          UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start
  ON public.atendimento_calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_contact
  ON public.atendimento_calendar_events(contact_id)
  WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_deal
  ON public.atendimento_calendar_events(deal_id)
  WHERE deal_id IS NOT NULL;

-- ============================================================
-- 5. Google OAuth tokens (agendamentos com Google Calendar)
-- Fase 1 FIC: guarda refresh_token aqui (criptografado em-app).
-- Fase 2: migrar para vault ECOSYSTEM via @ecossistema/credentials.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.atendimento_google_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE,   -- auth.users.id (1 token por usuário)
  refresh_token       TEXT NOT NULL,          -- criptografar idealmente
  access_token        TEXT,                   -- cache de access_token corrente
  expires_at          TIMESTAMPTZ,
  scope               TEXT,
  email               TEXT,
  account_id          UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. Trigger: atualizar updated_at em UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION public.atendimento_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scheduled_messages_touch
  ON public.atendimento_scheduled_messages;
CREATE TRIGGER trg_scheduled_messages_touch
  BEFORE UPDATE ON public.atendimento_scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_touch_updated_at();

DROP TRIGGER IF EXISTS trg_calendar_events_touch
  ON public.atendimento_calendar_events;
CREATE TRIGGER trg_calendar_events_touch
  BEFORE UPDATE ON public.atendimento_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_touch_updated_at();

DROP TRIGGER IF EXISTS trg_google_tokens_touch
  ON public.atendimento_google_tokens;
CREATE TRIGGER trg_google_tokens_touch
  BEFORE UPDATE ON public.atendimento_google_tokens
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_touch_updated_at();

-- ============================================================
-- 6. Trigger: atualizar window_expires_at em INSERT de mensagem incoming
-- Cada mensagem recebida do contato reabre a janela de 24h WABA.
-- ============================================================
CREATE OR REPLACE FUNCTION public.atendimento_refresh_waba_window()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.message_type = 'incoming' THEN
    UPDATE public.atendimento_conversations
    SET window_expires_at = NEW.created_at + INTERVAL '24 hours'
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_waba_window
  ON public.atendimento_messages;
CREATE TRIGGER trg_refresh_waba_window
  AFTER INSERT ON public.atendimento_messages
  FOR EACH ROW EXECUTE FUNCTION public.atendimento_refresh_waba_window();

-- ============================================================
-- Fim da migração S5
-- ============================================================
