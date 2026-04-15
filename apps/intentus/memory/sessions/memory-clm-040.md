# Sessão 40 — Fixes Auditoria Sessão 34: Fase 5 RBAC Granular (12/03/2026)

- **Objetivo**: Implementar Fase 5 (RBAC Granular) do plano de ação da auditoria sessão 34, usando MiniMax como pair programmer (Claudinho + Buchecha)
- **Metodologia**: Claude = Claudinho (commander/planner/reviewer), MiniMax = Buchecha (heavy lifter/code generator). Claude SEMPRE revisa output do MiniMax antes de aplicar.
- **Defense-in-depth RBAC em 3 camadas**:
  1. **Layer 1 — Frontend (UI Guards)**: `usePermissions` hook consome permission matrix, retorna `can(action)` + 19 boolean flags. Aplicado em 5 componentes: Contracts.tsx, ContractDetailDialog, ContractRenewalTab, TemplatesManager, ClmSettings
  2. **Layer 2 — Edge Functions (API)**: `_shared/middleware.ts` atualizado com RBAC enforcement. `createHandler({ actions, permissions })` valida role antes de executar handler. 403 se permissão insuficiente
  3. **Layer 3 — Database (RLS + has_role)**: Infraestrutura existente com `user_roles` table + `allowed_transitions` (Phase 4)
- **8 sub-tasks implementadas**:
  1. **Phase 5.1 — Permission Matrix**: 22 CLMAction types × 7 AppRole roles definidos. superadmin=wildcard, admin=full, gerente=most (sem delete/settings), corretor=own contracts, financeiro=obligations+financial, juridico=legal+approve, manutencao=read-only
  2. **Phase 5.2 — `src/lib/clmPermissions.ts`** (CRIADO): Central permission file com types `AppRole` e `CLMAction`, `CLM_PERMISSION_MAP` (6 roles × 22 actions), `roleHasPermission()` e `computePermissions()` helpers
  3. **Phase 5.3 — `src/hooks/usePermissions.ts`** (CRIADO): React hook que consome permission matrix via `useAuth()`. Returns `can(action)` callback + 19 boolean convenience flags (`canCreateContract`, `canApprove`, `canManageSettings`, `canUsePricingAI`, etc.)
  4. **Phase 5.4 — `src/hooks/useAuth.tsx`** (MODIFICADO): `initUserContext()` reescrito — resolve tenant FIRST, depois fetch tenant-scoped roles de `user_roles`. Exports adicionais: `roles: AppRole[]`, `isSuperAdmin: boolean`
  5. **Phase 5.5 — Backend mirror**: `supabase/functions/_shared/clmPermissions.ts` (CRIADO, 128 linhas) — mirror Deno do frontend. `_shared/middleware.ts` (MODIFICADO, 288 linhas) — imports `hasPermission`, `resolveAuth()` agora retorna `userRoles`, `HandlerConfig` com `{ actions, permissions }`, RBAC check antes de handler execution. Backward compat: aceita tanto flat map quanto HandlerConfig
  6. **Phase 5.6 — UI Guards em 5 componentes**: `Contracts.tsx` (canManageSettings, canUseDraftAI, canCreateContract, canDeleteContract), `ContractDetailDialog.tsx` (canUsePricingAI), `ContractRenewalTab.tsx` (canUsePricingAI × 2), `TemplatesManager.tsx` (canManageTemplates), `ClmSettings.tsx` (page-level guard com ShieldAlert)
  7. **Phase 5.7 — Deploy 4 Edge Functions com RBAC**: Todas deployadas com `_shared/middleware.ts` + `_shared/clmPermissions.ts` incluídos. Permission mappings: contract-api (3 actions), approvals-api (5 actions), obligations-api (4 actions), templates-api (2 actions)
  8. **Phase 5.8 — Build verification + CLAUDE.md**: `npx tsc --noEmit` = 0 erros. CLAUDE.md atualizado (auto-save)
- **Edge Functions — Versões atualizadas**:
  - `clm-contract-api` → version 15 (RBAC: dashboard→clm.dashboard.view, transition→clm.contract.transition, get_transitions→clm.contract.read)
  - `clm-approvals-api` → version 12 (RBAC: pending/history→clm.contract.read, approve→clm.approval.approve, reject→clm.approval.reject, delegate→clm.approval.delegate)
  - `clm-obligations-api` → version 12 (RBAC: dashboard/overdue/upcoming→clm.obligation.read, batch-create→clm.obligation.batch_create)
  - `clm-templates-api` → version 9 (RBAC: list/render→clm.template.read)
- **Build**: 0 erros TypeScript
- **Arquivos criados** (3 arquivos):
  - `src/lib/clmPermissions.ts` — Permission matrix frontend (22 actions × 7 roles)
  - `src/hooks/usePermissions.ts` — React hook com can() + 19 boolean flags
  - `supabase/functions/_shared/clmPermissions.ts` — Backend mirror Deno (128 linhas)
- **Arquivos modificados** (7 arquivos):
  - `src/hooks/useAuth.tsx` — tenant-scoped roles, exports roles/isSuperAdmin
  - `supabase/functions/_shared/middleware.ts` — RBAC enforcement, HandlerConfig, hasPermission check
  - `supabase/functions/clm-contract-api/index.ts` — permissions map
  - `supabase/functions/clm-approvals-api/index.ts` — permissions map
  - `supabase/functions/clm-obligations-api/index.ts` — permissions map
  - `supabase/functions/clm-templates-api/index.ts` — permissions map
- **Arquivos com UI guards** (5 arquivos):
  - `src/pages/Contracts.tsx` — 4 guards (settings, draft AI, create, delete)
  - `src/components/contracts/ContractDetailDialog.tsx` — 1 guard (pricing AI tab)
  - `src/components/contracts/ContractRenewalTab.tsx` — 2 guards (pricing AI buttons)
  - `src/components/contracts/TemplatesManager.tsx` — 4 guards (novo, editar, duplicar, excluir)
  - `src/pages/ClmSettings.tsx` — page-level guard com ShieldAlert
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
