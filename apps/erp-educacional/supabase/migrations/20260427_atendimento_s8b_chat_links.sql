-- ============================================================
-- ATENDIMENTO S8B — Chat Interno + Links de Redirecionamento
-- ============================================================
-- Criado: 2026-04-27
-- Sprint: S8b (Atendimento — sessão paralela pós-S6)
-- Dependências:
--   20260412_atendimento_modulo_init.sql  (atendimento_agents, atendimento_contacts, atendimento_conversations)
--   20260421_atendimento_s6_cargos.sql    (teams, team_members)
--   20260421000000_atendimento_s4_kanban.sql (deals, em infra/supabase/migrations/)
--
-- Objetivo:
--   1) Chat interno Realtime entre atendentes (DM + grupos de time)
--      - team_chats        (conversa entre N agentes OU anexada a 1 team)
--      - team_chat_members (N..N agents ↔ chats + last_read_at)
--      - team_messages     (mensagens; reply, reactions JSONB, mentions agent_ids)
--      - ADD TABLE team_messages ao Supabase Realtime publication
--
--   2) Links de Redirecionamento (wa.me/<numero>?text=<saudacao>)
--      - link_redirects  (slug, numeros JSONB, distribution mode, schedule_config)
--      - link_clicks     (hash IP SHA-256, UA, UTM params, agent_selecionado)
--
-- Multi-tenant: account_id NULL = tenant default (FIC). Fase 2 SaaS preenche.
-- RLS permissiva (igual S6). Fase 2: apertar por account_id via JWT.
-- ============================================================

BEGIN;

-- ============================================================
-- TABELA: team_chats
-- Conversa interna. Pode ser:
--   - DM           (direct message entre 2 agents) → kind='dm',   team_id NULL
--   - Grupo livre  (N agents de times diferentes)  → kind='group', team_id NULL
--   - Grupo de time (todos os team_members)        → kind='team',  team_id NOT NULL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_chats (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID,
  kind         VARCHAR(10)  NOT NULL DEFAULT 'group'
                 CHECK (kind IN ('dm', 'group', 'team')),
  team_id      UUID         REFERENCES public.teams(id) ON DELETE CASCADE,
  title        VARCHAR(120),                   -- opcional para DM; obrigatório exibição p/ group
  created_by   UUID         REFERENCES public.atendimento_agents(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK ((kind = 'team' AND team_id IS NOT NULL) OR (kind <> 'team'))
);

CREATE INDEX IF NOT EXISTS idx_team_chats_team          ON public.team_chats (team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_chats_last_message  ON public.team_chats (last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_team_chats_account       ON public.team_chats (account_id);

COMMENT ON TABLE  public.team_chats           IS 'Chat interno entre atendentes: DM, group livre, ou grupo de time.';
COMMENT ON COLUMN public.team_chats.kind      IS 'dm | group | team. Se team, team_id é obrigatório e membros são espelhados de team_members.';


-- ============================================================
-- TABELA: team_chat_members
-- Membros do chat + tracking de leitura
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_chat_members (
  chat_id       UUID        NOT NULL REFERENCES public.team_chats(id) ON DELETE CASCADE,
  agent_id      UUID        NOT NULL REFERENCES public.atendimento_agents(id) ON DELETE CASCADE,
  last_read_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  muted         BOOLEAN     NOT NULL DEFAULT false,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_team_chat_members_agent ON public.team_chat_members (agent_id);

COMMENT ON TABLE  public.team_chat_members              IS 'Membros de um chat interno. last_read_at ⇒ unread_count = messages > last_read_at.';


-- ============================================================
-- TABELA: team_messages
-- Mensagens do chat interno
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id        UUID        NOT NULL REFERENCES public.team_chats(id) ON DELETE CASCADE,
  author_id      UUID        NOT NULL REFERENCES public.atendimento_agents(id) ON DELETE CASCADE,
  body           TEXT        NOT NULL,
  reply_to_id    UUID        REFERENCES public.team_messages(id) ON DELETE SET NULL,
  mentions       UUID[]      NOT NULL DEFAULT '{}',        -- agent_ids mencionados (@)
  refs           JSONB       NOT NULL DEFAULT '[]'::jsonb, -- [{type:'conversation'|'deal'|'contact', id:'uuid', label:'...'}]
  reactions      JSONB       NOT NULL DEFAULT '{}'::jsonb, -- { "👍": ["agent_id1","agent_id2"], "🔥":["id3"] }
  edited_at      TIMESTAMPTZ,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_messages_chat_created
  ON public.team_messages (chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_messages_author
  ON public.team_messages (author_id);

CREATE INDEX IF NOT EXISTS idx_team_messages_mentions
  ON public.team_messages USING GIN (mentions);

COMMENT ON TABLE  public.team_messages           IS 'Mensagens do chat interno. Suporta reply-to, mentions @, reactions emoji e refs cross-módulo (#conversa/#deal/#contato).';
COMMENT ON COLUMN public.team_messages.refs      IS 'Array de referências cross-módulo: [{type:"conversation"|"deal"|"contact", id:"uuid", label:"texto"}]';
COMMENT ON COLUMN public.team_messages.reactions IS 'Dicionário emoji → array de agent_ids que reagiram.';


-- ============================================================
-- Trigger: atualizar last_message_at em team_chats após INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_s8b_touch_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.team_chats
     SET last_message_at = NEW.created_at,
         updated_at      = NEW.created_at
   WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_messages_touch_chat ON public.team_messages;
CREATE TRIGGER trg_team_messages_touch_chat
  AFTER INSERT ON public.team_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_s8b_touch_chat_last_message();


-- ============================================================
-- Trigger: updated_at em team_chats
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_s8b_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_chats_updated_at ON public.team_chats;
CREATE TRIGGER trg_team_chats_updated_at
  BEFORE UPDATE ON public.team_chats
  FOR EACH ROW EXECUTE FUNCTION public.trg_s8b_set_updated_at();


-- ============================================================
-- TABELA: link_redirects
-- Link público /l/<slug> que roteia para um WhatsApp conforme distribuição
-- ============================================================
CREATE TABLE IF NOT EXISTS public.link_redirects (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID,
  slug            VARCHAR(64)  NOT NULL,
  name            VARCHAR(120) NOT NULL,
  greeting        TEXT,                                   -- mensagem pré-preenchida (text=...)
  numbers         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    -- [{number:"5567...", label:"Alice", weight:1, active:true}]
  distribution    VARCHAR(16)  NOT NULL DEFAULT 'sequential'
                    CHECK (distribution IN ('sequential', 'random', 'ordered', 'by_hour')),
  schedule_config JSONB        NOT NULL DEFAULT '{}'::jsonb,
    -- ordered:  {order:[0,1,2]}
    -- by_hour:  {"0-8": 0, "8-12": 1, "12-18": 2, "18-24": 0}   (chave hora → index em numbers)
    -- timezone: {tz:"America/Sao_Paulo"}
  cursor_idx      INTEGER      NOT NULL DEFAULT 0,        -- round-robin counter (sequential)
  total_clicks    INTEGER      NOT NULL DEFAULT 0,
  active          BOOLEAN      NOT NULL DEFAULT true,
  created_by      UUID         REFERENCES public.atendimento_agents(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_link_redirects_account_slug
  ON public.link_redirects (COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

CREATE INDEX IF NOT EXISTS idx_link_redirects_active
  ON public.link_redirects (active) WHERE active = true;

COMMENT ON TABLE  public.link_redirects             IS 'Links públicos /l/<slug> — redirecionam para wa.me com distribuição configurável.';
COMMENT ON COLUMN public.link_redirects.distribution IS 'sequential = round-robin; random = aleatório ponderado; ordered = schedule_config.order; by_hour = schedule_config mapa hora→index.';
COMMENT ON COLUMN public.link_redirects.cursor_idx  IS 'Incrementado (mod N) a cada click quando distribution=sequential.';


-- ============================================================
-- Trigger: updated_at em link_redirects
-- ============================================================
DROP TRIGGER IF EXISTS trg_link_redirects_updated_at ON public.link_redirects;
CREATE TRIGGER trg_link_redirects_updated_at
  BEFORE UPDATE ON public.link_redirects
  FOR EACH ROW EXECUTE FUNCTION public.trg_s8b_set_updated_at();


-- ============================================================
-- TABELA: link_clicks
-- Registro de cada click em /l/<slug>
-- ============================================================
CREATE TABLE IF NOT EXISTS public.link_clicks (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id           UUID         NOT NULL REFERENCES public.link_redirects(id) ON DELETE CASCADE,
  ip_hash           VARCHAR(64),                          -- SHA-256 hex do IP
  user_agent        TEXT,
  referer           TEXT,
  utm_source        VARCHAR(100),
  utm_medium        VARCHAR(100),
  utm_campaign      VARCHAR(100),
  utm_term          VARCHAR(100),
  utm_content       VARCHAR(100),
  selected_index    INTEGER,                              -- index do number selecionado (numbers[i])
  selected_number   VARCHAR(32),                          -- denormalizado p/ relatórios
  country           VARCHAR(2),                           -- opcional (CF headers)
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_link_created
  ON public.link_clicks (link_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_link_clicks_utm
  ON public.link_clicks (utm_source, utm_campaign) WHERE utm_source IS NOT NULL;

COMMENT ON TABLE  public.link_clicks         IS 'Eventos de click em /l/<slug>. ip_hash = SHA-256 p/ LGPD (não armazena IP cru).';


-- ============================================================
-- Trigger: incrementar total_clicks em link_redirects após INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_s8b_increment_link_clicks()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.link_redirects
     SET total_clicks = total_clicks + 1
   WHERE id = NEW.link_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_link_clicks_increment ON public.link_clicks;
CREATE TRIGGER trg_link_clicks_increment
  AFTER INSERT ON public.link_clicks
  FOR EACH ROW EXECUTE FUNCTION public.trg_s8b_increment_link_clicks();


-- ============================================================
-- RLS — habilita e cria policies permissivas iniciais (igual S6)
-- ============================================================
ALTER TABLE public.team_chats         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_redirects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_team_chats_authenticated_all ON public.team_chats;
CREATE POLICY p_team_chats_authenticated_all ON public.team_chats
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_team_chat_members_authenticated_all ON public.team_chat_members;
CREATE POLICY p_team_chat_members_authenticated_all ON public.team_chat_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_team_messages_authenticated_all ON public.team_messages;
CREATE POLICY p_team_messages_authenticated_all ON public.team_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_link_redirects_authenticated_all ON public.link_redirects;
CREATE POLICY p_link_redirects_authenticated_all ON public.link_redirects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_link_clicks_authenticated_all ON public.link_clicks;
CREATE POLICY p_link_clicks_authenticated_all ON public.link_clicks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- /l/<slug> é rota PÚBLICA (sem auth) — o INSERT em link_clicks vai via
-- service-role pelo Route Handler em /api/l/[slug], não via JWT anon.
-- Nenhuma policy anon necessária.


-- ============================================================
-- Realtime: adicionar team_messages à publication
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Adiciona se ainda não está
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'team_messages'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'team_chats'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chats';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'team_chat_members'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_members';
    END IF;
  END IF;
END $$;


COMMIT;
