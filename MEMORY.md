# MEMORY.md — Índice Canônico de Memória (V4)

> **Atualizado:** 2026-04-17 (S01 Fase 0 entregue — constitutional-hooks)
> **Status:** Monorepo consolidado + Vercel migrado. Produção operacional. Fase 0 em execução.

## Estado atual

Monorepo `mfalcao09/ecossistema-monorepo` é a **fonte única de verdade**.
Todos os deploys Vercel agora puxam deste repo.

### Repos GitHub
| Repo | Status |
|---|---|
| `mfalcao09/ecossistema-monorepo` | ✅ ATIVO — fonte canônica |
| `mfalcao09/Ecossistema` | 📦 ARQUIVADO |
| `mfalcao09/diploma-digital` | ⏳ Arquivar após burn-in 48h |
| `mfalcao09/intentus-plataform` | ⏳ Arquivar após burn-in 48h |

### Vercel — produção migrada
| Projeto Vercel | Root Directory | Domínios | Status |
|---|---|---|---|
| `intentus-plataform` | `apps/intentus` | `intentusrealestate.com.br` | ✅ Ready |
| `diploma-digital` | `apps/erp-educacional` | `gestao.ficcassilandia.com.br` + `diploma.ficcassilandia.com.br` | ✅ Ready |

### Serviços independentes (não afetados pela migração)
| Serviço | Plataforma | Status |
|---|---|---|
| 133 Edge Functions Intentus | Supabase `bvryaopfjiyxjgsuhjsb` | ✅ Ativas |
| RAG-engine | Railway | ✅ Rodando |
| Claudinho + C-Suite | Anthropic Managed Agents | ✅ API |

## Decisões canônicas V4

1. **D1** — Managed Agents + Railway híbrido
2. **D2** — ECOSYSTEM compartilhado + DBs per-projeto
3. **D3** — Jarvis em 4 estágios (CLI → WhatsApp → Voz → Always-on)
4. **D4** — Scheduled tasks: pg_cron + Trigger.dev
5. **D5** — Monorepo pnpm workspaces (este repo)
6. **D6** — Piloto: ERP-Educacional (Intentus = template técnico)

## Supabase
- **ECOSYSTEM** `gqckbunsfjgerbuiyzvn` — compartilhado
- **ERP-FIC** `ifdnjieklngcfodmtied` — 107 tabelas
- **Intentus** `bvryaopfjiyxjgsuhjsb` — 133 Edge Functions

## Próximas ações
1. Validar domínios em produção (gestao + diploma + intentus)
2. Verificar 7 crons do ERP em Settings → Cron Jobs
3. Burn-in 48h → arquivar diploma-digital e intentus-plataform
4. Abrir 4 sessões paralelas do V4 (briefings em docs/sessions/)
5. Rotacionar secrets encontrados durante migração

## Fase 0 — Status de execução

| Sessão | Status | PR | Notas |
|---|---|---|---|
| **S01** — Constitutional Hooks | ✅ Entregue 2026-04-17 | #3 | Pacote `@ecossistema/constitutional-hooks`, 11 hooks, 70 testes, 93% coverage |
| S02-S18 | ⏳ Pendentes | — | Ver `docs/sessions/fase0/` |

### Convenções canônicas confirmadas na S01

- **Estrutura de packages: FLAT.** `pnpm-workspace.yaml` mapeia `packages/*`, então pacotes ficam em `packages/<nome>/` (não `packages/@ecossistema/<nome>/`). O `name` no package.json continua `@ecossistema/<nome>`.
- **Import paths em TS:** usar `./foo.js` (ESM + NodeNext), não `./foo`.
- **Testes com vitest** + override via `setSupabaseClient(mock)` / `setLiteLLMClient(mock)` pra evitar dependência de DB real na CI.

### Decisões técnicas novas (pós-S01)

- **Art. XIX blocklist:** regex `dd` endurecida vs briefing literal. Forma canônica: `/\bdd\b[^;|&\n]*\bof=\/dev\//` (captura `dd if=X of=/dev/Y`). Motivo: forma literal do briefing não pegava o padrão mais comum de ataque.
- **Art. XII fail-closed:** se consulta ao LiteLLM falha, hook BLOQUEIA (custo > inconveniência). Art. IV fail-soft: audit log não bloqueia agente.
- **Art. XXII stub:** `console.log` com `TODO(S7)` — trocar por `memory.add()` quando S7 entregar `@ecossistema/memory`.

### Bloqueios conhecidos pra ativar hooks em produção

1. **S04 (migrations)** precisa criar no Supabase ECOSYSTEM:
   - `approval_requests` (Art. II)
   - `audit_log` (Art. IV, append-only, trigger contra UPDATE/DELETE)
   - `idempotency_cache` (Art. III, com `created_at` indexado)
2. **S07 (memory)** precisa entregar `@ecossistema/memory` com método `add()`.
3. **S16 (piloto CFO-FIC)** é o primeiro teste real — não ativar em outros agentes antes.

### Ambiente dev confirmado

- `pnpm` não está instalado globalmente. Usar `npx --yes pnpm@9.0.0 <cmd>` ou `corepack enable` (precisa sudo).
- Node v24.14.0 disponível.

## Regra "salva contexto"
Se Marcelo digitar `salva contexto` ou `vou encerrar`:
1. Parar trabalho
2. Atualizar este MEMORY.md
3. Commit + push
