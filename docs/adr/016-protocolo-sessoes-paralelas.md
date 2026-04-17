# ADR-016: Protocolo de sessões Claude Code paralelas

- **Status:** aceito
- **Data:** 2026-04-15
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte XIV §44, PLANO-EXECUCAO-V4 Fase 0, `docs/sessions/fase0/PLANO-FASE0-PARALELO.md`

> Originalmente publicado como ADR-001 em 2026-04-15. Renumerado para ADR-016 em 2026-04-17 para liberar a numeração 001–015 ao pacote canônico de ADRs arquiteturais V9 (ver `docs/adr/README.md`). Conteúdo canônico preservado.

## Contexto e problema

Marcelo abre até 6 sessões Claude Code em paralelo (Fase 0 execução acelerada). Sem protocolo:

- Conflitos de git (mesmas branches, overwrite)
- Conflitos de migration Supabase (duas sessões aplicando schema simultaneamente)
- Duplicação de trabalho (duas sessões pegam a mesma tarefa)
- Overwrite de memória (duas sessões gravam decisões conflitantes)

## Opções consideradas

- **Opção 1:** Nada — deixar livre
- **Opção 2:** Protocolo de 5 regras (worktree + escopo + lock + PR + serial migrations)
- **Opção 3:** Bloquear paralelismo total (serial obrigatório)

## Critérios de decisão

- Velocidade de execução Fase 0 (18 sessões)
- Prevenção de conflitos merge/DB
- Ergonomia para Marcelo (até 6 terminais mentais)

## Decisão

**Escolhemos Opção 2** — protocolo de 5 regras explícitas.

### Regra 1 — Um git worktree por sessão

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
for name in hooks assembler mcp-template migrations-d1 litellm docs-d1; do
  git worktree add ../eco-$name feature/$name
done
```

Cada sessão Claude Code abre em sua pasta (`../eco-hooks`, etc.), **nunca no monorepo principal**.

### Regra 2 — Escopo por package/app, não sobreposto

Cada sessão tem briefing em `docs/sessions/fase0/SNN-<tema>.md` com escopo exato. Arquivos compartilhados (`MEMORY.md`, `CLAUDE.md`, `README.md`, `docs/adr/*`): editar **apenas via PR** — nunca commit direto em main.

### Regra 3 — Lock via Task Registry (assim que S02 ficar pronto)

Até `@ecossistema/task-registry` existir, protocolo manual via `docs/sessions/logs/LOG-SESSAO-*.md` declarando `working_on`.

Depois:
```sql
UPDATE agent_tasks
   SET status='locked', assigned_to='session_A', locked_at=NOW()
 WHERE task_id='T-042' AND status='pending';
-- affected_rows=0 → outra sessão pegou; escolher outra task
```

### Regra 4 — Merges sempre via PR + CI green

- **Proibido:** `git push origin main` direto
- **Obrigatório:** branch feature → PR → CI verde → squash merge em main
- **Nunca** `git push --force` em `main` (Art. XIX hook bloqueia)
- Code review via Claudinho em outra sessão ou Marcelo

### Regra 5 — Supabase migrations serializadas

Migrations em produção (ECOSYSTEM, ERP-FIC, Intentus) são serializadas:
- **Só uma sessão por dia** aplica migrations em prod
- Outras usam **Supabase Branching** (`supabase branches create feature-X`)
- Consolidação no dia seguinte pelo dono do "slot de migração"

## Consequências

### Positivas
- Velocidade 3-4× maior na Fase 0
- Zero conflitos de deploy
- Histórico git limpo (1 PR por escopo)
- Memória não colide (cada sessão loga separado)

### Negativas
- Marcelo coordena N contextos mentais em paralelo
- Overhead de worktrees (~5min setup)
- Dependências cruzadas (ex: S16 precisa S01+S04+S05+S07+S11) exigem ordenação

### Neutras / riscos
- **Risco:** duas sessões pensam que precisam do mesmo arquivo compartilhado. **Mitigação:** primeira a declarar em `LOG-SESSAO-*.md` vence; segunda pausa e pega outra task.
- **Risco:** CI fila longa bloqueia merges. **Mitigação:** rodar lint + unit pre-push local; só integração em CI.

## Dependências conhecidas entre sessões (Fase 0 V9)

- S01 (hooks) e S02 (assembler) independentes — paralelos Dia 1
- S04 (migrations) é slot único do Dia 1
- S06 (docs) independente — paralelo qualquer dia
- S16 (piloto CFO-FIC) depende de S01+S04+S05+S07+S11 — Dia 3+

## Evidência / pesquisa

- MASTERPLAN-V9 § Parte XIV §44
- `docs/sessions/fase0/PLANO-FASE0-PARALELO.md`
- Validação empírica: S01 + S03 executadas com sucesso (2026-04-17) sem conflitos

## Ação de implementação

- `@ecossistema/task-registry` (sessão S02 — depois, Regra 3 passa a usar DB)
- Hook Art. XIX bloqueia `git push --force origin main` automaticamente (✅ S01)
- Atualizar este ADR quando o lock DB entrar em vigor

## Revisão

Revisar ao fim da Fase 0 (~2026-05-15) com base em (a) incidência real de conflitos, (b) produtividade percebida.
