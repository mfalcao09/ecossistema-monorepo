# MEMORY.md — Índice Canônico de Memória (V4)

> **Atualizado:** 2026-04-15 (migração Vercel completa)
> **Status:** Monorepo consolidado + Vercel migrado. Produção operacional.

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

## Regra "salva contexto"
Se Marcelo digitar `salva contexto` ou `vou encerrar`:
1. Parar trabalho
2. Atualizar este MEMORY.md
3. Commit + push
