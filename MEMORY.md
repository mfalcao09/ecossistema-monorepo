# MEMORY.md — Índice Canônico de Memória

> **Atualizado:** 2026-04-16 (pós-V9 aprovada + plano Fase 0)
> **Status:** V9 é documento canônico ativo; Fase 0 pronta para execução em 18 sessões paralelas

---

## Estado atual

Monorepo `mfalcao09/ecossistema-monorepo` é a fonte única de verdade.
V9 aprovada por Marcelo. 18 briefings prontos para execução em paralelo.

### Produção operacional
- ERP-Educacional (gestao + diploma FIC) via Vercel ✅
- Intentus via Vercel ✅
- 133 Edge Functions Intentus Supabase ✅
- RAG-engine Railway ✅

### Documentos canônicos
| Nível | Arquivo |
|---|---|
| **Masterplan ativo** | `docs/masterplans/MASTERPLAN-V9.md` |
| **V8.2 (base herdada)** | `docs/masterplans/MASTERPLAN-ECOSSISTEMA-v8.2.md` |
| **Plano tático** | `docs/masterplans/PLANO-EXECUCAO-V4.md` |
| **Plano Fase 0** | `docs/sessions/fase0/PLANO-FASE0-PARALELO.md` |
| **Briefings (18)** | `docs/sessions/fase0/S01-*.md` ... `S18-*.md` |
| **Research** | `docs/research/CONSOLIDADO-FINDINGS-2026-04-15.md` |

---

## Decisões canônicas (não reverter sem conversar com Marcelo)

### V9 (2026-04-16)
1. **Herança preservada** — 22 Artigos + 13 MPs + 29 SCs + 17 Ondas + 7 Camadas + Dual-Write + ECOSYSTEM+per-projeto + Fase B + 5 Negócios + D1-D6 do V4
2. **4 camadas técnicas de execução** (L1 Agentes / L2 Railway / L3 EFs / L4 Dados)
3. **C-Suite per negócio** + 6 Diretores de Área no ecossistema (~30-35 agentes total)
4. **22 Artigos como hooks** (11 executáveis + 11 diretrizes)
5. **SC-29 Edge Function** (não agente LLM) — Modo B proxy em produção
6. **10 padrões roubados** validados em código (phantom, Mem0, Letta, FastMCP, LiteLLM, Langfuse, pipecat, LiveKit)
7. **Stack técnica** confirmada com licenças verificadas
8. **Descartados:** 6 Meta-Padrões V7 (Nexus/Mesh/Autonomous Orchestration) — narrativas ficcionais

### V4 (2026-04-15) — mantidas
- D1 Managed Agents + Railway híbrido
- D2 ECOSYSTEM compartilhado + DBs per-projeto
- D3 Jarvis em 4 estágios (CLI → WhatsApp → Voz → Always-on)
- D4 pg_cron + Trigger.dev
- D5 Monorepo pnpm workspaces
- D6 Piloto ERP-Educacional

---

## Supabase

- **ECOSYSTEM** `gqckbunsfjgerbuiyzvn` — compartilhado
- **ERP-FIC** `ifdnjieklngcfodmtied` — 107 tabelas, 7797 audit logs
- **Intentus** `bvryaopfjiyxjgsuhjsb` — 133 Edge Functions

---

## Próximas ações imediatas (Marcelo)

1. Abrir 6 worktrees do Dia 1:
   ```bash
   for name in hooks assembler mcp-template migrations-d1 litellm docs-d1; do
     git worktree add ../eco-$name feature/$name
   done
   ```

2. Abrir 6 terminais paralelos com Claude Code (cada um em seu worktree)
3. Primeiro prompt em cada: "Leia CLAUDE.md, MEMORY.md, V9 e briefing S0N. Execute."
4. Fim do Dia 1: revisar 6 PRs + merge

---

## Regras operacionais (paralelismo)

1. Um worktree por sessão
2. Escopo exato por briefing — sem sobreposição
3. Migrations em slot único por dia por DB (S04 hoje)
4. Edge Functions em slot único por dia (S08 amanhã)
5. Deploy serial via PR + CI green
6. Sync diário: commit + push + PR
7. Cardinal Rule: TypeScript/Python é encanamento, Agent SDK é cérebro

---

## Regra "salva contexto"

Se Marcelo digitar `salva contexto` ou `vou encerrar`:
1. Parar trabalho
2. Atualizar MEMORY.md + criar log em `docs/sessions/logs/LOG-YYYY-MM-DD-*.md`
3. Commit + push

---

## Logs de sessões anteriores
- `docs/sessions/logs/LOG-2026-04-15-consolidacao-monorepo.md`
- `docs/sessions/logs/LOG-2026-04-15-contexto-pre-masterplan.md`
- `docs/sessions/logs/LOG-2026-04-16-v9-e-plano-fase0.md` (este)

