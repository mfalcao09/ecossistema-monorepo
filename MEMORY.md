# MEMORY.md — Índice Canônico de Memória

> **Atualizado:** 2026-04-19 (F1-S01 Jarvis Routing + decisão arquitetural Jarvis)
> **Status:** V9 canônica ativa · Fase 0 MERGEADA · **Fase 1 iniciada** — F1-S01 em PR #25

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
| **Pendências (todas sessões)** | `docs/sessions/PENDENCIAS.md` |
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
| **S01** | Constitutional Hooks | ✅ Merged | #3 | 11 hooks, 70 testes, 93% cov |
| **S02** | Prompt Assembler (Phantom 9-layer) | ✅ Merged | #10 | 9 layers + templates CEO/CFO/D-Gov + testes por layer |
| **S03** | FastMCP Template | ✅ Merged | #2 | 27 testes, generator E2E, Railway deploy |
| **S04** | Migrations V9 D1 | ✅ Merged | #4 | memory 3-tier + creds v2 + skills + audit; aplicado em ECOSYSTEM |
| **S05** | LiteLLM proxy | ✅ Merged | #1 | Scaffold + deploy Railway via OpenRouter |
| **S06** | ADRs + Runbooks | ✅ Merged | #5 | 15 ADRs (001-015) + 6 runbooks; ADR-001 legado renumerado como ADR-016 |
| **S07** | Memory package | ✅ Merged | #7 | v0.2.0 Mem0 + pgvector + hybrid retrieval + composição TS do orquestrador |
| **S08** | 5 Edge Functions D2 | ✅ Merged | #6 | SC-29 v2 + SC-10 + SC-19 + SC-04 + SC-03 |
| **S09** | Langfuse self-host | ✅ Merged | #8 | PG + ClickHouse + Redis + MinIO; 4 fixes runtime |
| **S10** | Orchestrator FastAPI | ✅ Merged | #11 | SSE + HITL + session resumption + 4 test modules |
| **S11** | C-Suite Templates | ✅ Merged | #9 | 4 templates + generator CLI + CFO-FIC instanciado (path corrigido pós-merge, ver saneamento) |
| **S14** | Memory Consolidator Worker | ✅ Pronto para PR | — | Railway worker sleeptime: extract+dedupe+decay+detect+briefing; 39 testes, 81.6% cov; migration 20260418000000 |
| S12–S13, S15–S18 | — | ⏳ Pronto para abrir | — | Pré-requisitos todos verdes |

### Saneamento pós-drenagem (2026-04-17)

- **S11 estava em `packages/@ecossistema/c-suite-templates/`** (fora do workspace) — movido para `packages/c-suite-templates/` + `pnpm install` validado. `pnpm -r list` confirma que `@ecossistema/c-suite-templates@0.1.0` está registrado no workspace.
- **9 briefings + masterplan** tinham o path antigo no escopo literal — corrigidos para convenção FLAT (`packages/<nome>/`). Logs históricos (`docs/sessions/logs/LOG-*.md`) mantidos como evidência.
- **CI verde** em main (Vercel intentus + diploma-digital) após todos os merges.

### ADRs canônicos publicados (S06)

| # | ADR | Referência V9 |
|---|---|---|
| 001 | Managed Agents como runtime primário | § Parte I §6 D1 |
| 002 | Monorepo com pnpm workspaces | § Parte XII |
| 003 | Supabase ECOSYSTEM + DBs per-projeto | § Parte XI §39 |
| 004 | LiteLLM como gateway único | § Parte VIII §33 |
| 005 | Langfuse self-host para observability | § Parte IX §34 |
| 006 | FastMCP v3 como framework MCP | § Parte VIII §30 |
| 007 | Mem0 v3 + pgvector 3-tier | § Parte VIII §27 §32 |
| 008 | SC-29 como Edge Function determinística | § Parte VII |
| 009 | 22 Artigos como hooks executáveis | § Parte V §11 |
| 010 | C-Suite per negócio + 6 Diretores de Área | § Parte VI §14-§18 |
| 011 | Jarvis 4-stage — pipecat + LiveKit | § Parte X |
| 012 | Stack BR canônica | § Parte IX §37 |
| 013 | Phantom 9-layer prompt assembler | § Parte VIII §24 |
| 014 | Mem0 v3 ADD-only como algoritmo | § Parte VIII §27 |
| 015 | Cardinal Rule — código é encanamento | § Parte VIII §25 |
| 016 | Protocolo de sessões paralelas (ex-ADR-001) | § Parte XIV §44 |

### Runbooks operacionais publicados (S06)

- `docs/runbooks/01-rotacao-credenciais-sc29.md`
- `docs/runbooks/02-adicionar-novo-negocio-ecossistema.md`
- `docs/runbooks/03-deploy-nova-edge-function.md`
- `docs/runbooks/04-aplicar-migration-ecosystem.md`
- `docs/runbooks/05-resposta-incidente-dinfra-sc27.md`
- `docs/runbooks/06-rollback-prompt-version-managed-agents.md`

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

### Convenções canônicas de deploy Railway (para MCP servers e outros containers Python do ecossistema)

1. **Dockerfile + `pyproject.toml` com `readme = "README.md"`** — sempre `COPY pyproject.toml README.md ./` nos stages onde pip roda; Hatchling valida a existência do arquivo ao gerar metadata, senão `OSError: Readme file does not exist`.
2. **Bind em `0.0.0.0`, não `127.0.0.1`** — FastMCP/Uvicorn default é loopback; em container o healthcheck externo falha com "service unavailable". Config deve ter `host: str = "0.0.0.0"`.
3. **Healthcheck HTTP → TCP em servers que exigem auth** — MCP server rejeita `GET /mcp` sem Authorization com 401, e healthcheck HTTP do Railway não manda headers. Solução: omitir `healthcheckPath` no `railway.json` (TCP check). Alternativa para o futuro: rota custom `/health` via `@mcp.custom_route` que bypass auth.
4. **Build defensivo pra `cryptography` + `hiredis`** — adicionar no `Dockerfile` `apt-get install build-essential gcc libssl-dev libffi-dev pkg-config cargo python3-dev`. Wheels manylinux cobrem 99% dos casos, mas quando não cobrem o build from source precisa dos compiladores. Multi-stage garante que runtime não carrega o peso.
5. **Pin `pip<26` temporariamente** — pip 26.x (recém-lançado) pode ter resolver novo conflitando com pins. Ecossistema valida eventualmente; até lá fixa no 25.
6. **Railway CLI 4.38 — `railway variables --set "CHAVE=valor"`** para set. **Remoção via dashboard** (deleção programática mudou de sintaxe entre versões; dashboard é mais seguro).

### Armadilha canônica — vars no projeto errado

Cada worktree/pasta tem seu próprio `.railway/` com o link do projeto. `railway variables` ou `railway up` **usam o link da CWD atual**. Em monorepos com múltiplos services Railway (LiteLLM, MCP servers, etc.), é trivial setar var no service errado.

**Regra:** antes de QUALQUER `railway variables` ou `railway up`, rodar `railway status` e confirmar a linha `Project:` + `Service:`. Se tiver dúvida: `railway unlink && railway link` no projeto certo antes de prosseguir.

### Deploys Railway do S3

- **`ecossistema-mcp-template`** (projeto novo criado pelo S3):
  - URL: https://ecossistema-mcp-template-production.up.railway.app
  - Service: `ecossistema-mcp-template`
  - Vars: `MCP_SUPABASE_URL`, `MCP_SUPABASE_ANON_KEY`, `MCP_OWNER_TOKEN_HASH`, `MCP_LOG_LEVEL`
  - Endpoint MCP: `/mcp` (Streamable HTTP)
  - Auth: MultiAuth (owner token `owner_*` + Supabase JWT)

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

## Fase 1 — Status de execução

| Sessão | Título | Status | PR | Notas |
|---|---|---|---|---|
| **F1-S01** | Jarvis WA Routing — inbound/outbound + HITL | ✅ Em PR | #25 | 19/19 testes · approval_requests Supabase ✅ · P-009/P-010 abertas |
| F1-S02 | jarvis-app — Expo + Action Button + voz | ⏳ Próxima | — | iPhone 15 Pro Max · Evolution API backend |

### Decisão arquitetural Jarvis (2026-04-19) — NÃO REVERTER

**Jarvis não é um número WABA próprio.** É um assistente "Siri-like" que habita o iPhone do Marcelo.

- **Evolution API** (Railway, linked device QR) lê o WhatsApp pessoal do Marcelo
- **jarvis-app** (Expo + módulo Swift nativo) roda no iPhone 15 Pro Max
- **Action Button** → abre Jarvis em modo voz (sem "Hey Siri")
- **App Intents** → Apple Intelligence aprende a chamar Jarvis em contexto (iPhone 15 Pro Max tem suporte)
- **Canal HITL F1-S01** (número WABA) → substituído por push APNs quando jarvis-app estiver pronto

### Supabase ECOSYSTEM — migrações F1 aplicadas

| Migration | Status | Data |
|---|---|---|
| `approval_requests` | ✅ Aplicada via MCP | 2026-04-19 |

---

## Logs de sessões anteriores
- `docs/sessions/logs/LOG-2026-04-15-consolidacao-monorepo.md`
- `docs/sessions/logs/LOG-2026-04-15-contexto-pre-masterplan.md`
- `docs/sessions/logs/LOG-2026-04-16-v9-e-plano-fase0.md`
- `docs/sessions/logs/LOG-2026-04-17-s3-mcp-template.md`
- `docs/sessions/logs/LOG-2026-04-19-F1-S01-jarvis-routing.md`
- `docs/sessions/logs/LOG-2026-04-21-s6-cargos-permissoes.md` — Atendimento S6: cargos + permissões granulares (PR #45, 5 commits, ~3.6k linhas)
