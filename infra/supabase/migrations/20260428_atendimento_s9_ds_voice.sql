-- ============================================================
-- ATENDIMENTO S9 — DS Voice (biblioteca + funis + gatilhos)
-- ============================================================
-- Criado: 2026-04-28
-- Sprint: S9 (Atendimento)
-- Dependências:
--   - 20260412_atendimento_modulo_init.sql (atendimento_contacts, atendimento_conversations, atendimento_messages)
--   - 20260426_atendimento_s8a_automations.sql (app_installations — reuso para toggle 'ia_transcription')
--
-- Objetivo:
--   Biblioteca DS Voice (mensagens/áudios/mídias/documentos com pastas hierárquicas),
--   construtor de funis/sequências (drip marketing) e gatilhos (keyword/tag/new_conv).
--
-- Tabelas novas (8 + 1 bonus):
--   - ds_voice_folders             (pastas hierárquicas por tipo)
--   - ds_voice_messages            (templates de texto com variáveis)
--   - ds_voice_audios              (áudios — .mp3/.ogg/.m4a)
--   - ds_voice_media               (imagens/vídeos)
--   - ds_voice_documents           (PDFs, planilhas etc.)
--   - ds_voice_funnels             (funis/sequências)
--   - ds_voice_funnel_steps        (steps ordenados com delay)
--   - ds_voice_triggers            (gatilhos keyword/tag/new_conv)
--   - ds_voice_funnel_executions   (execuções em andamento — worker cron 1min)
--
-- Publicação Realtime: ds_voice_messages, ds_voice_audios, ds_voice_media,
--                      ds_voice_documents, ds_voice_funnel_executions
--                      (biblioteca ao vivo para múltiplos atendentes)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Pastas hierárquicas
-- ============================================================
-- Uma árvore por tipo de conteúdo (messages | audios | media | documents).
-- Rota: /atendimento/ds-voice?tab=mensagens&folder=<id>
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_voice_folders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID,
  kind               VARCHAR(20) NOT NULL
    CHECK (kind IN ('messages','audios','media','documents')),
  name               VARCHAR(160) NOT NULL,
  parent_id          UUID REFERENCES public.ds_voice_folders(id) ON DELETE CASCADE,
  sort_order         INT NOT NULL DEFAULT 0,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_voice_folders_kind_parent
  ON public.ds_voice_folders (kind, parent_id NULLS FIRST, sort_order);

COMMENT ON TABLE public.ds_voice_folders IS
  'Pastas hierárquicas da biblioteca DS Voice. parent_id NULL = raiz. Uma árvore por kind.';

-- ============================================================
-- 2. Mensagens (templates de texto com variáveis)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_voice_messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID,
  folder_id          UUID REFERENCES public.ds_voice_folders(id) ON DELETE SET NULL,
  title              VARCHAR(200) NOT NULL,
  content            TEXT NOT NULL,
  variables          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- lista de variáveis detectadas: ["Nome","Primeiro Nome","Saudação","Hora"]
  is_default         BOOLEAN NOT NULL DEFAULT false,       -- favorita (mostra primeiro)
  enabled            BOOLEAN NOT NULL DEFAULT true,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_voice_messages_folder
  ON public.ds_voice_messages (folder_id, enabled);
CREATE INDEX IF NOT EXISTS idx_ds_voice_messages_title_trgm
  ON public.ds_voice_messages USING gin (title gin_trgm_ops);

COMMENT ON TABLE public.ds_voice_messages IS
  'Mensagens de texto reutilizáveis. Variáveis suportadas: {Nome} {Primeiro Nome} {Saudação} {Hora}.';

-- ============================================================
-- 3. Áudios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_voice_audios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID,
  folder_id             UUID REFERENCES public.ds_voice_folders(id) ON DELETE SET NULL,
  title                 VARCHAR(200) NOT NULL,
  storage_path          TEXT NOT NULL,             -- ex: ds-voice/audios/<account>/<uuid>.mp3 (bucket atendimento)
  file_url              TEXT,                      -- URL pública/signed (cache conveniência)
  file_size_bytes       BIGINT,
  duration_seconds      INT,
  mime_type             VARCHAR(100),
  send_as_voice_note    BOOLEAN NOT NULL DEFAULT true,  -- enviar como push-to-talk (WhatsApp audio/ogg)
  enabled               BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_voice_audios_folder
  ON public.ds_voice_audios (folder_id, enabled);

COMMENT ON TABLE public.ds_voice_audios IS
  'Áudios pré-gravados. storage_path em Supabase Storage bucket "atendimento".';

-- ============================================================
-- 4. Mídias (imagens/vídeos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_voice_media (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID,
  folder_id          UUID REFERENCES public.ds_voice_folders(id) ON DELETE SET NULL,
  title              VARCHAR(200) NOT NULL,
  storage_path       TEXT NOT NULL,
  file_url           TEXT,
  file_size_bytes    BIGINT,
  mime_type          VARCHAR(100),
  media_type         VARCHAR(20) NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image','video')),
  caption            TEXT,
  enabled            BOOLEAN NOT NULL DEFAULT true,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_voice_media_folder
  ON public.ds_voice_media (folder_id, enabled);

COMMENT ON TABLE public.ds_voice_media IS
  'Imagens (≤5MB) e vídeos (≤100MB) com caption opcional.';

-- ============================================================
-- 5. Documentos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_voice_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID,
  folder_id          UUID REFERENCES public.ds_voice_folders(id) ON DELETE SET NULL,
  title              VARCHAR(200) NOT NULL,
  storage_path       TEXT NOT NULL,
  file_url           TEXT,
  file_size_bytes    BIGINT,
  mime_type          VARCHAR(100),
  filename           VARCHAR(260),
  enabled            BOOLEAN NOT NULL DEFAULT true,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_voice_documents_folder
  ON public.ds_voice_documents (folder_id, enabled);

COMMENT ON TABLE public.ds_voice_documents IS
  'Documentos (PDF, XLSX, DOCX etc.) ≤100MB. Aviso: incompatíveis com Instagram.';

-- ============================================================
-- 6. Funis (sequências drip)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_voice_funnels (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                UUID,
  name                      VARCHAR(200) NOT NULL,
  description               TEXT,
  total_duration_seconds    INT NOT NULL DEFAULT 0,   -- somatório dos delays dos steps (denorm)
  step_count                INT NOT NULL DEFAULT 0,
  enabled                   BOOLEAN NOT NULL DEFAULT true,
  created_by                UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_voice_funnels_enabled
  ON public.ds_voice_funnels (enabled);

COMMENT ON TABLE public.ds_voice_funnels IS
  'Funis/sequências drip. total_duration_seconds é somatório denormalizado (recalc via trigger).';

-- ============================================================
-- 7. Steps do funil
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_voice_funnel_steps (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id          UUID NOT NULL REFERENCES public.ds_voice_funnels(id) ON DELETE CASCADE,
  sort_order         INT NOT NULL,
  item_type          VARCHAR(20) NOT NULL
    CHECK (item_type IN ('message','audio','media','document')),
  item_id            UUID NOT NULL,
  delay_seconds      INT NOT NULL DEFAULT 0,   -- delay relativo ao step anterior
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_voice_funnel_steps_funnel_sort
  ON public.ds_voice_funnel_steps (funnel_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ds_voice_funnel_steps_funnel_sort
  ON public.ds_voice_funnel_steps (funnel_id, sort_order);

COMMENT ON TABLE public.ds_voice_funnel_steps IS
  'Steps ordenados. item_type + item_id apontam para ds_voice_{messages|audios|media|documents}. Não há FK cross-table (aplicação valida).';

-- Trigger: recalcula total_duration_seconds e step_count do funil quando steps mudam
CREATE OR REPLACE FUNCTION public.ds_voice_funnels_recalc_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_funnel UUID;
BEGIN
  v_funnel := COALESCE(NEW.funnel_id, OLD.funnel_id);
  UPDATE public.ds_voice_funnels f
     SET total_duration_seconds = COALESCE((
           SELECT SUM(delay_seconds)
             FROM public.ds_voice_funnel_steps
            WHERE funnel_id = v_funnel
         ), 0),
         step_count = COALESCE((
           SELECT COUNT(*)::INT
             FROM public.ds_voice_funnel_steps
            WHERE funnel_id = v_funnel
         ), 0),
         updated_at = NOW()
   WHERE f.id = v_funnel;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ds_voice_funnel_steps_recalc ON public.ds_voice_funnel_steps;
CREATE TRIGGER trg_ds_voice_funnel_steps_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.ds_voice_funnel_steps
  FOR EACH ROW EXECUTE FUNCTION public.ds_voice_funnels_recalc_totals();

-- ============================================================
-- 8. Gatilhos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_voice_triggers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID,
  name               VARCHAR(200) NOT NULL,
  trigger_type       VARCHAR(30) NOT NULL
    CHECK (trigger_type IN ('keyword','tag_added','conversation_created')),
  trigger_value      TEXT,                       -- palavra-chave ou tag (null para conversation_created)
  match_mode         VARCHAR(20) NOT NULL DEFAULT 'contains'
    CHECK (match_mode IN ('contains','equals','starts_with','regex')),
  case_sensitive     BOOLEAN NOT NULL DEFAULT false,
  funnel_id          UUID NOT NULL REFERENCES public.ds_voice_funnels(id) ON DELETE CASCADE,
  channels           VARCHAR[] NOT NULL DEFAULT ARRAY['whatsapp']::VARCHAR[],  -- whatsapp|instagram|...
  enabled            BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at  TIMESTAMPTZ,
  trigger_count      INT NOT NULL DEFAULT 0,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_voice_triggers_type_enabled
  ON public.ds_voice_triggers (trigger_type, enabled);

COMMENT ON TABLE public.ds_voice_triggers IS
  'Gatilhos: palavra-chave recebida, tag adicionada ou nova conversa → enqueue ds_voice_funnel_executions.';

-- ============================================================
-- 9. Execuções de funil (worker cron 1min drena)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_voice_funnel_executions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id               UUID NOT NULL REFERENCES public.ds_voice_funnels(id) ON DELETE CASCADE,
  trigger_id              UUID REFERENCES public.ds_voice_triggers(id) ON DELETE SET NULL,
  contact_id              UUID,                  -- atendimento_contacts.id (não FK para evitar coupling cross-schema)
  conversation_id         UUID,                  -- atendimento_conversations.id
  current_step_order      INT NOT NULL DEFAULT 0,
  next_step_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                  VARCHAR(20) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','paused','done','failed','cancelled')),
  last_error              TEXT,
  attempt_count           INT NOT NULL DEFAULT 0,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice crítico para o worker: pegar executions prontas em 1 scan
CREATE INDEX IF NOT EXISTS idx_ds_voice_executions_status_next
  ON public.ds_voice_funnel_executions (status, next_step_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_ds_voice_executions_conversation
  ON public.ds_voice_funnel_executions (conversation_id, status);

-- Evita duplicar execução do mesmo funil para a mesma conversa ativa
CREATE UNIQUE INDEX IF NOT EXISTS uq_ds_voice_executions_funnel_conv_running
  ON public.ds_voice_funnel_executions (funnel_id, conversation_id)
  WHERE status = 'running';

COMMENT ON TABLE public.ds_voice_funnel_executions IS
  'Instância viva de um funil para um contato. Worker cron /api/cron/process-funnel-steps drena status=running E next_step_at<=now().';

-- ============================================================
-- 10. updated_at triggers (reaproveita função atendimento_set_updated_at)
-- ============================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ds_voice_folders',
    'ds_voice_messages',
    'ds_voice_audios',
    'ds_voice_media',
    'ds_voice_documents',
    'ds_voice_funnels',
    'ds_voice_triggers',
    'ds_voice_funnel_executions'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.atendimento_set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 11. RLS — authenticated only (Fase 1 single-tenant, igual S7/S8a/S8b)
-- ============================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ds_voice_folders',
    'ds_voice_messages',
    'ds_voice_audios',
    'ds_voice_media',
    'ds_voice_documents',
    'ds_voice_funnels',
    'ds_voice_funnel_steps',
    'ds_voice_triggers',
    'ds_voice_funnel_executions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
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
-- 12. Realtime publication
-- ============================================================
-- Biblioteca ao vivo: vários atendentes editando simultaneamente vêem updates.
-- Executions também: UI de monitoramento mostra progresso.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ds_voice_messages',
    'ds_voice_audios',
    'ds_voice_media',
    'ds_voice_documents',
    'ds_voice_folders',
    'ds_voice_funnel_executions'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      -- Já está na publication — ok
      NULL;
    WHEN undefined_object THEN
      -- Publication não existe (raríssimo em dev local sem realtime) — ignora
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- 13. Seed: pastas-raiz padrão por kind (exemplo inicial)
-- ============================================================
INSERT INTO public.ds_voice_folders (kind, name, sort_order)
VALUES
  ('messages', 'Geral',      0),
  ('audios',   'Geral',      0),
  ('media',    'Geral',      0),
  ('documents','Geral',      0)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 14. Seed: registra app "ia_transcription" e "ds_voice" no catálogo de apps
-- ============================================================
-- ia_transcription já existe (S8a), garante row. ds_voice_triggers é habilitado
-- de fábrica (não é um app habilitável, faz parte do módulo).
INSERT INTO public.app_installations (app_key, config, enabled)
VALUES
  ('ia_transcription', '{"description": "Transcrever áudios recebidos via Gemini 2.5 Flash", "provider": "gemini-2.5-flash"}', false)
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================
-- ROLLBACK (dev):
--   DROP TABLE IF EXISTS public.ds_voice_funnel_executions CASCADE;
--   DROP TABLE IF EXISTS public.ds_voice_triggers CASCADE;
--   DROP TABLE IF EXISTS public.ds_voice_funnel_steps CASCADE;
--   DROP TABLE IF EXISTS public.ds_voice_funnels CASCADE;
--   DROP TABLE IF EXISTS public.ds_voice_documents CASCADE;
--   DROP TABLE IF EXISTS public.ds_voice_media CASCADE;
--   DROP TABLE IF EXISTS public.ds_voice_audios CASCADE;
--   DROP TABLE IF EXISTS public.ds_voice_messages CASCADE;
--   DROP TABLE IF EXISTS public.ds_voice_folders CASCADE;
--   DROP FUNCTION IF EXISTS public.ds_voice_funnels_recalc_totals() CASCADE;
-- ============================================================
