# Plano de Execução da Fase 0 — Sessões Paralelas Máximas

**Versão:** 1.0
**Data:** 2026-04-16
**Base:** MASTERPLAN-V9 (aprovado)
**Objetivo:** esgotar a Fase 0 em 3-4 dias usando até 6 sessões Claude Code em paralelo.

---

## Restrições canônicas

Herdadas do V4 § 44 (mantidas na V9 § 44):

1. **Um worktree por sessão** (`git worktree add ../eco-<nome> feature/<nome>`)
2. **Escopo por package/edge function, nunca sobreposto**
3. **Lock via Task Registry** (`agent_tasks` na ECOSYSTEM) — cada sessão lock na sua task
4. **Deploy sempre serial** — merges em `main` só via PR com CI verde
5. **Sync diário** — cada sessão commita + empurra branch + abre PR no fim do dia
6. **⚠️ Bottleneck crítico: Supabase migrations = 1 sessão por dia** por DB (ECOSYSTEM, ERP-FIC, Intentus)

Essa última regra é o principal limitante do paralelismo. A solução: **concentrar migrations do dia numa única "sessão coordenadora"**, as demais trabalham em código puro (packages/services/Edge Functions sem DDL novo).

---

## Inventário do que falta na Fase 0

### Packages do monorepo (pnpm workspaces)

| Package | Prioridade | Depende de |
|---|---|---|
| `@ecossistema/constitutional-hooks` | P0 | (nenhuma) |
| `@ecossistema/prompt-assembler` | P0 | (nenhuma) |
| `@ecossistema/memory` | P0 | Migrations memory 3-tier |
| `@ecossistema/credentials` | P0 | SC-29 v2 Edge Function |
| `@ecossistema/mcp-servers/template` | P1 | (nenhuma — FastMCP scaffold) |
| `@ecossistema/litellm-client` | P1 | LiteLLM proxy Railway |
| `@ecossistema/observability` | P1 | Langfuse Railway |
| `@ecossistema/c-suite-templates` | P1 | prompt-assembler (lógico) |
| `@ecossistema/skills-registry` | P2 | Migration skills_registry |
| `@ecossistema/magic-link-vault` | P2 | (nenhuma) |

### Edge Functions (Supabase ECOSYSTEM)

| EF | SC | Depende de |
|---|---|---|
| `credential-gateway-v2` | SC-29 v2 | ecosystem_credentials já existe (s094) + ACL upgrade |
| `webhook-hardening` | SC-10 | (nenhuma) |
| `pii-mask` | SC-19 | (nenhuma) |
| `skills-registry-crud` | SC-04 | Migration skills_registry |
| `dual-write-pipeline` | SC-03 | (nenhuma) |
| `retry-backoff-engine` | SC-16 | (nenhuma) |

### Migrations Supabase ECOSYSTEM

| Migration | SC | Prioridade |
|---|---|---|
| `memory_episodic` + `memory_semantic` + `memory_procedural` + índices pgvector | SC-06 v1 | P0 |
| `skills_registry` | SC-04 | P1 |
| `audit_log` consolidado (upgrade V9) | SC-11 | P1 |
| `ecosystem_credentials` ACL upgrade | SC-29 v2 | P0 |

### Serviços Railway

| Serviço | Prioridade | Depende de |
|---|---|---|
| LiteLLM proxy | P0 | Chave Anthropic + OpenAI + etc. |
| Langfuse self-host + ClickHouse | P0 | Postgres + ClickHouse |
| Orchestrator FastAPI | P0 | Managed Agents prontos |
| Memory consolidator worker (sleeptime) | P1 | memory tables + LLM access |

---

## Grafo de Dependências

```
                           ┌─────────────────────────────────────┐
                           │  PURE PACKAGES (sem DB, sem Railway)│
                           │  ✓ constitutional-hooks             │
                           │  ✓ prompt-assembler                 │
                           │  ✓ mcp-servers/template (FastMCP)   │
                           │  ✓ magic-link-vault                 │
                           │  ✓ c-suite-templates (após assembler)│
                           └─────────────────────────────────────┘

                           ┌─────────────────────────────────────┐
                           │  MIGRATIONS DIA 1 (1 sessão coord.) │
                           │  • memory_episodic/semantic/proced. │
                           │  • ecosystem_credentials ACL upgrade│
                           │  • skills_registry                  │
                           │  • audit_log V9 upgrade             │
                           └──────────────┬──────────────────────┘
                                          │
                ┌─────────────────────────┼─────────────────────────┐
                ▼                         ▼                         ▼
    ┌───────────────────┐    ┌────────────────────┐    ┌────────────────────┐
    │ MEMORY package    │    │ CREDENTIALS package│    │ SKILLS-REG package │
    │ (usa 3 tabelas)   │    │ (client SC-29 v2)  │    │ (client SC-04)     │
    └───────────────────┘    └────────────────────┘    └────────────────────┘

                           ┌─────────────────────────────────────┐
                           │  EDGE FUNCTIONS DIA 2               │
                           │  • credential-gateway-v2 (SC-29)    │
                           │  • webhook-hardening (SC-10)        │
                           │  • pii-mask (SC-19)                 │
                           │  • skills-registry-crud (SC-04)     │
                           │  • dual-write-pipeline (SC-03)      │
                           └─────────────────────────────────────┘

                           ┌─────────────────────────────────────┐
                           │  RAILWAY DEPLOYS (independentes)    │
                           │  • LiteLLM proxy                    │
                           │  • Langfuse + ClickHouse            │
                           │  • Orchestrator FastAPI             │
                           │  • Memory consolidator worker       │
                           └──────────────┬──────────────────────┘
                                          │
                                          ▼
                           ┌─────────────────────────────────────┐
                           │  CLIENTS (dependem de deploys)      │
                           │  • litellm-client                   │
                           │  • observability (Langfuse)         │
                           └─────────────────────────────────────┘
```

---

## Matriz de Sessões — 14 sessões em 3 dias

### Dia 1 — 6 sessões paralelas

| # | Sessão | Worktree | Escopo | Bloqueia? |
|---|---|---|---|---|
| 1 | **S1-Hooks** | eco-hooks | `packages/constitutional-hooks/` | não |
| 2 | **S2-Assembler** | eco-assembler | `packages/prompt-assembler/` | não |
| 3 | **S3-MCP-Template** | eco-mcp-template | `packages/mcp-servers/template/` | não |
| 4 | **S4-Migrations** ⭐ | eco-migrations-d1 | `infra/supabase/migrations/20260416*.sql` + runner | **SIM — slot DB do dia** |
| 5 | **S5-LiteLLM** | eco-litellm | `infra/railway/litellm/` (Dockerfile + config) | não |
| 6 | **S6-ADRs** | eco-docs-d1 | `docs/adr/*.md` + `docs/runbooks/*.md` | não |

⭐ S4 é a **sessão coordenadora de migrations do dia** — ninguém mais toca schema hoje.

### Dia 2 — 6 sessões paralelas

| # | Sessão | Worktree | Escopo | Bloqueia? |
|---|---|---|---|---|
| 7 | **S7-Memory** | eco-memory | `packages/memory/` (usa migrations dia 1) | não |
| 8 | **S8-EdgeFunctions** ⭐ | eco-efs-d2 | `infra/supabase/functions/credential-gateway-v2/`, `webhook-hardening/`, `pii-mask/`, `skills-registry-crud/`, `dual-write-pipeline/` | **SIM — slot EF do dia** |
| 9 | **S9-Langfuse** | eco-langfuse | `infra/railway/langfuse/` + ClickHouse | não |
| 10 | **S10-Orchestrator** | eco-orchestrator | `apps/orchestrator/` (FastAPI expondo Managed Agents) | não |
| 11 | **S11-CSuite** | eco-csuite | `packages/c-suite-templates/` (templates CEO + CFO primeiro) | não |
| 12 | **S12-Vault** | eco-vault | `packages/magic-link-vault/` (Phantom pattern) | não |

⭐ S8 concentra todas as EFs novas do dia pra evitar conflito de deploy.

### Dia 3 — 4 sessões paralelas (integrações)

| # | Sessão | Worktree | Escopo |
|---|---|---|---|
| 13 | **S13-Clients** | eco-clients-d3 | `packages/credentials/`, `litellm-client/`, `observability/` |
| 14 | **S14-Consolidator** | eco-consolidator | `apps/memory-consolidator/` (Railway worker sleeptime) |
| 15 | **S15-Testes** | eco-tests-d3 | `packages/*/tests/` + `infra/ci/` (workflows GitHub) |
| 16 | **S16-Piloto-CFO-FIC** | eco-pilot-cfo | `apps/erp-educacional/agents/cfo.ts` (CFO-FIC E2E real) |

### Dia 4 — validação final (1-2 sessões)

| # | Sessão | Objetivo |
|---|---|---|
| 17 | **S17-Validacao-E2E** | Smoke test completo: Marcelo→Jarvis→C-Suite FIC→EF→memory→audit |
| 18 | **S18-Briefing-Marcelo** | Preparar relatório Fase 0 + demo ao vivo |

---

## Visualização do plano em tabela

```
          Dia 1                Dia 2                Dia 3            Dia 4
          ─────                ─────                ─────            ─────
Slot 1: S1-Hooks              S7-Memory            S13-Clients      S17-Validacao-E2E
Slot 2: S2-Assembler          S8-EdgeFunctions⭐   S14-Consolidator S18-Briefing
Slot 3: S3-MCP-Template       S9-Langfuse          S15-Testes
Slot 4: S4-Migrations⭐       S10-Orchestrator     S16-Piloto-CFO
Slot 5: S5-LiteLLM            S11-CSuite
Slot 6: S6-ADRs               S12-Vault

Paralelismo: 6 × 6 × 4 × 2 = 18 sessões totais
```

---

## Briefings individuais

Cada sessão tem briefing próprio em `docs/sessions/fase0/S{N}-{nome}.md`. Abaixo os cabeçalhos, escopos e critérios de sucesso (versão curta).

### S1 — Constitutional Hooks

**Worktree:** `eco-hooks` · **Branch:** `feature/constitutional-hooks`
**Escopo:** criar `packages/constitutional-hooks/` com 11 hooks (Art. II, III, IV, VIII, IX, XII, XIV, XVIII, XIX, XX, XXII) em TypeScript.
**Dependências:** nenhuma.
**Entregáveis:**
- 11 arquivos `art-{roman}.ts` com testes unitários
- `index.ts` exportando todos
- README com exemplos de uso
- 100% cobertura de tests
**Sucesso:** `pnpm --filter @ecossistema/constitutional-hooks test` passa. Import de outro package funciona.

### S2 — Prompt Assembler (Phantom 9-layer)

**Worktree:** `eco-assembler` · **Branch:** `feature/prompt-assembler`
**Escopo:** `packages/prompt-assembler/` implementando o Phantom 9-layer assembler.
**Dependências:** nenhuma.
**Entregáveis:**
- `assemble(agentConfig, queryContext)` função pura
- 9 módulos (identity, env, security, role, onboarding, evolved, memory-instructions, instructions, memory-context)
- Loader YAML para evolved config
- Template base (constitution.md, persona.md, user-profile.md, domain-knowledge.md, strategies/*)
**Sucesso:** recebe config + contexto, devolve system prompt completo testado.

### S3 — FastMCP Template

**Worktree:** `eco-mcp-template` · **Branch:** `feature/mcp-template`
**Escopo:** scaffold base em `packages/mcp-servers/template/` para todos os futuros MCP servers (Python + FastMCP v3).
**Dependências:** nenhuma.
**Entregáveis:**
- Template Python com `@mcp.tool`, `@mcp.resource`, `@mcp.prompt`
- AuthProvider base (Supabase JWT)
- Middleware (logging, rate-limit, tracing)
- FastMCPProxy exemplo para wrap third-party
- Dockerfile pronto pra Railway
- CLI gerador: `pnpm create-mcp-server <name>`
**Sucesso:** gerar novo MCP server com 1 comando e ele roda.

### S4 ⭐ — Migrations Coordenadas (slot DB do Dia 1)

**Worktree:** `eco-migrations-d1` · **Branch:** `feature/migrations-d1`
**Escopo:** aplicar todas as migrations do Dia 1 em ECOSYSTEM.
**Dependências:** nenhuma, mas **trava o slot DB** — ninguém mais aplica migration no dia 1.
**Entregáveis:**
- `infra/supabase/migrations/20260416010000_memory_3tier.sql` (episodic + semantic + procedural + vector índices + RLS)
- `20260416020000_ecosystem_credentials_v2_acl.sql` (ACL + rate_limit)
- `20260416030000_skills_registry.sql`
- `20260416040000_audit_log_v9.sql` (upgrade do audit existente)
- Runner: `scripts/apply-migrations.sh` executado via MCP Supabase
- Rollback scripts em `migrations/rollback/`
**Sucesso:** todas as tabelas criadas, RLS ativo, seed data carregado, ponto de restore documentado.

### S5 — LiteLLM Proxy Deploy

**Worktree:** `eco-litellm` · **Branch:** `feature/litellm-railway`
**Escopo:** deployar LiteLLM proxy no Railway com config multi-provider + virtual keys per-business.
**Dependências:** SC-29 v2 ainda não — usa env vars diretas por ora, migra pra SC-29 depois.
**Entregáveis:**
- `infra/railway/litellm/Dockerfile`
- `litellm_config.yaml` com model_list (Anthropic Sonnet 4.6, Haiku 3.7, GPT-4o-mini, MariTalk Sabiá-4)
- Virtual keys: ecosystem, fic, klesis, intentus, splendori, nexvy
- Budgets mensais em USD por key
- Fallback chains canônicas
- Cooldown + allowed_fails configurados
- Redis cache configurado
- Langfuse callback (aponta pra S9 depois)
- Railway deploy em `litellm.ecossistema.internal`
**Sucesso:** `curl -X POST litellm.../chat/completions` com virtual key retorna resposta Sonnet.

### S6 — ADRs + Runbooks

**Worktree:** `eco-docs-d1` · **Branch:** `feature/docs-d1`
**Escopo:** 15 ADRs canônicos + runbooks operacionais.
**Dependências:** nenhuma, mas lê V9 como base.
**Entregáveis ADRs (`docs/adr/`):**
- ADR-001: Managed Agents como runtime primário
- ADR-002: pnpm workspaces como monorepo
- ADR-003: Supabase ECOSYSTEM + DBs per-projeto (reafirma D2)
- ADR-004: LiteLLM como gateway único
- ADR-005: Langfuse como observability self-host
- ADR-006: FastMCP v3 como framework MCP
- ADR-007: Mem0 v3 + pgvector 3-tier
- ADR-008: SC-29 como Edge Function (não agente LLM)
- ADR-009: 22 Artigos como hooks executáveis
- ADR-010: C-Suite per negócio + 6 Diretores de Área
- ADR-011: Jarvis 4-stage — pipecat + LiveKit Agents
- ADR-012: Stack BR canônica (Chatwoot + Evolution + Documenso + pyHanko + PyNFe + MariTalk)
- ADR-013: Phantom 9-layer prompt assembler como padrão
- ADR-014: Mem0 v3 ADD-only como algoritmo
- ADR-015: Cardinal Rule
**Entregáveis Runbooks (`docs/runbooks/`):**
- Rotação de credenciais (SC-29)
- Adicionar novo negócio ao ecossistema
- Deploy de nova Edge Function
- Aplicar migration em ECOSYSTEM
- Resposta a incidente (D-Infra + SC-27)
- Rollback de prompt version (Managed Agents)
**Sucesso:** PR revisado, todas as ADRs respondem "Por quê?" com evidência da V9.

### S7 — Memory Package

**Worktree:** `eco-memory` · **Branch:** `feature/memory-package`
**Escopo:** `packages/memory/` — wrapper Mem0 v3 + cliente das 3 tabelas pgvector.
**Dependências:** S4 completo (migrations aplicadas).
**Entregáveis:**
- Cliente tipado Mem0 com filters estritos (`user_id`, `agent_id`, `run_id`)
- Funções `add(messages, filters)`, `search(query, filters)`, `recall(query, filters, topK)`
- Hybrid retrieval: dense + BM25 + entity boost + reciprocal rank fusion
- Modo degradado (Qdrant/Mem0 off → no-op silencioso)
- Sleeptime consolidation hook (pra S14 consumir)
- Contradição detection (Phantom pattern)
**Sucesso:** `memory.add()` + `memory.recall()` funcionam E2E com dados reais de Marcelo.

### S8 ⭐ — Edge Functions Coordenadas (slot EF do Dia 2)

**Worktree:** `eco-efs-d2` · **Branch:** `feature/edge-functions-d2`
**Escopo:** 5 Edge Functions novas no ECOSYSTEM.
**Dependências:** S4 (tabelas existem).
**Entregáveis:**
- `functions/credential-gateway-v2/` — SC-29 v2 com Modo A (dev) e Modo B (proxy) + audit log
- `functions/webhook-hardening/` — SC-10 (HMAC validator + rate limit + idempotency)
- `functions/pii-mask/` — SC-19 (regex + denylist)
- `functions/skills-registry-crud/` — SC-04 (CRUD + matching keyword)
- `functions/dual-write-pipeline/` — SC-03 (escrita em 2 stores idempotente)
- Testes de integração pra cada EF
- Deploy via `supabase functions deploy` em produção
**Sucesso:** cada EF responde `curl` com payload válido, audit registra, RLS bloqueia acesso indevido.

### S9 — Langfuse Self-Host

**Worktree:** `eco-langfuse` · **Branch:** `feature/langfuse-railway`
**Escopo:** deployar Langfuse no Railway com Postgres (metadata) + ClickHouse (traces).
**Dependências:** nenhuma (próprio Postgres + ClickHouse no Railway).
**Entregáveis:**
- `infra/railway/langfuse/docker-compose.yml` com web + worker + Postgres + ClickHouse
- Project default: `ecossistema`
- API keys pra todos os negócios
- Callback configurado no LiteLLM (aponta aqui)
- Dashboard com traces já chegando (de S5)
**Sucesso:** uma chamada LiteLLM aparece em `langfuse.ecossistema.internal` com latência, tokens, custo.

### S10 — Orchestrator FastAPI

**Worktree:** `eco-orchestrator` · **Branch:** `feature/orchestrator`
**Escopo:** `apps/orchestrator/` — FastAPI no Railway que expõe Managed Agents via HTTP/SSE.
**Dependências:** Managed Agents API key.
**Entregáveis:**
- Endpoint `/agents/{agent_id}/run` (SSE streaming)
- Endpoint `/agents/{agent_id}/resume` (session resumption)
- Endpoint `/webhooks/status-idled` (HITL pattern da cookbook)
- Integração com LiteLLM (via proxy do S5)
- Hooks constitucionais aplicados em todos os agentes (importa de S1)
- Prompt assembler integrado (importa de S2)
- Dockerfile Railway
**Sucesso:** `POST /agents/cfo-fic/run` com prompt retorna stream SSE funcional.

### S11 — C-Suite Templates (primeiros 2)

**Worktree:** `eco-csuite` · **Branch:** `feature/csuite-templates`
**Escopo:** `packages/c-suite-templates/` — CEO-IA e CFO-IA primeiro.
**Dependências:** S2 (prompt assembler) como base.
**Entregáveis:**
- `CEO-IA/base-prompt.md` + variants/{educacao,imobiliario,saas}.md
- `CFO-IA/base-prompt.md` + variants/{educacao,imobiliario,saas}.md
- `skills.yaml` comum
- `hooks.ts` importando de `@ecossistema/constitutional-hooks`
- Generator CLI: `pnpm create-csuite-agent --business=fic --role=cfo`
**Sucesso:** gerar CFO-FIC concreto com 1 comando, agente roda no orchestrator (S10).

### S12 — Magic Link Vault (Phantom pattern)

**Worktree:** `eco-vault` · **Branch:** `feature/magic-link-vault`
**Escopo:** `packages/magic-link-vault/` — coleta secrets sem chat.
**Dependências:** nenhuma (standalone).
**Entregáveis:**
- AES-256-GCM crypto em TypeScript (`crypto.ts`)
- Edge Function `/collect-secret` + Next.js page `/vault/collect/[token]`
- Browser-side encryption antes de POST
- Integração com `ecosystem_credentials` via SC-29 v2
- Tool MCP `collect_secrets` (para agentes chamarem)
**Sucesso:** fluxo E2E: agente gera URL → Marcelo preenche form → secret chega cifrado no Vault → agente recupera via SC-29 Modo B.

### S13 — Clients (credentials + litellm + observability)

**Worktree:** `eco-clients-d3` · **Branch:** `feature/clients-d3`
**Escopo:** 3 packages client paralelos.
**Dependências:** S8 (SC-29 v2), S5 (LiteLLM), S9 (Langfuse).
**Entregáveis:**
- `@ecossistema/credentials` — cliente TS do SC-29 (Modos A/B)
- `@ecossistema/litellm-client` — wrapper com defaults V9 (fallback chain, budgets)
- `@ecossistema/observability` — Langfuse client + OTel via openllmetry
**Sucesso:** agente no orchestrator (S10) chama LiteLLM via client, trace aparece em Langfuse, credencial vem via SC-29.

### S14 — Memory Consolidator Worker

**Worktree:** `eco-consolidator` · **Branch:** `feature/memory-consolidator`
**Escopo:** `apps/memory-consolidator/` — Railway worker que roda sleeptime (Letta pattern).
**Dependências:** S7 (memory package), S5 (LiteLLM para summarization).
**Entregáveis:**
- Worker Python que roda em idle times (madrugada)
- Consolidação: episodic → semantic (extrai facts atômicos)
- Decay: reduz importance de memórias não-acessadas há > 30 dias
- Contradição resolution (versioning)
- Deploy Railway com schedule via pg_cron (2am diário)
**Sucesso:** após 24h rodando, memory_semantic tem facts extraídos de memory_episodic automaticamente.

### S15 — Testes + CI/CD

**Worktree:** `eco-tests-d3` · **Branch:** `feature/ci-tests`
**Escopo:** bateria de testes integração + GitHub Actions workflows.
**Dependências:** todos os packages prontos.
**Entregáveis:**
- `.github/workflows/ci.yml` — lint + test em todos os packages
- `.github/workflows/deploy-edge-functions.yml` — deploy seletivo ao merge
- `.github/workflows/deploy-railway.yml` — deploy Railway
- Teste E2E: Marcelo → Orchestrator → CFO-FIC → SC-29 → LiteLLM → Langfuse trace
- Coverage mínimo 70% em packages P0
**Sucesso:** push em branch dispara CI green, merge em main dispara deploy automático.

### S16 — Piloto CFO-FIC E2E

**Worktree:** `eco-pilot-cfo` · **Branch:** `feature/pilot-cfo-fic`
**Escopo:** instanciar CFO-FIC real que faz task real (régua de cobrança).
**Dependências:** S11 (templates), S10 (orchestrator), S13 (clients), S8 (SC-29 v2).
**Entregáveis:**
- `apps/erp-educacional/agents/cfo.ts` instanciado via template CFO-IA/variants/educacao
- Contexto específico FIC (Inter + inadimplência ~8% + mensalidades)
- Skills: verificar_inadimplentes, disparar_regua_cobranca, emitir_segunda_via_boleto
- Hook Art. II bloqueia emissão de boleto > R$10k sem aprovação Marcelo
- Integração Banco Inter via SC-29 Modo B
**Sucesso:** CFO-FIC executa "dispare régua de cobrança para inadimplentes com 15+ dias" e gera WhatsApps reais (sandbox primeiro).

### S17 — Validação E2E

**Objetivo:** smoke test de toda a Fase 0 antes da Fase 1.
- Marcelo manda mensagem → Jarvis (Stage 2 via Evolution API)
- Jarvis roteia para Claudinho → dispatch para CFO-FIC
- CFO-FIC consulta memory → pega credencial via SC-29 → chama LiteLLM → trace em Langfuse
- Retorna resposta → Jarvis → Marcelo
- Audit log captura tudo
- Briefing diário Marcelo funciona

### S18 — Briefing Marcelo + Demo

Preparar relatório executivo da Fase 0 completa e demo ao vivo para Marcelo validar.

---

## Como abrir as sessões

### Setup inicial (uma vez, antes do Dia 1)

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
# Cria todas as worktrees
for name in hooks assembler mcp-template migrations-d1 litellm docs-d1 \
            memory efs-d2 langfuse orchestrator csuite vault \
            clients-d3 consolidator tests-d3 pilot-cfo; do
  git worktree add ../eco-$name feature/$name
done
```

### Abrir Claude Code em cada worktree

```bash
# Terminal 1 (Dia 1, Sessão 1):
cd ../eco-hooks && claude

# Terminal 2 (Dia 1, Sessão 2):
cd ../eco-assembler && claude

# ... etc
```

### Cada sessão inicia com:

1. Leitura obrigatória: `MEMORY.md` + `docs/masterplans/MASTERPLAN-V9.md` + briefing específico em `docs/sessions/fase0/S{N}-*.md`
2. Lock task no `agent_tasks`: `UPDATE agent_tasks SET status='locked', assigned_to='session_{N}' WHERE task_id='S{N}'`
3. Trabalho no escopo
4. Ao fim do dia: commit + push + PR + update task status

---

## Métricas de progresso

Dashboard em Supabase ECOSYSTEM (`cockpit` view):

```sql
create view cockpit.fase0_progress as
select
  task_id,
  status,
  assigned_to,
  pct_complete,
  blocked_by,
  last_updated
from agent_tasks
where fase = '0'
order by priority, task_id;
```

Marcelo acompanha via: `SELECT * FROM cockpit.fase0_progress;` ou dashboard Railway.

---

## Risco & Mitigação

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Conflito merge entre sessões | Média | Escopo estrito por package + PR review sequencial |
| Migration quebra produção | Baixa | Rollback scripts + testes em branch Supabase primeiro |
| LiteLLM ou Langfuse crash | Baixa | Deploy com health checks + fallback para provider direto |
| Marcelo sobrecarga mental com 6 sessões | Média | **Cada sessão é autônoma** — Marcelo só valida PRs ao fim do dia |
| SC-29 v2 quebra acesso de agentes existentes | Média | Modo A default inicial + migração gradual para Modo B |

---

## Critério de fechamento da Fase 0

Fase 0 fechada quando TODAS as condições satisfeitas:

- [ ] `@ecossistema/memory` publicado e testado
- [ ] `@ecossistema/constitutional-hooks` com 11 hooks verificáveis
- [ ] `@ecossistema/prompt-assembler` com 9-layer implementado
- [ ] `@ecossistema/credentials` falando com SC-29 v2
- [ ] SC-29 v2 + webhook-hardening + pii-mask + skills-registry-crud + dual-write em produção
- [ ] LiteLLM proxy respondendo em `litellm.ecossistema.internal`
- [ ] Langfuse recebendo traces em tempo real
- [ ] Orchestrator FastAPI no Railway
- [ ] Memory consolidator rodando sleeptime
- [ ] Templates CEO-IA + CFO-IA prontos
- [ ] CFO-FIC piloto executa régua de cobrança E2E
- [ ] 15 ADRs + 6 runbooks commitados
- [ ] CI green + deploy automatizado

**Estimativa total:** 4 dias corridos com 6 sessões paralelas, ou 7-10 dias com 3 sessões paralelas.

---

## Próxima decisão do Marcelo

Escolher quantas sessões abrir simultaneamente hoje:

- **Modo Máximo (6 sessões):** esgota Fase 0 em 3-4 dias. Carga mental alta mas paralelismo bom.
- **Modo Balanceado (4 sessões):** esgota em 5-6 dias. Mais confortável, menos PRs por dia.
- **Modo Sequencial (2 sessões):** esgota em 8-10 dias. Baixo risco, validação por etapa.

Recomendação: **Modo Balanceado (4 sessões)** no Dia 1 para calibrar ritmo e depois escalar.
