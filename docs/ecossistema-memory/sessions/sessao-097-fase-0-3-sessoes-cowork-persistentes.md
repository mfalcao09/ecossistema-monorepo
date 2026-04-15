# Sessão 097 — FASE 0.3: Sessões Cowork do efêmero para o persistente

**Data:** 14/04/2026
**Projeto:** ecosystem
**Duração:** ~4 horas
**Status:** ✅ CONCLUÍDO
**Supabase ID:** beb26e9b-92b4-4591-8c11-628e6b093e52

---

## Contexto

Continuação da FASE 0 do Masterplan Ecossistema v8.2. As FASEs 0.0, 0.1 e 0.2 já estavam concluídas. Esta sessão entregou a FASE 0.3: persistir sessões Cowork (efêmeras) no Supabase para que `bootstrap_session()` possa recuperar contexto histórico em qualquer sessão futura.

---

## O que foi entregue

### 1. Migração DDL — `add_session_type_to_ecosystem_memory`
- Adicionado tipo `'session'` ao constraint `ecosystem_memory_type_check`
- Criado índice de busca: `idx_ecosystem_memory_session_project (project, created_at DESC) WHERE type='session'`
- Criado índice UNIQUE: `idx_ecosystem_memory_session_title_project (title, project) WHERE type='session'` — garante idempotência

### 2. Backfill histórico
- 15 sessões inseridas (s001–s095) com type='session', project='ecosystem'
- Verificado: SELECT count(*) = 15 ✅

### 3. Edge Function `sync-sessions` (ACTIVE)
- Pull automático via GitHub API
- Repos monitorados:
  - `mfalcao09/Ecossistema/memory/sessions` → project='ecosystem'
  - `mfalcao09/ERP-Educacional/memory/sessions` → project='erp'
- Lê `GITHUB_TOKEN_ECOSSISTEMA` do Vault (UUID: ffabc6cc-0498-4bbc-b23a-fae9286d910d)
- Auth: header `x-agent-secret` (AGENT_INTERNAL_SECRET)
- Idempotente: ON CONFLICT (title, project) WHERE type='session' DO NOTHING
- Retorna: `{ ok, summary, details: [{repo, inserted, skipped, errors}], synced_at }`

### 4. pg_cron habilitado — `enable_pg_cron_and_schedule_sync_sessions`
- Extensão pg_cron instalada
- Job `sync-sessions-hourly`: schedule='5 * * * *' (todo minuto 5 de cada hora)
- `trigger_sync_sessions()`: lê AGENT_INTERNAL_SECRET do Vault → pg_net.http_post → Edge Function
- jobid=1, active=true ✅

### 5. `bootstrap_session()` Option D — gap detection
- Migração: `bootstrap_session_gap_detection_option_d` + fix `fix_bootstrap_session_format_specifier`
- Se última sessão > 6h → dispara `trigger_sync_sessions()` antes de retornar memórias
- Adiciona `session_sync` ao resultado:
  ```json
  { "last_session_at": "...", "hours_since_last": 18.7, "auto_sync_triggered": true, "sync_reason": "..." }
  ```
- Teste confirmado: 18.7h gap → `auto_sync_triggered: true`, `memory_count: 5` ✅

### 6. `git-push-memory` scheduled task — estendida
- Prompt atualizado para chamar `SELECT trigger_sync_sessions()` após cada push
- Roda a cada 3h → 3ª camada de redundância

### 7. PLANO-IMPLEMENTACAO-ECOSSISTEMA-V1.md
- FASE 0.3 marcada como ✅ CONCLUÍDO com descrição completa do que foi entregue

---

## Bugs encontrados e corrigidos

| Bug | Causa | Fix |
|-----|-------|-----|
| `ecosystem_memory_type_check` violation | Constraint não incluía tipo 'session' | Migração DDL: drop + recreate constraint |
| `format()` specifier `"."` unrecognized | PostgreSQL format() só aceita %s/%I/%L, não %.1f | Substituído por concatenação: `hours_gap::text \|\| 'h'` |

---

## Arquitetura final (3 camadas de redundância)

```
Camada 1: pg_cron (todo minuto 5 de cada hora)
          └── trigger_sync_sessions() → pg_net → sync-sessions EF → GitHub → INSERT

Camada 2: bootstrap_session() (a cada sessão)
          └── gap > 6h? → dispara sync ANTES de retornar memórias

Camada 3: git-push-memory (a cada 3h)
          └── após git push → SELECT trigger_sync_sessions()
```

---

## Estado das FASEs após s097

| FASE | Status |
|------|--------|
| 0.0 — SC-29 Credential Vault | ✅ CONCLUÍDO (s094) |
| 0.1 — Supabase como memória primária | ✅ CONCLUÍDO (s094-s095) |
| 0.2 — bootstrap_session() | ✅ CONCLUÍDO (s095) |
| 0.3 — Sessões Cowork persistentes | ✅ CONCLUÍDO (s097) |
| 0.4 — RAG Engine auto-embed | ⏳ PRÓXIMA |
| 0.5 — Painel de Status | ⏳ PLANEJADA |

---

## Próxima sessão (s098)

**FASE 0.4 — RAG Engine: embeddar TUDO automaticamente**
- Trigger `AFTER INSERT ON ecosystem_memory` → chama Railway `/embed`
- Edge Function `embed-on-insert`
- Scheduled task `rag-full-sync` (semanal, domingo 2h) — re-embeds completo
- Responsáveis: DeepSeek (trigger logic) + Buchecha (Railway integration)
