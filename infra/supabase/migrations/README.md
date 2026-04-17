# Supabase Migrations — ECOSYSTEM (`gqckbunsfjgerbuiyzvn`)

Fonte única de DDL canônico do DB ECOSYSTEM.
Toda migration roda via `mcp__supabase__apply_migration` (ou `supabase db push`).

## Ordem cronológica + intenção

| Versão | Nome | Intenção |
|---|---|---|
| 20260413014855 | enable_pgvector | Extensão vector + pg_cron para RAG |
| 20260413014915 | create_core_tables | Base: ecosystem_memory, agent_tasks, agent_permissions |
| 20260413015146 | indexes_and_rls | Índices + RLS inicial |
| 20260413015215..15541 | seeds + rag_functions | Seeds iniciais + funções RAG |
| 20260414112204 | fix_bootstrap_session_v2 | Correção bootstrap_session |
| 20260414113401..13455 | pg_net + auto_embed_on_memory_insert | Trigger async de embedding |
| 20260414125050..25301 | SC-29 base + vault helpers | Credential Vault v1 |
| 20260414183553..84042 | session_type + pg_cron sync | Sessões + cron discovery |
| 20260415005854..30714 | FASE 1-4 | Task/Telemetry/Teams/Crons/Cache/MCP/Squad/Hooks/Bash |
| **20260417010000** | **memory_3tier** | V9 §40 — Episodic/Semantic/Procedural |
| **20260417020000** | **ecosystem_credentials_v2_acl** | V9 §22 — ACL + project/environment/provider |
| **20260417030000** | **skills_registry** | V9 — registry central de skills |
| **20260417040000** | **audit_log_v9** | V9 Art. IV + MP-08 — audit trail append-only |

## Migrations V9 Fase 0 — Sessão S04 (2026-04-17)

### 1. `20260417010000_memory_3tier.sql`

Cria as 3 camadas de memória do padrão Phantom/Mem0:
- `memory_episodic` — tasks, conversations, decisions (com `summary_vec` e `detail_vec`, tsvector PT-BR, entities jsonb)
- `memory_semantic` — atomic facts (subject/predicate/object) com versioning via `supersedes_id`
- `memory_procedural` — workflows com outcome tracking (success/failure count)

RLS: business_id via `app.current_business` + bypass `app.is_ecosystem_admin = 'true'` + service_role.

**Observação**: triggers de auto-embedding **não** são criados aqui. A EF `embed-on-insert` atual
só aceita `ecosystem_memory`. **S07 (Memory package)** ou **S08 (Edge Functions)** adiciona
triggers depois de generalizar a EF para `{table, id, fields}`.

### 2. `20260417020000_ecosystem_credentials_v2_acl.sql`

Adapta schema real para V9 Parte VII §22.

**Divergência descoberta durante S04**: schema em produção tinha `service`/`scope`/`location`;
V9 prescreve `provider`/`project`/`environment`. Migration faz backfill:

- `provider := service`
- `environment := 'prod'` (todos os 7 registros existentes são prod)
- `project := scope`, com `scope='erp'` → `'fic'`

Novas colunas:
- `acl jsonb` — `[{agent_pattern, allowed_scopes}]`
- `rate_limit jsonb` — `{rpm, rph}` default `{60, 1000}`
- `proxy_only boolean` — força Modo B (SC-29 V9)
- `last_used_at`, `usage_count` — observability

Swap de `unique(name)` para `unique(name, project, environment)`.

Também upgrade de `credential_access_log` com `project`, `mode` (A/B), `api_endpoint`,
`latency_ms`, `cost_usd`, `metadata`, `reason`. CHECK de `action` expandido para incluir
`proxy`, `denied`, `revoke`. Triggers append-only.

### 3. `20260417030000_skills_registry.sql`

Registry central de skills com `name`, `version`, `input_schema`, `output_schema`, `tool_refs`,
`markdown_path`. Unique em `(business_id, name, version)` permite versionar skills.

Seed das 4 skills Instagram existentes (lead-miner, sales-strategist, trend-hunter, true-copywriter).

### 4. `20260417040000_audit_log_v9.sql`

Pista de auditoria canônica do ecossistema. Tabela nova (não conflita com `agent_telemetry`
que continua sendo telemetria técnica). Campos V9:
- `business_id`, `agent_id`, `user_id`, `run_id`, `trace_id` (OTel correlation)
- `action`: `tool_call|decision|handoff|violation|hook|memory_op|credential_op`
- `severity`, `article_ref` (Art. II/IV/...), `decision` (allow|block|warn)
- Hashes ao invés de payload completo (LGPD-safe)
- Append-only via trigger (raise exception em update/delete)

## Rollback

Scripts em `rollback/` espelham cada migration. Regras:
- **Nunca dropar `ecosystem_memory`**, `ecosystem_credentials` (tabela), ou `credential_access_log` inteira.
- Rollback de `audit_log_v9` aborta se tabela tiver dados (segurança).
- Rollback de `ecosystem_credentials_v2_acl` restaura `unique(name)` e remove colunas V9 sem tocar valores existentes.

## Como aplicar (Sessão S04)

1. Criar branch Supabase `v9-migrations-d1` (via `mcp__supabase__create_branch` — consome créditos, `confirm_cost` primeiro).
2. Aplicar as 4 migrations **em ordem** no branch.
3. Rodar validações (ver `VALIDACOES-S04.sql`).
4. Se verde: merge branch para main.
5. Commit + PR: `feat(db): migrations V9 — memory 3-tier + credentials v2 + skills + audit`.
