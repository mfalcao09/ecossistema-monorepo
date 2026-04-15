-- Migration: ecosystem_memory (base schema)
-- Criado em: 2026-04-15 · PLANO-V4 Fase 0 Sprint 0.1
-- Responsável pela evolução: Sessão A (memory)
-- DB alvo: ECOSYSTEM (gqckbunsfjgerbuiyzvn)

-- Extensões
CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Tabela principal
CREATE TABLE IF NOT EXISTS ecosystem_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('context','decision','feedback','project','reference','user')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,  -- SEM truncamento — Art. XXII
  project TEXT,           -- ecosystem, erp-fic, intentus, klesis, splendori, nexvy
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  actor TEXT,             -- agente que gerou: claudinho, cfo_ia, buchecha, session_A
  session_id TEXT,
  parent_event_id UUID REFERENCES ecosystem_memory(id),
  success_score NUMERIC(3,2),  -- 0.00 a 1.00
  embedding VECTOR(768),       -- via RAG-engine Railway (text-embedding-004)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_eco_mem_type    ON ecosystem_memory(type);
CREATE INDEX IF NOT EXISTS idx_eco_mem_project ON ecosystem_memory(project);
CREATE INDEX IF NOT EXISTS idx_eco_mem_tags    ON ecosystem_memory USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_eco_mem_actor   ON ecosystem_memory(actor);
CREATE INDEX IF NOT EXISTS idx_eco_mem_session ON ecosystem_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_eco_mem_created ON ecosystem_memory(created_at DESC);

-- Similarity search index (Sessão A pode ajustar listas)
CREATE INDEX IF NOT EXISTS idx_eco_mem_embedding
  ON ecosystem_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS
ALTER TABLE ecosystem_memory ENABLE ROW LEVEL SECURITY;

-- Policy inicial: service-role only (Sessão A expande depois)
CREATE POLICY "service_role_full_access"
  ON ecosystem_memory FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_ecosystem_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_eco_mem_updated
BEFORE UPDATE ON ecosystem_memory
FOR EACH ROW EXECUTE FUNCTION update_ecosystem_memory_updated_at();

-- Function bootstrap_session: retorna top-k memórias relevantes para a task atual
-- Usada por TODOS os agentes no início de sessão (Art. XXII)
CREATE OR REPLACE FUNCTION bootstrap_session(
  task_description TEXT,
  target_project   TEXT DEFAULT NULL,
  k                INT  DEFAULT 10
)
RETURNS TABLE (
  id UUID, type TEXT, title TEXT, content TEXT,
  project TEXT, tags TEXT[], actor TEXT,
  success_score NUMERIC, similarity NUMERIC, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
DECLARE
  query_embedding VECTOR(768);
BEGIN
  -- NOTA: Sessão A deve implementar chamada ao RAG-engine para gerar embedding
  -- Placeholder: retorna últimas N do projeto se embedding não disponível
  RETURN QUERY
  SELECT m.id, m.type, m.title, m.content, m.project, m.tags, m.actor,
         m.success_score, 0.0::NUMERIC AS similarity, m.created_at
    FROM ecosystem_memory m
   WHERE (target_project IS NULL OR m.project = target_project)
   ORDER BY m.created_at DESC
   LIMIT k;
END;
$$;

COMMENT ON TABLE ecosystem_memory IS
  'Memória canônica do Ecossistema. Art. XXII — Aprendizado é Infraestrutura. NADA se perde.';
