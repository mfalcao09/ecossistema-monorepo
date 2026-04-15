# ADR 001 — Protocolo de Sessões Code Paralelas

> **Status:** Aprovado · **Data:** 2026-04-15 · **Contexto:** PLANO-EXECUCAO-V4 Fase 0

## Problema

Marcelo vai abrir até 4 sessões Claude Code em paralelo para acelerar a Fase 0. Sem protocolo, isso causa:
- Conflitos de git (mesmas branches, overwrite)
- Conflitos de migration Supabase (duas sessões aplicando schema)
- Duplicação de trabalho (duas sessões pegam a mesma tarefa)
- Overwrite de memória (duas sessões gravam decisões conflitantes)

## Decisão

Adotar protocolo de paralelismo baseado em **5 regras** explícitas. Toda sessão deve respeitar as 5.

### Regra 1 — Um git worktree por sessão

Antes de começar, a sessão cria seu worktree:

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git worktree add ../eco-A feature/A-memory
git worktree add ../eco-B feature/B-task-registry
git worktree add ../eco-C feature/C-orchestrator
git worktree add ../eco-D feature/D-billing
```

Cada sessão Claude Code deve ser aberta em uma dessas pastas (`../eco-A`, etc.), **nunca no monorepo principal**.

### Regra 2 — Escopo por package/app, não sobreposto

| Sessão | Escopo único | Pode mexer em |
|---|---|---|
| **A** | Memória online | `packages/memory/**`, `infra/supabase/migrations/*memory*.sql` |
| **B** | Task Registry | `packages/task-registry/**`, `infra/supabase/migrations/*agent_tasks*.sql` |
| **C** | Orchestrator | `apps/orchestrator/**`, `infra/railway/orchestrator.*` |
| **D** | Billing + webhook Inter | `packages/billing/**`, arquivos do ERP relacionados a `/api/financeiro/*` |

Arquivos compartilhados (`MEMORY.md`, `CLAUDE.md`, `README.md`, `docs/adr/*`): qualquer sessão pode editar, mas **apenas via PR** — nunca commit direto em main.

### Regra 3 — Lock via Task Registry (assim que B ficar pronto)

Até a Sessão B entregar `@ecossistema/task-registry`, use protocolo manual:
- Cada sessão atualiza `docs/sessions/LOG-SESSAO-<X>-YYYYMMDD.md` ao começar
- Campo "working_on" declara o que está fazendo

Depois que B ficar pronto:
```sql
UPDATE agent_tasks
   SET status = 'locked', assigned_to = 'session_A', locked_at = NOW()
 WHERE task_id = 'T-042'
   AND status = 'pending';
-- Se affected_rows = 0, outra sessão pegou — escolha outra task
```

### Regra 4 — Merges sempre via Pull Request + CI green

- **Proibido:** `git push origin main` direto
- **Obrigatório:** branch feature → PR → CI verde → squash merge em main
- **Nunca** `git push --force` em `main`
- Code review pode ser pedido ao Claudinho em outra sessão ou ao próprio Marcelo

### Regra 5 — Supabase migrations = apenas 1 sessão por dia

Migrations em produção (ECOSYSTEM, ERP-FIC, Intentus) são serializadas:
- **Só uma sessão por dia** aplica migrations em prod
- As outras usam **Supabase Branching** (`supabase branches create feature-X`)
- Consolidação no dia seguinte por quem tiver o "slot de migração"

## Sequência recomendada de lançamento (Dia 1-2)

1. **Marcelo:** cria repo GitHub, push inicial
2. **Marcelo:** cria 4 worktrees
3. **Marcelo:** abre 4 sessões Claude Code, cada uma em sua worktree
4. **Cada sessão:** lê seu `docs/sessions/BRIEFING-SESSAO-<X>-*.md`
5. **Cada sessão:** cria seu `docs/sessions/LOG-SESSAO-<X>-YYYYMMDD.md` ao começar
6. **Cada sessão:** trabalha seu escopo; PRs separados

## Matriz de detecção de conflito

Se duas sessões pensam que precisam do mesmo arquivo fora do escopo:
1. A primeira que declarar em `LOG-SESSAO-*.md` vence
2. A segunda pergunta ao Marcelo antes de prosseguir
3. Se Marcelo não estiver disponível: a segunda sessão pausa, deixa um `TODO-HANDOFF.md` e pega outra task

## Convenções de commit

- `feat(memory): add saveMemory() with auto-sync`
- `feat(task-registry): create agent_tasks table`
- `feat(orchestrator): FastAPI skeleton`
- `feat(billing): implement _processar_item_webhook`
- `docs(adr): add ADR-002 on [tema]`
- `chore: ` para tarefas de manutenção
- Todo commit inclui `Co-Authored-By: Claude <noreply@anthropic.com>` ou equivalente ao agente usado

## Consequências

**Positivas:**
- Velocidade 3-4× maior na Fase 0
- Zero conflitos de deploy
- Histórico git limpo (um PR por escopo)
- Memória não colide (cada sessão loga separado)

**Negativas:**
- Marcelo precisa coordenar 4 contextos mentais em paralelo
- Overhead de worktrees (~5min setup)
- Dependências cruzadas (ex.: A precisa de B) exigem ordenação

## Dependências conhecidas entre sessões

- **A (memory)** e **B (task-registry)** são independentes — paralelizáveis
- **C (orchestrator)** depende de A+B existirem → começa no dia 2-3
- **D (billing)** é independente — paralelizável imediatamente

## Revisão

Revisar este ADR ao fim da Sprint 0.1 (semana 1) com base no que funcionou e no que atrapalhou.
