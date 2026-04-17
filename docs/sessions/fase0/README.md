# Fase 0 — Briefings Individuais das Sessões Paralelas

**Plano consolidado:** [`PLANO-FASE0-PARALELO.md`](./PLANO-FASE0-PARALELO.md)
**Modo escolhido:** 🔴 Máximo (6 sessões paralelas por dia)
**Duração:** 4 dias corridos

---

## Mapa das 18 sessões

### Dia 1 — Fundação (6 paralelas)

| # | Briefing | Slot | Entregável |
|---|---|---|---|
| S01 | [Hooks](./S01-hooks.md) | 1 | `@ecossistema/constitutional-hooks` (11 hooks) |
| S02 | [Assembler](./S02-assembler.md) | 2 | `@ecossistema/prompt-assembler` (Phantom 9-layer) |
| S03 | [MCP Template](./S03-mcp-template.md) | 3 | FastMCP scaffold + generator CLI |
| S04 ⭐ | [Migrations](./S04-migrations.md) | 4 | **Slot DB dia 1** — 4 migrations ECOSYSTEM |
| S05 | [LiteLLM](./S05-litellm.md) | 5 | Proxy Railway + 6 virtual keys |
| S06 | [ADRs + Runbooks](./S06-docs.md) | 6 | 15 ADRs + 6 runbooks |

### Dia 2 — Serviços (6 paralelas)

| # | Briefing | Slot | Entregável |
|---|---|---|---|
| S07 | [Memory](./S07-memory.md) | 1 | `@ecossistema/memory` (Mem0 wrapper + 3-tier) |
| S08 ⭐ | [Edge Functions](./S08-edge-functions.md) | 2 | **Slot EF dia 2** — 5 EFs (SC-29 v2, SC-10, SC-19, SC-04, SC-03) |
| S09 | [Langfuse](./S09-langfuse.md) | 3 | Self-host Railway + Postgres + ClickHouse |
| S10 | [Orchestrator](./S10-orchestrator.md) | 4 | FastAPI expondo Managed Agents |
| S11 | [C-Suite Templates](./S11-csuite.md) | 5 | Templates CEO, CFO, D-Gov + generator |
| S12 | [Magic Link Vault](./S12-vault.md) | 6 | AES-256-GCM + Next.js form |

### Dia 3 — Integrações (4 paralelas)

| # | Briefing | Slot | Entregável |
|---|---|---|---|
| S13 | [Clients](./S13-clients.md) | 1 | credentials + litellm-client + observability |
| S14 | [Consolidator](./S14-consolidator.md) | 2 | Railway worker sleeptime |
| S15 | [Testes + CI](./S15-tests.md) | 3 | GitHub workflows + E2E + coverage |
| S16 | [Piloto CFO-FIC](./S16-piloto-cfo-fic.md) | 4 | Agente real + 5 tools + sandbox |

### Dia 4 — Validação (2 paralelas)

| # | Briefing | Slot | Entregável |
|---|---|---|---|
| S17 | [Validação E2E](./S17-validacao-e2e.md) | 1 | 10 spec files + relatórios |
| S18 | [Briefing Marcelo](./S18-briefing.md) | 2 | Apresentação + demo ao vivo |

---

## Como abrir as sessões (Dia 1)

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo

# Cria 6 worktrees para hoje
for name in hooks assembler mcp-template migrations-d1 litellm docs-d1; do
  git worktree add ../eco-$name feature/$name
done

# Terminal 1 (S01 — Hooks):
cd ../eco-hooks && claude
# Quando abrir: "Leia docs/sessions/fase0/S01-hooks.md e execute"

# Terminal 2 (S02 — Assembler):
cd ../eco-assembler && claude

# ... e assim por diante até Terminal 6
```

Cada sessão deve, ao iniciar:
1. Ler CLAUDE.md (raiz do monorepo) + MEMORY.md
2. Ler seu briefing (`docs/sessions/fase0/S{N}-*.md`)
3. Ler leituras obrigatórias listadas no briefing
4. Lock task no `agent_tasks` (ou registro local se tabela ainda não criada)
5. Trabalhar no escopo
6. Ao fim do dia: commit + push + PR

---

## Ordem de handoffs críticos

```
Dia 1 → Dia 2:
  S04 (Migrations) ─────────────→ S07 (Memory), S08 (Edge Functions)
  S01 (Hooks)      ─────────────→ S10 (Orchestrator), S11 (C-Suite)
  S02 (Assembler)  ─────────────→ S11 (C-Suite)
  S05 (LiteLLM)    ─────────────→ S09 (Langfuse callback), S10

Dia 2 → Dia 3:
  S07 (Memory)     ─────────────→ S14 (Consolidator), S16 (Piloto)
  S08 (Edge Funcs) ─────────────→ S13 (Clients), S16 (Piloto)
  S09 (Langfuse)   ─────────────→ S13 (Clients observability)
  S10 (Orchestr.)  ─────────────→ S16 (Piloto)
  S11 (Templates)  ─────────────→ S16 (Piloto)

Dia 3 → Dia 4:
  TUDO ────────────────────────→ S17 (Validação E2E)
  S17 (Relatórios) ────────────→ S18 (Briefing Marcelo)
```

---

## Regras canônicas (não viole)

1. **Um worktree por sessão** — nunca 2 sessões no mesmo diretório
2. **Escopo exato** — cada sessão toca só em seus packages/files conforme briefing
3. **Migrations em slots** — S04 dia 1, S17 pode precisar mini-migration dia 4
4. **Edge Functions em slots** — S08 dia 2; outras EFs em dias seguintes
5. **Deploy serial** — merges em main via PR + CI green
6. **Sync diário** — commit + push + PR ao final do dia
7. **Cardinal Rule** — TypeScript/Python é encanamento, Agent SDK é cérebro. Proibido `detectIntent()`, `classifyXxx()`.
8. **Dual-Write** — nada crítico em `.md` local (Art. XIV)
9. **Credenciais via SC-29** — nunca env vars em agent code de prod
10. **Hooks constitucionais ativos** em todos os agentes novos

---

## Tracking de progresso

Cada sessão atualiza `agent_tasks` (Supabase ECOSYSTEM) com:

```sql
insert into agent_tasks (task_id, assigned_to, status, started_at, progress_pct)
values ('S01-hooks', 'session_1', 'in_progress', now(), 0);

-- Durante o dia, update progress
update agent_tasks set progress_pct = 50 where task_id = 'S01-hooks';

-- Ao fim
update agent_tasks set status = 'done', ended_at = now(), progress_pct = 100 where task_id = 'S01-hooks';
```

Dashboard: `SELECT * FROM cockpit.fase0_progress;` mostra status em tempo real.

---

## Critério de fechamento da Fase 0

Todos marcados em `PLANO-FASE0-PARALELO.md § Critério de fechamento`:

- [ ] 9 packages publicados
- [ ] 5 Edge Functions em produção
- [ ] 4 serviços Railway saudáveis
- [ ] 4 migrations aplicadas
- [ ] 15 ADRs + 6 runbooks
- [ ] CFO-FIC piloto executando dry-run E2E
- [ ] CI green + deploy automatizado
- [ ] Briefing Marcelo apresentado

---

**Boa jornada. 4 dias. 18 sessões. Fundação completa.**
