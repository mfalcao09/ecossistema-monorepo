# PENDENCIAS — Atendimento S6 (Cargos + Permissões Granulares)

> **Sprint:** S6 · **Branch:** `feature/atnd-s6-cargos` · **Worktree:** `.claude/worktrees/wizardly-jones-67ac24`
> **Status:** em execução — Fase 1 (Fundação) concluída

## Log de execução

### ✅ Fase 1 — Fundação (2026-04-21)

- [x] Migration `apps/erp-educacional/supabase/migrations/20260421_atendimento_s6_cargos.sql`:
  - 5 tabelas novas: `agent_roles`, `role_permissions`, `teams`, `team_members`, `agent_invites`
  - `atendimento_agents.role_id` adicionada (nullable, coexiste com `role` TEXT legado)
  - 3 presets system (UUIDs fixos `00000000-0000-0000-0000-00000000000{1,2,3}`)
  - RLS habilitado com política permissiva inicial (FIC single-tenant)
  - Triggers `updated_at` em `agent_roles` e `teams`
- [x] Script `apps/erp-educacional/scripts/seed_atendimento_permissions.py`:
  - Matrix canônica 3 cargos × 15 módulos × N ações = 165 INSERTs
  - Idempotente (`ON CONFLICT DO UPDATE`)
  - Testado: gera 189 linhas de SQL
- [x] `apps/erp-educacional/src/lib/atendimento/permissions.ts`:
  - `requirePermission`, `assertPermission`, `PermissionDeniedError`
  - `withPermission(module, action)(handler)` — HOC para Route Handlers
  - `loadPermissionsForUser` com cache por request
  - `PERMISSION_MODULES` taxonomia canônica exportada
  - Feature flag `ATENDIMENTO_RBAC_ENABLED` (fail-open quando desligado)
- [x] `apps/erp-educacional/src/hooks/atendimento/use-can.ts`:
  - `useCan(module, action)` + `useAllPermissions()` + `invalidatePermissionsCache`
  - Cache global 5 min TTL + in-flight dedup
- [x] `apps/erp-educacional/src/app/api/atendimento/me/permissions/route.ts`:
  - GET retorna mapa completo `{ "module::action": boolean }` para hidratar `useCan`

### ✅ Fase 2 — Backend APIs (2026-04-21)

- [x] `GET/POST /api/atendimento/roles`
- [x] `GET/PATCH/DELETE /api/atendimento/roles/[id]` (system bloqueia edit/delete)
- [x] `GET/PATCH /api/atendimento/roles/[id]/permissions` (upsert em lote)
- [x] `GET/POST /api/atendimento/teams`
- [x] `GET/PATCH/DELETE /api/atendimento/teams/[id]`
- [x] `POST/DELETE /api/atendimento/teams/[id]/members`
- [x] `GET/POST /api/atendimento/invites` (token 64 hex, TTL 7 dias)
- [x] `DELETE /api/atendimento/invites/[id]` (revoke)
- [x] `GET/POST /api/atendimento/invites/accept?token=`
- [x] `withPermission` aplicado em todas as rotas novas
- [x] Middleware: bypass para `GET /api/atendimento/invites/accept` (aceite sem sessão)

**Observação:** não adicionei matcher específico `/api/atendimento/*` no middleware
— as rotas já passam pelo middleware global (auth Supabase) e `withPermission` é
aplicado no nível do handler (mais granular). Change mínima intencional.

**Pendência:** integrar envio por email (Resend ou Supabase magic link) em
`POST /api/atendimento/invites`. Hoje retorna `accept_url` para o operador
copiar manualmente — OK para FIC single-tenant, upgrade para Fase 2 SaaS.

### ✅ Fase 3 — UI Cargos (2026-04-21)

- [x] Layout `/atendimento/configuracoes` com abas (Cargos / Usuários / Equipes)
- [x] Rota `/atendimento/configuracoes/cargos/page.tsx`
- [x] `components/atendimento/permissions/PermissionMatrix.tsx` (15×5 toggles + bulk por módulo + resumo granted/total)
- [x] Drawer editar cargo (nome, descrição, matrix, copiar permissões de outro cargo, excluir)
- [x] Modal criar novo cargo
- [x] Presets system exibem badge "preset" com cadeado e matrix readOnly

### ⏳ Fase 4 — UI Usuários + Equipes

- [ ] Rota `/atendimento/configuracoes/usuarios/page.tsx`
- [ ] Modal "Convidar usuário" (email + cargo + equipe opcional)
- [ ] Rota `/atendimento/configuracoes/equipes/page.tsx`
- [ ] Modal criar/editar equipe (nome + cor + membros multi-select)
- [ ] Status realtime (`agent_statuses`)

### ⏳ Fase 5 — Testes + PR

- [ ] Unit: `requirePermission('pipelines', 'edit')` por cargo
- [ ] Integration: 403 para Atendente em `POST /api/atendimento/roles`
- [ ] Integration: invite fluxo completo (criar → aceitar → vincular)
- [ ] Feature flag `ATENDIMENTO_RBAC_ENABLED` documentada em `.env.example`
- [ ] PR `feat(atendimento): S6 Cargos + Permissões Granulares + Equipes + Convites`

## Deploy / aplicação

**Ordem de aplicação em Supabase:**
1. Migration `20260421_atendimento_s6_cargos.sql`
2. `python scripts/seed_atendimento_permissions.py | psql "$SUPABASE_DB_URL"` (ou supabase branch)
3. Validar: `SELECT role_id, module, action, granted FROM role_permissions WHERE role_id='00000000-0000-0000-0000-000000000001' LIMIT 5;`

**Variáveis de ambiente novas:**
- `ATENDIMENTO_RBAC_ENABLED=true` (server) — ativa checks em rotas API
- `NEXT_PUBLIC_ATENDIMENTO_RBAC_ENABLED=true` (client) — ativa `useCan` real (senão retorna true em dev)

## Integrações pendentes com outras sessões

- **S4 Kanban** (`flamboyant-lamport`): CRM/pipelines vai precisar de `useCan("pipelines", "edit")` nos botões — aplicar após merge S6
- **S5 Templates** (`flamboyant-lamport-4d5adf`): botões de criar/editar template devem usar `useCan("templates", "create")`
- **Ordem de merge planejada:** A(S4) → C(S6) → B(S5)

## Débitos conhecidos

- Coluna legada `atendimento_agents.role` (TEXT agent/supervisor/admin) ainda em uso pela S1-S3. Deprecar em Fase 2 SaaS após migração de dados.
- RLS permissivo inicial — quando Fase 2 SaaS chegar, apertar políticas para filtrar por `account_id` via JWT claim.
- `agent_invites` não tem fila de reenvio — se primeiro email falhar, operador precisa revogar + criar novo.
