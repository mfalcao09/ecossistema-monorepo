-- ============================================================
-- ATENDIMENTO S10 — DS Agente (IA OpenAI + RAG pgvector)
-- ============================================================
-- Criado: 2026-04-29
-- Sprint: S10 (Atendimento)
-- Dependências:
--   - 20260412_atendimento_modulo_init.sql  (atendimento_conversations,
--                                            atendimento_messages, atendimento_labels)
--   - 20260421_atendimento_s6_cargos.sql    (RBAC; módulo `ds_ai`)
--
-- Objetivo:
--   Suporte a agentes de IA autônomos (DS Agente) com base de conhecimento
--   vetorial (RAG) e log de execuções. Substitui a primeira camada de
--   atendimento da Secretaria FIC para perguntas comuns
--   (matrícula, regulamento, grade, calendário).
--
-- Tabelas novas:
--   - ds_agents              (config do agente: prompt, params, ativação)
--   - ds_agent_knowledge     (chunks com embedding 768 dim)
--   - ds_agent_executions    (log de cada inferência: latência, tokens, hand-off)
--
-- Extensão:
--   - pgvector                (vector(768), índice HNSW para cosine similarity)
--
-- RLS:
--   - Permissiva (Fase 1 single-tenant FIC). Aperta no multi-tenant — P-130.
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Extensão pgvector
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. ds_agents — configuração de cada agente IA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_agents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant (Fase 2 multi-tenant). NULL = global FIC.
  account_id          UUID,

  -- Identificação
  name                TEXT        NOT NULL,
  description         TEXT,

  -- Prompt + parâmetros LLM
  system_prompt       TEXT        NOT NULL,
  model               VARCHAR(64) NOT NULL DEFAULT 'gpt-4o-mini',
  temperature         NUMERIC(3,2) NOT NULL DEFAULT 0.7
                        CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens          INT         NOT NULL DEFAULT 200
                        CHECK (max_tokens > 0 AND max_tokens <= 4000),

  -- Janela de contexto (últimas N mensagens da conversa)
  max_history         INT         NOT NULL DEFAULT 10
                        CHECK (max_history >= 0 AND max_history <= 50),

  -- Delay simulando "digitando" (segundos)
  delay_seconds       INT         NOT NULL DEFAULT 2
                        CHECK (delay_seconds >= 0 AND delay_seconds <= 60),

  -- Ativação por tags (atendimento_labels.id)
  activation_tags     UUID[]      NOT NULL DEFAULT '{}',
  tag_logic           VARCHAR(8)  NOT NULL DEFAULT 'OR'
                        CHECK (tag_logic IN ('AND', 'OR')),

  -- Canais habilitados (slug do inbox.channel: 'whatsapp', 'instagram', etc.)
  channels            VARCHAR(32)[] NOT NULL DEFAULT ARRAY['whatsapp']::VARCHAR[],

  -- Comportamento
  split_messages      BOOLEAN     NOT NULL DEFAULT true,   -- quebra resposta em 2-3 mensagens "humanas"
  process_images      BOOLEAN     NOT NULL DEFAULT false,  -- envia imagens recebidas para o LLM (Vision)
  handoff_on_human    BOOLEAN     NOT NULL DEFAULT true,   -- desativa se humano interveio na conversa
  handoff_keywords    TEXT[]      NOT NULL DEFAULT ARRAY[
                                    'falar com atendente',
                                    'humano',
                                    'pessoa real',
                                    'atendimento humano'
                                  ]::TEXT[],

  -- Estado
  enabled             BOOLEAN     NOT NULL DEFAULT false,

  -- Auditoria
  created_by          UUID,                                -- auth.users.id (NULL se seed)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_agents_account
  ON public.ds_agents(account_id);
CREATE INDEX IF NOT EXISTS idx_ds_agents_enabled
  ON public.ds_agents(enabled) WHERE enabled = true;

COMMENT ON TABLE  public.ds_agents IS 'S10 — Configuração de agentes IA (DS Agente)';
COMMENT ON COLUMN public.ds_agents.activation_tags IS 'Array de atendimento_labels.id que ativam o agente quando aplicadas à conversa';
COMMENT ON COLUMN public.ds_agents.tag_logic       IS 'AND = todas as tags presentes; OR = qualquer';
COMMENT ON COLUMN public.ds_agents.handoff_keywords IS 'Palavras-chave do contato que disparam hand-off humano';

-- ============================================================
-- 2. ds_agent_knowledge — base RAG (chunks vetoriais)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_agent_knowledge (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id        UUID        NOT NULL REFERENCES public.ds_agents(id) ON DELETE CASCADE,

  title           TEXT        NOT NULL,           -- ex: "Regulamento Acadêmico - Capítulo 3"
  content         TEXT        NOT NULL,           -- chunk text (500-800 tokens)
  source_url      TEXT,                            -- origem opcional (URL/path)

  -- Embedding gerado por text-embedding-004 (768 dim)
  embedding       vector(768),

  -- Metadados extras (página PDF, seção, etc.)
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_knowledge_agent
  ON public.ds_agent_knowledge(agent_id);

-- HNSW index para busca por cosine similarity (rápido em produção).
-- m=16 / ef_construction=64 são valores default razoáveis para até ~100k chunks.
CREATE INDEX IF NOT EXISTS idx_ds_knowledge_embedding_hnsw
  ON public.ds_agent_knowledge
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON TABLE  public.ds_agent_knowledge IS 'S10 — Chunks RAG por agente (vector 768 = text-embedding-004)';

-- RPC para busca vetorial (cosine similarity).
-- Retorna top_k chunks mais relevantes para o agent_id, com score 0..1.
CREATE OR REPLACE FUNCTION public.match_ds_agent_knowledge(
  p_agent_id  UUID,
  p_embedding vector(768),
  p_top_k     INT DEFAULT 5,
  p_min_score NUMERIC DEFAULT 0.0
)
RETURNS TABLE (
  id          UUID,
  title       TEXT,
  content     TEXT,
  source_url  TEXT,
  score       NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    k.id,
    k.title,
    k.content,
    k.source_url,
    (1 - (k.embedding <=> p_embedding))::NUMERIC AS score
  FROM public.ds_agent_knowledge k
  WHERE k.agent_id = p_agent_id
    AND k.embedding IS NOT NULL
    AND (1 - (k.embedding <=> p_embedding)) >= p_min_score
  ORDER BY k.embedding <=> p_embedding ASC
  LIMIT p_top_k;
$$;

COMMENT ON FUNCTION public.match_ds_agent_knowledge IS
  'S10 — Busca top_k chunks por cosine similarity para um agente. Score 0..1 (1 = match perfeito).';

-- ============================================================
-- 3. ds_agent_executions — log de cada inferência
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ds_agent_executions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id            UUID        NOT NULL REFERENCES public.ds_agents(id) ON DELETE CASCADE,
  conversation_id     UUID        NOT NULL REFERENCES public.atendimento_conversations(id) ON DELETE CASCADE,
  message_id          UUID,                                -- atendimento_messages.id que disparou (nullable: playground)

  -- Entrada
  input_text          TEXT        NOT NULL,

  -- RAG retrieval (top_k chunks usados — JSON com {id, title, score})
  rag_chunks          JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Saída
  output_text         TEXT,
  output_messages     JSONB       NOT NULL DEFAULT '[]'::jsonb,    -- array de strings se split_messages
  tokens_used         INT         NOT NULL DEFAULT 0,
  latency_ms          INT         NOT NULL DEFAULT 0,

  -- Comportamento
  handoff_triggered   BOOLEAN     NOT NULL DEFAULT false,
  handoff_reason      TEXT,                                          -- 'human_intervened' | 'keyword' | 'no_rag_match' | 'error'
  skipped             BOOLEAN     NOT NULL DEFAULT false,
  skip_reason         TEXT,                                          -- 'tag_mismatch' | 'channel_mismatch' | 'disabled' | 'human_active'

  -- Erro (se houve)
  error               TEXT,

  executed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_exec_agent_time
  ON public.ds_agent_executions(agent_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ds_exec_conversation
  ON public.ds_agent_executions(conversation_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ds_exec_handoff
  ON public.ds_agent_executions(handoff_triggered) WHERE handoff_triggered = true;
CREATE INDEX IF NOT EXISTS idx_ds_exec_error
  ON public.ds_agent_executions(executed_at DESC) WHERE error IS NOT NULL;

COMMENT ON TABLE public.ds_agent_executions IS 'S10 — Log de cada inferência IA (input, RAG, output, latência, hand-off)';

-- ============================================================
-- 4. Trigger updated_at em ds_agents
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_ds_agents_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ds_agents_set_updated_at ON public.ds_agents;
CREATE TRIGGER ds_agents_set_updated_at
  BEFORE UPDATE ON public.ds_agents
  FOR EACH ROW EXECUTE FUNCTION public.tg_ds_agents_set_updated_at();

-- ============================================================
-- 5. RLS — permissiva Fase 1 (FIC single-tenant)
-- ============================================================
ALTER TABLE public.ds_agents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds_agent_knowledge    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ds_agent_executions   ENABLE ROW LEVEL SECURITY;

-- Authenticated users podem tudo (RBAC fina é checada na API com withPermission).
DROP POLICY IF EXISTS auth_only_ds_agents ON public.ds_agents;
CREATE POLICY auth_only_ds_agents ON public.ds_agents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_only_ds_knowledge ON public.ds_agent_knowledge;
CREATE POLICY auth_only_ds_knowledge ON public.ds_agent_knowledge
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_only_ds_executions ON public.ds_agent_executions;
CREATE POLICY auth_only_ds_executions ON public.ds_agent_executions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- service_role bypass total (usado pelo runner via createAdminClient)
DROP POLICY IF EXISTS service_role_ds_agents ON public.ds_agents;
CREATE POLICY service_role_ds_agents ON public.ds_agents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_ds_knowledge ON public.ds_agent_knowledge;
CREATE POLICY service_role_ds_knowledge ON public.ds_agent_knowledge
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_ds_executions ON public.ds_agent_executions;
CREATE POLICY service_role_ds_executions ON public.ds_agent_executions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;

-- ============================================================
-- Smoke test (rodar manualmente após apply):
--   SELECT extname FROM pg_extension WHERE extname='vector';
--   SELECT count(*) FROM pg_indexes WHERE indexname='idx_ds_knowledge_embedding_hnsw';
--   SELECT proname FROM pg_proc WHERE proname='match_ds_agent_knowledge';
-- ============================================================
