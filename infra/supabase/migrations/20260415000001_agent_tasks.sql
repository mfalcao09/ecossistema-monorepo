-- Migration: agent_tasks (Task Registry canônico)
-- Criado em: 2026-04-15 · PLANO-V4 Fase 0 Sprint 0.2
-- Responsável pela evolução: Sessão B (task-registry)
-- DB alvo: ECOSYSTEM (gqckbunsfjgerbuiyzvn)

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT UNIQUE NOT NULL,               -- T-042, T-043, …
  parent_task_id TEXT REFERENCES agent_tasks(task_id),
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT,                                 -- prompt original delegado
  assigned_to TEXT,                            -- claudinho, cfo_ia, buchecha, session_A
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','locked','running','completed','failed','blocked','cancelled')),
  priority INT DEFAULT 0,                      -- 0=normal, 1=alta, 2=crítica
  project TEXT,                                -- ecosystem, erp-fic, intentus, …
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  input JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  error TEXT,
  session_id TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status   ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON agent_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_project  ON agent_tasks(project);
CREATE INDEX IF NOT EXISTS idx_tasks_parent   ON agent_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tags     ON agent_tasks USING GIN(tags);

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_tasks"
  ON agent_tasks FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_agent_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_tasks_updated
BEFORE UPDATE ON agent_tasks
FOR EACH ROW EXECUTE FUNCTION update_agent_tasks_updated_at();

-- Function: lock otimista — só trava se ainda está pending
CREATE OR REPLACE FUNCTION acquire_task_lock(
  p_task_id TEXT,
  p_agent   TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE agent_tasks
     SET status = 'locked',
         locked_at = NOW(),
         locked_by = p_agent,
         assigned_to = COALESCE(assigned_to, p_agent)
   WHERE task_id = p_task_id
     AND status = 'pending';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

COMMENT ON TABLE agent_tasks IS
  'Task Registry canônico. Toda delegação entre agentes é registrada aqui. Art. IV — Rastreabilidade Total.';
