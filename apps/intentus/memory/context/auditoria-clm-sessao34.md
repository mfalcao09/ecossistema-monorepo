# Auditoria CLM Sessão 34 — Claude + MiniMax Pair Programming

## Data: 12/03/2026

## Resumo
Auditoria profunda do módulo CLM com pair programming Claude + MiniMax M2.5.
35 achados consolidados: 10 CRÍTICO, 11 WARNING, 5 INFO, 9 MELHORIA ESTRUTURAL.

## Bug Crítico Corrigido
- **Command Center não carregava** — Root cause: `.eq("id", userId)` vs `.eq("user_id", userId)`
- `profiles.id` é PK própria da tabela, `profiles.user_id` é FK para `auth.users.id`
- `session.user.id` retorna `auth.users.id` → deve usar `.eq("user_id", ...)` para buscar na profiles
- Corrigido em 5 arquivos: 4 Edge Functions + clmApi.ts
- 4 Edge Functions re-deployadas: contract-api v9, approvals-api v8, obligations-api v7, templates-api v4

## 10 Achados Críticos
1. CORS wildcard (*) nas 4 Edge Functions
2. Race condition em contract transition (read-then-write)
3. Sem verificação de identidade do approver
4. Sem validação de input no batch-create
5. Race condition em use_count (read-then-write)
6. CORS wildcard (repetido em approvals)
7. Race condition em startWorkflow (non-atomic)
8. Monolito de 907 linhas (ClmCommandCenter)
9. tenant_id ausente em createNotification (3 calls)
10. CORS wildcard (repetido em obligations/templates)

## 5 Melhorias Estruturais (MiniMax)
1. **Decomposição ClmCommandCenter**: Feature-based folders, 8 componentes extraídos
2. **Middleware compartilhado EFs**: createHandler() com CORS whitelist, auth centralizado
3. **AuthProvider React Context**: Cache profile 30min, elimina 2 API calls/request
4. **Features Enterprise ausentes**: RBAC, Versioning, SLA Escalation, Renewal, Analytics
5. **State Machine Evolution**: 5 novos estados, allowed_transitions table, triggers PostgreSQL

## Plano de Ação (5 fases, ~44h) — TODAS CONCLUÍDAS ✅
- Fase 1: Segurança Crítica (~6h) — ✅ CONCLUÍDA (sessão 35) — CORS whitelist, optimistic locking, input validation, error sanitization
- Fase 2: Arquitetura (~8h) — ✅ CONCLUÍDA (sessão 36) — middleware compartilhado, decomposição, tenant cache 30min
- Fase 3: UX e Qualidade (~4h) — ✅ CONCLUÍDA (sessão 37) — click handlers, keys estáveis, reject prompt
- Fase 4: State Machine Enterprise (~6h) — ✅ CONCLUÍDA (sessão 38) — 13 statuses, 50 transições, trigger PG
- Fase 5: RBAC Granular (~6h) — ✅ CONCLUÍDA (sessão 40) — 22 actions × 7 roles, 3 camadas defense-in-depth

## Status Pós-Auditoria (Sessões 64-72)
- Varredura CLM profunda (sessão 41, 82+ arquivos) — 2 true CRITICAL encontrados e fixados na sessão 48
- Diagnóstico comercial (sessão 39, 40+ arquivos) — 27 achados, 4 fases de fixes (42-45)
- Fix produção CORS + RLS (sessão 65) — 11+ EFs re-deployadas, RLS policies corrigidas
- Fix browser freeze /contratos/ + /contratos/analytics (sessões 64-70) — 8 fixes + rewrite ClmAnalytics do zero
- Verificação final (sessão 72) — 19 bugs residuais fixados (React #310, tenant_id leaks, batch limits, caching)
- **CLM production-ready** verificado em produção (`app.intentusrealestate.com.br`)

## Fase 1 — Detalhes da Implementação (sessão 35, 12/03/2026)
Pair programming Claude (Thor) + MiniMax (Mjölnir)

### 7 fixes aplicados:
1. **CORS whitelist (4 EFs)**: `ALLOWED_ORIGINS` env var + regex fallback dev/preview
2. **Optimistic lock — contract transition**: WHERE `status = from_status` → 409 se já modificado
3. **Optimistic lock — approvals**: approve/reject/delegate com WHERE `status = "pendente"` → 409
4. **Approver identity check**: `approver_id !== user.id` → 403
5. **Delegate same-tenant**: Verifica tenant_id do delegate_to via profiles
6. **Batch validation**: MAX_BATCH_SIZE=100, title (required, max 255), date (YYYY-MM-DD + calendar parse)
7. **Atomic use_count**: RPC `increment_template_use_count` (fire-and-forget)
8. **Optimistic lock — startWorkflow (frontend)**: UPDATE first → verify → INSERT steps → rollback
9. **Error sanitization (4 EFs)**: Generic messages to client, details to console.error

### Edge Functions deployadas:
- `clm-contract-api` → version 12
- `clm-approvals-api` → version 10
- `clm-obligations-api` → version 10
- `clm-templates-api` → version 7

### Investigação false positive:
- `createNotification` sem tenant_id em ApprovalWorkflowPanel → já resolve internamente via `getAuthTenantId()`

## Relatório
`docs/auditoria-clm-sessao34-claude-minimax.docx` (20.1 KB)

## Regra Aprendida (CRÍTICA)
```
SEMPRE: .eq("user_id", session.user.id)  ← CORRETO
NUNCA:  .eq("id", session.user.id)       ← ERRADO (profiles.id ≠ auth.users.id)
```
