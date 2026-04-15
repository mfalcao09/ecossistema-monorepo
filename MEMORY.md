# MEMORY.md — Índice Canônico de Memória (V4)

> **Atualizado:** 2026-04-15 (pós-consolidação monorepo)
> **Status:** Monorepo criado, código migrado, aguardando push para GitHub

## Estado atual

Monorepo `ecossistema-monorepo` consolidado com TODO o código:
- `apps/orchestrator/` — Claudinho (1541 linhas) + 8 prompts C-Suite
- `apps/erp-educacional/` — Next.js 15 + 7 Vercel Crons + Python APIs (diploma-digital)
- `apps/intentus/` — Vite/React SPA (intentus-plataform)
- `packages/` — memory, billing, task-registry, agentes/skills, rag
- `docs/` — 100+ decisões, sessões, contextos, masterplans, runbooks

### Repos GitHub
| Repo | Status |
|---|---|
| `mfalcao09/ecossistema-monorepo` | ⏳ Criar no GitHub + push |
| `mfalcao09/Ecossistema` | ✅ ARQUIVADO |
| `mfalcao09/diploma-digital` | ⚠️ ATIVO — migrar Vercel antes de arquivar |
| `mfalcao09/intentus-plataform` | ⚠️ ATIVO — migrar Vercel antes de arquivar |

### Serviços em produção
| Serviço | Plataforma | Repo atual |
|---|---|---|
| ERP Next.js + 7 crons | Vercel | diploma-digital |
| Intentus SPA | Vercel | intentus-plataform |
| 133 Edge Functions | Supabase Intentus | N/A (independente) |
| RAG-engine | Railway | N/A (independente) |
| Claudinho + C-Suite | Managed Agents | N/A (API) |

## Decisões canônicas V4 (não reverter sem Marcelo)

1. **D1** — Managed Agents + Railway híbrido
2. **D2** — ECOSYSTEM compartilhado + DBs per-projeto
3. **D3** — Jarvis em 4 estágios (CLI → WhatsApp → Voz → Always-on)
4. **D4** — Scheduled tasks: pg_cron + Trigger.dev
5. **D5** — Monorepo pnpm workspaces (este repo)
6. **D6** — Piloto: ERP-Educacional (Intentus = template técnico)

## Supabase

- **ECOSYSTEM** `gqckbunsfjgerbuiyzvn` — compartilhado
- **ERP-FIC** `ifdnjieklngcfodmtied` — 107 tabelas, 7797 audit logs
- **Intentus** `bvryaopfjiyxjgsuhjsb` — 133 Edge Functions ativas

## Próximas ações

1. Marcelo cria repo GitHub: https://github.com/new → `ecossistema-monorepo` (Private)
2. `cd ecossistema-monorepo && git push -u origin main`
3. Migração Vercel: Intentus primeiro, ERP depois (ver `docs/runbooks/MIGRACAO-VERCEL.md`)
4. Abrir 4 sessões paralelas com briefings em `docs/sessions/`

## Regra "salva contexto"

Se Marcelo digitar `salva contexto` ou `vou encerrar`:
1. Parar trabalho
2. Atualizar este MEMORY.md
3. Commit + push
4. Escrever LOG em docs/sessions/logs/
