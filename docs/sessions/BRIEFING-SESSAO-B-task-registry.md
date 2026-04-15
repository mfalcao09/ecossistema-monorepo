# BRIEFING — Sessão B · Task Registry

> **Para copiar e colar no início da sua sessão Claude Code**
> **Worktree:** `../eco-B` · **Branch:** `feature/B-task-registry`
> **Duração estimada:** 2-3 dias · **Dependências:** nenhuma · **Prioridade:** P0

---

## Missão

Criar o package `@ecossistema/task-registry` e a tabela `agent_tasks` no Supabase ECOSYSTEM. Isso permite que Marcelo e qualquer agente saibam o que está sendo feito, por quem, em que estado — com locks otimistas para evitar dois agentes pegando a mesma task.

## Por que é crítica

Hoje quando Marcelo delega algo ao Buchecha ou DeepSeek e a conversa fecha, o trabalho some. Sem Task Registry, não há auditoria de delegações nem coordenação entre sessões paralelas. Sem ele, as 4 sessões Code entram em colisão.

## Leituras obrigatórias

1. `CLAUDE.md` e `MEMORY.md` na raiz
2. `docs/masterplans/PLANO-EXECUCAO-V4.md` seções 1, 2, 4
3. `docs/adr/001-parallelism.md` (você vai IMPLEMENTAR o "lock otimista" que o ADR prevê)
4. `docs/analises/ANALISE-CONSOLIDADA-V3.md` seção que descreve o DDL proposto

## Escopo preciso

**Pode mexer:**
- `packages/task-registry/**`
- `infra/supabase/migrations/*agent_tasks*.sql`
- `docs/sessions/LOG-SESSAO-B-YYYYMMDD.md`

**NÃO pode mexer:**
- `packages/memory/**` (Sessão A)
- `apps/orchestrator/**` (Sessão C)
- `packages/billing/**` (Sessão D)

## Entregas

### E1. Migration `agent_tasks`
```sql
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT UNIQUE NOT NULL,              -- T-042, T-043, …
  parent_task_id TEXT,                       -- para sub-tasks
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT,                                -- o prompt original delegado
  assigned_to TEXT,                           -- claudinho, cfo_ia, buchecha, session_A
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','locked','running','completed','failed','blocked','cancelled')),
  priority INT DEFAULT 0,                     -- 0=normal, 1=alta, 2=crítica
  project TEXT,                               -- ecosystem, erp-fic, intentus
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  input JSONB,
  output JSONB,
  error TEXT,
  session_id TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_assigned ON agent_tasks(assigned_to);
CREATE INDEX idx_agent_tasks_project ON agent_tasks(project);
CREATE INDEX idx_agent_tasks_parent ON agent_tasks(parent_task_id);

-- RLS
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
-- Policies: TBD com SC-29 (começar com service-role only)

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
```

### E2. Function SQL `acquire_task_lock(task_id, agent)`
Lock otimista — atualiza status='locked' só se ainda estava 'pending'. Retorna boolean.

### E3. Package `@ecossistema/task-registry` (TypeScript)
API:
```ts
createTask({ title, description, prompt, assignedTo, project, tags, priority })
acquireLock(taskId, agent): Promise<boolean>
updateStatus(taskId, status, { output?, error? })
listPending({ project?, assignedTo? })
getTask(taskId)
listByStatus(status)
```

### E4. Teste de concorrência
Script que tenta `acquireLock` em paralelo com 5 "agentes fake" — só 1 deve obter lock. Demonstra que as 4 sessões Code não colidem.

### E5. Seed inicial das tasks da Fase 0
Popular a tabela com as tasks 0.1.1 a 0.2.6 do `PLANO-EXECUCAO-V4.md` seção 4, para que as outras sessões possam marcar progresso.

## Critério de aceite final

Abrir duas sessões diferentes, ambas tentam `acquireLock('T-042', 'session_A')` e `acquireLock('T-042', 'session_B')` simultaneamente — só uma consegue. A outra vê o lock e pega outra task.

## Dependência conhecida

Sessão C (orchestrator) vai consumir este package para listar tasks pendentes. Seu deliverable precisa estar **importável como `import { createTask } from '@ecossistema/task-registry'`** até o fim do dia 3.

## Protocolo de encerramento

1. `docs/sessions/LOG-SESSAO-B-YYYYMMDD.md` com progresso
2. `MEMORY.md` atualizado
3. Commit + push `feature/B-task-registry`
4. PR quando estável
