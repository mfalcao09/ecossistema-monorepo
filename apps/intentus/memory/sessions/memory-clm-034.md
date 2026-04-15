# Sessão 34 — Auditoria CLM profunda (Claude+MiniMax pair programming) + Fix Command Center (12/03/2026)

- **Contexto**: Marcelo reportou erro na tela do Command Center e pediu investigação profunda de TODO o código CLM com MiniMax como pair programmer ativo (não apenas revisor)
- **Parte 1 — Fix do Command Center** (bug crítico):
  - **Sintoma**: Erro na tela do Command Center ao carregar dashboard
  - **Root cause**: `.eq("id", userId)` comparava `auth.users.id` (UUID do session.user) contra `profiles.id` (PK própria da tabela profiles). Correto: `.eq("user_id", userId)` que é a FK para auth.users
  - **Confirmação no banco**: Marcelo profile tem `id="553c6c7f-..."` (PK) vs `user_id="ba91572c-..."` (FK para auth.users)
  - **5 arquivos corrigidos**: `clm-contract-api`, `clm-approvals-api`, `clm-obligations-api`, `clm-templates-api` (Edge Functions) + `src/lib/clmApi.ts` (frontend)
  - **4 Edge Functions re-deployadas**: contract-api v9, approvals-api v8, obligations-api v7, templates-api v4
- **Parte 2 — Auditoria completa de 12 arquivos CLM** (pair programming Claude+MiniMax):
  - **Metodologia**: Claude lê e analisa cada arquivo, MiniMax recebe via `minimax_code_review` para second opinion independente
  - **12 arquivos auditados** (mesmos 12 da auditoria anterior, re-auditados pós-fixes):
    1. `clm-contract-api/index.ts` (272 linhas) — MiniMax: CORS wildcard, race condition transition
    2. `clm-approvals-api/index.ts` (372 linhas) — MiniMax: Sem verificação identidade approver
    3. `clm-obligations-api/index.ts` (293 linhas) — MiniMax: Sem validação input batch-create, sem limite batch
    4. `clm-templates-api/index.ts` (155 linhas) — MiniMax: Race condition use_count (read-then-write vs SQL increment)
    5. `src/lib/clmApi.ts` (452 linhas) — MiniMax: Calls sequenciais em resolveAuthContext
    6. `src/hooks/useClmDashboard.ts` (54 linhas) — MiniMax: ✅ Bom, refetchOnWindowFocus default
    7. `src/hooks/useClmLifecycle.ts` (147 linhas) — MiniMax: Falta invalidar contract-audit-trail
    8. `src/hooks/useApprovalWorkflow.ts` (263 linhas) — MiniMax: Race condition não-atômica em startWorkflow
    9. `src/components/contracts/PendingApprovalsWidget.tsx` (191 linhas) — MiniMax: Click handler ausente, imports não usados
    10. `src/components/contracts/ContractDetailDialog.tsx` (321 linhas) — MiniMax: Null check ausente em contract.properties
    11. `src/pages/ClmCommandCenter.tsx` (907 linhas) — MiniMax: Monolito, hardcoded reject, key={index}
    12. `src/components/contracts/ApprovalWorkflowPanel.tsx` (672 linhas) — MiniMax: tenant_id ausente em createNotification
- **Parte 3 — Investigação de melhorias estruturais com MiniMax** (5 consultas):
  1. **Decomposição do ClmCommandCenter**: Feature-based folders `src/features/command-center/` com 8 componentes extraídos + hooks dedicados
  2. **Middleware compartilhado para Edge Functions**: `_shared/middleware.ts` com `createHandler()` — CORS whitelist, auth/tenant centralizado, error handler global
  3. **AuthProvider com React Context**: Cache de profile 30min, elimina 2 API calls extras por request
  4. **Features ausentes para CLM Enterprise**: RBAC, Contract Versioning, SLA Escalation, Renewal Management, Advanced Analytics
  5. **Evolução da State Machine**: 5 novos estados (negociacao, expirado, arquivado, em_alteracao, vigencia_pendente), tabela `allowed_transitions`, trigger PostgreSQL, role-based permissions
- **35 achados consolidados**: 10 CRÍTICO, 11 WARNING, 5 INFO, 9 MELHORIA ESTRUTURAL
- **Plano de ação em 5 fases** (~44h total):
  - Fase 1: Segurança Crítica (~6h) — CORS whitelist, race conditions, input validation
  - Fase 2: Arquitetura (~8h) — Decomposição CommandCenter, middleware shared, AuthProvider
  - Fase 3: UX e Qualidade (~4h) — Click handlers, null checks, key props, imports cleanup
  - Fase 4: State Machine Enterprise (~6h) — Novos estados, transitions table, triggers
  - Fase 5: Features Enterprise (~20h+) — RBAC, versioning, SLA, renewal, analytics
- **Entregável**: Relatório Word completo `docs/auditoria-clm-sessao34-claude-minimax.docx` (20.1 KB) com branding Intentus
- **Lição técnica importante**: `profiles.id` ≠ `auth.users.id`. Sempre usar `profiles.user_id` para match com `session.user.id`
- **Edge Functions — Versões atualizadas**:
  - `clm-contract-api` → version 9 (fix user_id)
  - `clm-approvals-api` → version 8 (fix user_id)
  - `clm-obligations-api` → version 7 (fix user_id)
  - `clm-templates-api` → version 4 (fix user_id)
- **Arquivos modificados** (5 arquivos — fix user_id):
  - `supabase/functions/clm-contract-api/index.ts`
  - `supabase/functions/clm-approvals-api/index.ts`
  - `supabase/functions/clm-obligations-api/index.ts`
  - `supabase/functions/clm-templates-api/index.ts`
  - `src/lib/clmApi.ts`
- **Arquivo criado**:
  - `docs/auditoria-clm-sessao34-claude-minimax.docx` (relatório final 35 achados)
