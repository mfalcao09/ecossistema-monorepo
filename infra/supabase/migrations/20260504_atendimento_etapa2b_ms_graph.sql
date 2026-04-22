-- ═══════════════════════════════════════════════════════════════════════════
-- Etapa 2-B · Refactor S5: Google Calendar → Microsoft Graph (app-only)
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto:
--   Marcelo 2026-04-22: FIC já usa Microsoft 365 (e-mail, OneDrive, Teams).
--   Faz mais sentido usar o app Entra já existente (`ecossistema-agentes-fic`,
--   tenant FIC, 23 permissões Graph com admin consent — inclui
--   `Calendars.ReadWrite`) em vez de duplicar OAuth por usuário contra o Google.
--
--   Decisão arquitetural: fluxo app-only (client_credentials) — o ERP autentica
--   como o próprio app e cria eventos em `/users/{mailbox}/events`. Sem OAuth
--   consent de usuário, sem refresh_token per-user, sem tabela de tokens.
--
-- O que esta migration faz:
--   1. `atendimento_calendar_events.google_event_id` → `provider_event_id`
--   2. `atendimento_calendar_events.google_calendar_id` → `provider_calendar_id`
--   3. Adiciona `provider TEXT` (default 'microsoft') + `organizer_email TEXT`
--      (mailbox onde o evento foi criado — `auth.users.email` do atendente)
--   4. Remove `atendimento_google_tokens` (obsoleto no fluxo app-only)
--
-- Rollback manual:
--   ALTER TABLE public.atendimento_calendar_events
--     DROP COLUMN IF EXISTS provider,
--     DROP COLUMN IF EXISTS organizer_email;
--   ALTER TABLE public.atendimento_calendar_events
--     RENAME COLUMN provider_event_id TO google_event_id;
--   ALTER TABLE public.atendimento_calendar_events
--     RENAME COLUMN provider_calendar_id TO google_calendar_id;
--   -- atendimento_google_tokens perdeu os dados — restaurar de backup se necessário.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Renomeia colunas google_* → provider_* (idempotente)
-- ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='atendimento_calendar_events'
      AND column_name='google_event_id'
  ) THEN
    ALTER TABLE public.atendimento_calendar_events
      RENAME COLUMN google_event_id TO provider_event_id;
    RAISE NOTICE 'renomeado google_event_id → provider_event_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='atendimento_calendar_events'
      AND column_name='google_calendar_id'
  ) THEN
    ALTER TABLE public.atendimento_calendar_events
      RENAME COLUMN google_calendar_id TO provider_calendar_id;
    RAISE NOTICE 'renomeado google_calendar_id → provider_calendar_id';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Adiciona colunas provider + organizer_email
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.atendimento_calendar_events
  ADD COLUMN IF NOT EXISTS provider        TEXT NOT NULL DEFAULT 'microsoft',
  ADD COLUMN IF NOT EXISTS organizer_email TEXT;

COMMENT ON COLUMN public.atendimento_calendar_events.provider IS
  'Provedor do evento (microsoft | google). Default microsoft após 2026-04-22.';
COMMENT ON COLUMN public.atendimento_calendar_events.organizer_email IS
  'Mailbox onde o evento foi criado (auth.users.email do atendente que organizou).';

-- Constraint idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'atendimento_calendar_events_provider_check'
  ) THEN
    ALTER TABLE public.atendimento_calendar_events
      ADD CONSTRAINT atendimento_calendar_events_provider_check
      CHECK (provider IN ('microsoft', 'google'));
    RAISE NOTICE 'constraint atendimento_calendar_events_provider_check adicionada';
  END IF;
END $$;

-- Índice p/ organizer_email (busca "meus agendamentos")
CREATE INDEX IF NOT EXISTS idx_calendar_events_organizer
  ON public.atendimento_calendar_events(organizer_email)
  WHERE organizer_email IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Remove atendimento_google_tokens (obsoleto — app-only flow)
-- ───────────────────────────────────────────────────────────────────────────
-- O fluxo Microsoft Graph app-only não precisa armazenar refresh_token por
-- usuário (MSAL mantém token cache do app em memória). Toda a tabela some.
-- Se alguém ressuscitar o Google OAuth no futuro, restaura a tabela do S5.

DROP TRIGGER IF EXISTS trg_google_tokens_touch ON public.atendimento_google_tokens;
DROP TABLE IF EXISTS public.atendimento_google_tokens CASCADE;
