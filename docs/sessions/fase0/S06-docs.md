# S6 — ADRs + Runbooks

**Sessão:** S06 · **Dia:** 1 · **Worktree:** `eco-docs-d1` · **Branch:** `feature/docs-d1`
**Duração estimada:** 1 dia (6-8h) · **Dependências:** nenhuma (usa V9 como base)
**Bloqueia:** ninguém — é documentação paralela

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **integral** (base de todo ADR)
2. `docs/masterplans/PLANO-EXECUCAO-V4.md` — decisões D1-D6
3. `docs/research/CONSOLIDADO-FINDINGS-2026-04-15.md` — evidências para cada ADR
4. Padrão ADR: https://github.com/joelparkerhenderson/architecture-decision-record (MADR format)

---

## Objetivo

Produzir **15 ADRs** (Architecture Decision Records) + **6 Runbooks** operacionais, todos referenciando a V9 e evidências de pesquisa. Esse pacote torna o porquê de cada decisão auditável e rastreável.

---

## Escopo exato

```
docs/adr/
├── README.md                          # índice de ADRs + processo
├── template.md                        # MADR template
├── 001-managed-agents-runtime.md
├── 002-monorepo-pnpm-workspaces.md
├── 003-supabase-ecosystem-per-projeto.md
├── 004-litellm-gateway-unico.md
├── 005-langfuse-observability-selfhost.md
├── 006-fastmcp-framework-mcp.md
├── 007-mem0-pgvector-3tier.md
├── 008-sc29-edge-function-nao-agente.md
├── 009-22-artigos-como-hooks.md
├── 010-csuite-per-negocio-diretores-area.md
├── 011-jarvis-4-stages-pipecat-livekit.md
├── 012-stack-br-canonica.md
├── 013-phantom-9-layer-prompt-assembler.md
├── 014-mem0-v3-add-only-algoritmo.md
└── 015-cardinal-rule-codigo-encanamento-llm-cerebro.md

docs/runbooks/
├── README.md
├── 01-rotacao-credenciais-sc29.md
├── 02-adicionar-novo-negocio-ecossistema.md
├── 03-deploy-nova-edge-function.md
├── 04-aplicar-migration-ecosystem.md
├── 05-resposta-incidente-dinfra-sc27.md
└── 06-rollback-prompt-version-managed-agents.md
```

---

## Template MADR canônico (`docs/adr/template.md`)

```markdown
# ADR-XXX: {título curto e decisivo}

- **Status:** proposto | aceito | superseded-by-ADR-YYY | deprecado
- **Data:** YYYY-MM-DD
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § N, ADR-YYY, ADR-ZZZ

## Contexto e problema

{Descreva o problema concreto em 2-4 parágrafos. Cite sintomas, restrições, objetivos.}

## Opções consideradas

- **Opção 1:** {nome + breve descrição}
- **Opção 2:** {...}
- **Opção 3:** {...}

## Critérios de decisão

- {Critério 1 — ex: custo operacional mensal}
- {Critério 2 — ex: latência p95}
- {Critério 3 — ex: curva de aprendizado}

## Decisão

**Escolhemos Opção N.**

{Razão principal em 1-2 frases; resto em Consequências.}

## Consequências

### Positivas
- {benefício 1}
- {benefício 2}

### Negativas
- {trade-off 1}
- {trade-off 2}

### Neutras / riscos
- {risco + mitigação}

## Evidência / pesquisa

- `docs/research/{arquivo}.md` — {trecho relevante}
- `research-repos/{repo}/{path}` — {código que valida}
- Benchmark: {link, número, condição}

## Ação de implementação

- {tarefa 1 — sessão S?? ou Fase N}
- {tarefa 2}

## Revisão

Revisar em: {data ou evento gatilho}.
```

---

## Conteúdo de cada ADR (resumo por doc)

### ADR-001: Managed Agents como runtime primário
- **Contexto:** precisamos runtime de agentes resiliente e gerenciado
- **Opções:** (a) Managed Agents Anthropic, (b) self-host SDK com orchestrator custom, (c) LangGraph no Railway
- **Decisão:** Managed Agents + SDK Python para glue; LangGraph para Jarvis meta-layer (long-running)
- **Evidência:** `claude-cookbooks/managed_agents/README.md` + nossa análise em `ANALISE-JARVIS-REFERENCE.md`

### ADR-002: Monorepo com pnpm workspaces
- **Contexto:** 5 negócios + packages compartilhados + apps diversos
- **Opções:** (a) multi-repo, (b) pnpm workspaces, (c) turborepo puro, (d) Nx
- **Decisão:** pnpm workspaces + turbo para build. Iniciante-friendly e simples.
- **Evidência:** V4 D5, `MASTERPLAN-V9 § Parte XII`

### ADR-003: Supabase ECOSYSTEM + DBs per-projeto
- **Contexto:** dados reutilizáveis vs dados de domínio
- **Opções:** (a) DB único, (b) DB per-projeto sem shared, (c) ECOSYSTEM + per-projeto
- **Decisão:** ECOSYSTEM + per-projeto (D2 canônica)
- **Regra:** se serve mais de um negócio → ECOSYSTEM; se é domínio → per-projeto
- **Evidência:** V4 D2, V8.2, V9 § Parte XI

### ADR-004: LiteLLM como gateway único
- **Contexto:** custos fragmentados, fallback ad-hoc, observability inconsistente
- **Opções:** (a) Portkey AI Gateway, (b) LiteLLM proxy, (c) Vercel AI Gateway, (d) direto ao provider
- **Decisão:** LiteLLM proxy self-host Railway
- **Evidência:** `research-repos/litellm/litellm/router.py` (10k+ linhas prod-grade), `ANALISE-MULTIAGENT-VOICE-OBS.md`

### ADR-005: Langfuse self-host para observability
- **Contexto:** precisamos trace, metrics, evals, prompt management unificados
- **Opções:** (a) LangSmith SaaS, (b) Langfuse self-host, (c) Phoenix (Arize), (d) Helicone
- **Decisão:** Langfuse self-host (Postgres + ClickHouse) — MIT, controle total, integra nativo LiteLLM
- **Evidência:** `research-repos/langfuse/`, arquitetura Postgres+ClickHouse documentada

### ADR-006: FastMCP v3 como framework MCP
- **Contexto:** todos os MCP servers do ecossistema
- **Opções:** (a) MCP Python SDK oficial puro, (b) FastMCP v3, (c) build custom
- **Decisão:** FastMCP v3 (powers 70% dos MCP servers cross-language)
- **Evidência:** `research-repos/fastmcp/`, V9 § 30

### ADR-007: Mem0 v3 + pgvector 3-tier
- **Contexto:** memory layer com escala, qualidade, filters estritos
- **Opções:** (a) Mem0 v3, (b) Letta/MemGPT, (c) Zep Graphiti, (d) build próprio
- **Decisão:** Mem0 v3 (wrapper) + pgvector 3-tier (episodic/semantic/procedural) no Supabase
- **Evidência:** Mem0 v3 benchmarks (91.6 LoCoMo, 93.4 LongMemEval), phantom pattern

### ADR-008: SC-29 como Edge Function determinística
- **Contexto:** credential vault precisa ser seguro, rápido, determinístico
- **Opções:** (a) Agente LLM (proposta original), (b) Edge Function determinística
- **Decisão:** Edge Function Supabase. Modo A (entrega) + Modo B (proxy)
- **Razão:** LLM alucina e custa; ACL é decisão determinística
- **Evidência:** V9 § Parte VII

### ADR-009: 22 Artigos Constitucionais como hooks executáveis
- **Contexto:** Artigos em markdown não são enforçáveis
- **Opções:** (a) só diretrizes de prompt, (b) só hooks, (c) mix
- **Decisão:** Mix — 11 verificáveis como hooks (PreToolUse/PostToolUse/SessionEnd), 11 subjetivos como diretrizes
- **Evidência:** phantom `src/agent/hooks.ts` + V9 § Parte V

### ADR-010: C-Suite per negócio + 6 Diretores de Área
- **Contexto:** 8 diretores C-Suite no ecossistema não escala + não isola por negócio
- **Opções:** (a) 8 diretores globais (V8.2), (b) C-Suite per negócio + sem governança cross, (c) C-Suite per negócio + 6 Diretores de Área no ecossistema
- **Decisão:** Opção C. Marcelo recebe briefing consolidado dos Diretores.
- **Evidência:** V9 § Parte VI

### ADR-011: Jarvis 4-stage — pipecat + LiveKit Agents
- **Contexto:** evolução E1→E4 do Jarvis precisa stack de voz
- **Opções:** (a) só LiveKit Agents, (b) só pipecat, (c) OpenAI Realtime, (d) pipecat WhatsApp + LiveKit WebRTC
- **Decisão:** pipecat para WhatsApp/telefonia + LiveKit Agents para WebRTC (drive-thru pattern)
- **Evidência:** `ANALISE-MULTIAGENT-VOICE-OBS.md` § voice comparison

### ADR-012: Stack BR canônica
- **Contexto:** 5 negócios operam no Brasil, licenças importam
- **Decisão:** Chatwoot (MIT) + Evolution API (Apache) + Documenso (AGPL self-host sem modificar) + pyHanko (MIT, ICP-Brasil) + PyNFe (MIT) + MariTalk API (comercial, PT-BR nativo)
- **Alertas licença:** Documenso e Twenty são AGPL — self-host sem modificar!
- **Evidência:** V9 § Parte IX § 36, `ANALISE-VERTICAIS-BRASIL-PROFUNDA.md`

### ADR-013: Phantom 9-layer prompt assembler
- **Contexto:** cada agente precisa identidade consistente, memória integrada, governança embutida
- **Decisão:** adotar phantom 9-layer (identity/env/security/role/onboarding/evolved/memory-instr/instructions/memory-context)
- **Evidência:** `phantom/src/agent/prompt-assembler.ts`

### ADR-014: Mem0 v3 ADD-only como algoritmo
- **Contexto:** memória crescente sem conflitos de UPDATE/DELETE
- **Decisão:** v3 single-pass ADD-only; contradição vira versioning (semantic.supersedes_id)
- **Evidência:** Mem0 v3 README + benchmarks

### ADR-015: Cardinal Rule — "código é encanamento, SDK é cérebro"
- **Contexto:** tentação de resolver decisões via regex/classifiers em código
- **Decisão:** proibir funções `detectXxx/parseIntentXxx/classifyXxx` fora de `/fallback/`. Lint rule enforce.
- **Evidência:** phantom `CLAUDE.md` primeira linha

---

## Conteúdo de cada Runbook

### 01 — Rotação de credenciais (SC-29)
Passo-a-passo:
1. Identificar credencial a rotacionar (`ecosystem_credentials`)
2. Solicitar aprovação Marcelo (Art. II se prod)
3. Gerar novo valor (API provider)
4. `UPDATE vault.secrets` via Supabase Vault API
5. `INSERT credential_access_log (action='rotate')`
6. Confirmar proxy calls (Modo B) funcionam com novo valor
7. Invalidar valor antigo (provider dashboard)
8. Avisar D-Infra + D-Governanca no briefing

### 02 — Adicionar novo negócio ao ecossistema
1. Criar Supabase per-projeto (via MCP)
2. Copiar schema base (agents_base migrations)
3. Adicionar `business_id` em ACLs existentes
4. Criar virtual key no LiteLLM
5. Instanciar C-Suite per matriz V9 § 15
6. Configurar namespace memory (business_id novo)
7. Adicionar MCP server do negócio (`@ecossistema/mcp-servers/{novo}-mcp`)
8. Registrar no `cockpit.businesses` view

### 03 — Deploy nova Edge Function
1. Criar em `infra/supabase/functions/{nome}/`
2. Escrever tests de integração
3. Validar em branch Supabase
4. `supabase functions deploy {nome} --project-ref gqckbunsfjgerbuiyzvn`
5. Smoke test em prod
6. Atualizar `infra/supabase/functions/README.md`
7. Notificar D-Infra

### 04 — Aplicar migration em ECOSYSTEM
1. **Verificar slot do dia** (regra canônica: 1 sessão/dia)
2. Lock task em `agent_tasks`
3. Criar migration em `infra/supabase/migrations/YYYYMMDDHHMMSS_nome.sql`
4. Criar rollback em `migrations/rollback/YYYYMMDDHHMMSS_nome.down.sql`
5. Branch Supabase: `supabase db branch create test-{nome}`
6. Testar em branch
7. Validar com checklist de queries
8. Merge para main
9. Apply em prod
10. Testar novamente em prod

### 05 — Resposta a incidente (D-Infra + SC-27)
1. Severity triage (P0/P1/P2/P3)
2. P0/P1 → notifica Marcelo (WhatsApp) imediatamente
3. D-Infra consulta Langfuse + Railway metrics
4. Identificar root cause (que agente/EF/serviço)
5. Mitigação: rollback prompt version OU pause agente OU failover LiteLLM fallback
6. Postmortem em `docs/incidents/YYYY-MM-DD-titulo.md`
7. Ação corretiva: ADR novo ou hook novo

### 06 — Rollback de prompt version (Managed Agents)
1. Identificar versão problemática (via Langfuse: queda de success rate, aumento de violações Art)
2. `agents.update()` criou v(N+1) ruim; sessões novas pinar em v(N)
3. Via API Managed Agents: `sessions.create({ version: N })`
4. Monitorar 1h; se estabilizou → rollback permanente
5. Abrir issue com learning para próxima iteração do prompt

---

## Critério de sucesso

- [ ] 15 ADRs em `docs/adr/` com template consistente
- [ ] 6 Runbooks em `docs/runbooks/` testáveis passo-a-passo
- [ ] `docs/adr/README.md` com índice + estado (aceito/superseded)
- [ ] `docs/runbooks/README.md` com índice + quando usar cada
- [ ] Cross-references V9 / ADRs / Runbooks / Research corretos
- [ ] Commit: `feat(docs): 15 ADRs canônicos + 6 runbooks operacionais`
- [ ] PR com descrição listando cada ADR e runbook

---

## Handoff

Docs são consumidas por todas as outras sessões — ficam disponíveis em `docs/` no monorepo. Marcelo consulta ADRs quando alguém questionar decisão. Runbooks guiam operações rotineiras.

---

**Boa sessão. Documentação boa é poder de governança.**
