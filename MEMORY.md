# MEMORY.md — Índice Canônico de Memória

> **Atualizado:** 2026-04-17 (pós-merge S01 + S3)
> **Status:** V9 canônica ativa · Monorepo + Vercel em produção · Fase 0 em execução — **S01 ✅ + S3 ✅**

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

## Fase 0 — Status de execução

| Sessão | Título | Status | PR | Notas |
|---|---|---|---|---|
| **S01** | Constitutional Hooks | ✅ Entregue 2026-04-17 | #3 | `packages/constitutional-hooks`, 11 hooks, 70 testes, 93% coverage |
| **S3** | FastMCP Template | ✅ Entregue 2026-04-17 | #2 | `packages/mcp-servers/template`, 27 testes, server HTTP sobe, generator E2E |
| S02, S4–S18 | … | ⏳ Pendente | — | Ver `docs/sessions/fase0/` |

### Convenções canônicas confirmadas

- **Estrutura de packages: FLAT.** `pnpm-workspace.yaml` usa `packages/*` (e, para coleções, `packages/<grupo>/*`). Pacotes ficam em `packages/<nome>/` — **não** em `packages/@ecossistema/<nome>/`. O `name` no package.json continua `@ecossistema/<nome>`. *(S01 canonizou; S3 alinhado no merge.)*
- **Import paths em TS:** usar `./foo.js` (ESM + NodeNext), não `./foo`.
- **Testes:** vitest em TS; pytest em Python. Overrides via `setSupabaseClient(mock)` / `setLiteLLMClient(mock)` para isolar CI.

### Decisões técnicas novas (pós-S01)

- **Art. XIX blocklist:** regex `dd` endurecida vs briefing literal. Forma canônica: `/\bdd\b[^;|&\n]*\bof=\/dev\//` (captura `dd if=X of=/dev/Y`). Motivo: forma literal do briefing não pegava o padrão mais comum de ataque.
- **Art. XII fail-closed:** se consulta ao LiteLLM falha, hook BLOQUEIA (custo > inconveniência). Art. IV fail-soft: audit log não bloqueia agente.
- **Art. XXII stub:** `console.log` com `TODO(S7)` — trocar por `memory.add()` quando S7 entregar `@ecossistema/memory`.

### Decisões técnicas novas (pós-S3)

- **FastMCP v3.2.4 é a API real** — briefing usava docs antigas. Convenções confirmadas:
  - `FastMCP(auth=<AuthProvider>, middleware=[...])` no constructor
  - `MultiAuth(verifiers=[...])` combina múltiplos `TokenVerifier`
  - `TokenVerifier.verify_token(token: str) -> AccessToken | None` (retornar `None` se token não é nosso → cadeia tenta próximo verifier)
  - `ToolError(msg)` — Exception simples, sem kwargs; `correlation_id` via `structlog.contextvars`
  - `get_access_token()` de `fastmcp.server.dependencies` dentro de middleware
  - `transport="http"` (não `streamable-http`)
- **Owner token:** prefixo `owner_` obrigatório; sha256 hex comparado com `hmac.compare_digest`.

### Bloqueios conhecidos pra ativar hooks + MCP em produção

1. **S04 (migrations)** precisa criar no Supabase ECOSYSTEM:
   - `approval_requests` (Art. II)
   - `audit_log` (Art. IV, append-only, trigger contra UPDATE/DELETE)
   - `idempotency_cache` (Art. III, com `created_at` indexado)
2. **S07 (memory)** precisa entregar `@ecossistema/memory` com método `add()`.
3. **S08 (Edge Functions)** precisa entregar `credentials-proxy` (SC-29 Modo B) para MCP servers buscarem credenciais em runtime.
4. **S16 (piloto CFO-FIC)** é o primeiro teste real — não ativar em outros agentes antes.

### Ambiente dev confirmado

- `pnpm` global não obrigatório — usar `npx --yes pnpm@9.0.0 <cmd>` ou `corepack enable`. Já há `pnpm 10.33` em `/opt/homebrew/bin/pnpm`.
- **Node v24.14.0** ativo.
- **Python 3.12.13** via `/Users/marcelosilva/.local/bin/python3.12` (uv instalado).
- **Railway CLI 4.38.0** em `/opt/homebrew/bin/railway` (auth depende de sessão).

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
- `docs/sessions/logs/LOG-2026-04-16-v9-e-plano-fase0.md`
- `docs/sessions/logs/LOG-2026-04-17-s3-mcp-template.md`
