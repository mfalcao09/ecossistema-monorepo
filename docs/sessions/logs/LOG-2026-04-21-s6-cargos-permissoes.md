# LOG — 2026-04-21 · Atendimento S6 · Cargos + Permissões Granulares

**Sessão:** Atendimento S6 (paridade Nexvy)
**Worktree:** `apps/erp-educacional/.claude/worktrees/wizardly-jones-67ac24`
**Branch:** `feature/atnd-s6-cargos`
**PR:** [mfalcao09/ecossistema-monorepo#45](https://github.com/mfalcao09/ecossistema-monorepo/pull/45)
**Duração:** 1 sessão única (Fases 1-5 completas)
**Briefing:** `docs/sessions/BRIEFING-ATND-S6-CARGOS.md`

## Missão

Implementar sistema de cargos e permissões granulares do módulo Atendimento (13+ módulos × 5 ações × 3 presets + customs), equipes com multi-membership, e fluxo de convites por token. Base da Fase 2 SaaS (Nexvy whitelabel).

## Entregas por fase

### Fase 1 — Fundação (`5cc9b1f`, +892 linhas)
- `apps/erp-educacional/supabase/migrations/20260421_atendimento_s6_cargos.sql`
  - 5 tabelas novas: `agent_roles`, `role_permissions`, `teams`, `team_members`, `agent_invites`
  - `atendimento_agents.role_id` nullable coexistindo com `role` TEXT legado (S1)
  - 3 presets `is_system=true` com UUIDs fixos `...00{1,2,3}`
  - RLS permissivo inicial (FIC single-tenant); triggers `updated_at`
- `apps/erp-educacional/scripts/seed_atendimento_permissions.py`
  - Matrix canônica 15 módulos × N ações × 3 presets = 165 INSERTs idempotentes
- `apps/erp-educacional/src/lib/atendimento/permissions.ts`
  - `requirePermission`, `assertPermission`, `PermissionDeniedError`
  - `withPermission(module, action)(handler)` HOC
  - `PERMISSION_MODULES` taxonomia exportada
  - Feature flag `ATENDIMENTO_RBAC_ENABLED` (fail-open off)
- `apps/erp-educacional/src/hooks/atendimento/use-can.ts` — hook client com cache 5min
- `apps/erp-educacional/src/app/api/atendimento/me/permissions/route.ts` — hidrata useCan

### Fase 2 — Backend APIs (`6d2a940`, +753 linhas)
- **roles**: GET/POST + `[id]` GET/PATCH/DELETE + `[id]/permissions` GET/PATCH
- **teams**: GET/POST + `[id]` GET/PATCH/DELETE + `[id]/members` POST/DELETE
- **invites**: GET/POST + `[id]` DELETE (revoke) + `accept` GET/POST
- Token: crypto.randomBytes(32).hex (64 chars), TTL 7 dias
- `withPermission` aplicado em TODAS as rotas novas
- Middleware change mínima: bypass de `GET /api/atendimento/invites/accept` (landing sem sessão)

### Fase 3 — UI Cargos + PermissionMatrix (`686c78b`, +724 linhas)
- Layout `/atendimento/configuracoes` com abas
- `configuracoes/cargos/page.tsx`:
  - Cards + drawer editor com nome/descrição/matrix/copiar-de-outro/excluir
  - Modal "Novo cargo" custom
  - Presets `is_system` com edit readOnly + badge cadeado
- `components/atendimento/permissions/PermissionMatrix.tsx` — carro-chefe visual:
  - Tabela 15 × 5 com toggles por célula
  - Bulk toggle por módulo ("liberar tudo"/"tirar tudo")
  - Resumo granted/total por linha
  - Sticky first column para mobile

### Fase 4 — UI Usuários + Equipes + APIs users (`1b14c03`, +980 linhas)
- APIs: `GET /users`, `PATCH/DELETE /users/[id]` (soft-disable)
- `configuracoes/usuarios/page.tsx`:
  - Tabela convites pendentes com revoke inline
  - Tabela agents ativos (avatar, cargo inline-edit, equipes badge, status color dot)
  - Modal "Convidar" — gera accept_url copiável
- `configuracoes/equipes/page.tsx`:
  - Cards com bola de cor + count membros
  - Modal criar/editar com 8 cores preset + multi-select agents
  - Diff incremental de membros no save

### Fase 5 — Testes + flag + PR (`c402429`, +274 linhas)
- Unit `__tests__/atendimento-permissions.test.ts`: fail-open/closed, matriz por cargo, assertPermission, loadPermissionsForUser
- Smoke `__tests__/atendimento-permissions-smoke.test.ts`: taxonomia canônica
- `.env.example`: `ATENDIMENTO_RBAC_ENABLED` + variante pública documentadas
- PR #45 aberto para main

## Decisões arquiteturais

1. **Tabelas dedicadas ao módulo** — não reusei o RBAC geral do ERP (`src/lib/supabase/rbac.ts`) porque Atendimento precisa virar SaaS Nexvy standalone
2. **Coluna `atendimento_agents.role` TEXT legada mantida** — `role_id` UUID coexiste até migração Fase 2
3. **Middleware change mínima** — permissão fica no handler via `withPermission` (granular), não no middleware
4. **Presets `is_system=true`** — rename permitido, permissões readOnly, delete bloqueado
5. **Feature flag default OFF** — backward-compat com S1-S5 antes do rollout

## Skills ignoradas (com justificativa)

Hooks do Vercel plugin dispararam por filename em vários momentos. Ignorados por ruído:
- `auth` / `routing-middleware` no `middleware.ts` (change aditiva, não redesign)
- `vercel-storage` em `.sql` (Supabase ≠ Vercel Storage)
- `nextjs` / `next-cache-components` / `vercel-functions` em route handlers (padrão já estabelecido no codebase)
- `react-best-practices` em hooks simples (useState/useEffect sem APIs exóticas)
- `bootstrap` / `env-vars` em `.env.example` (só adicionando 2 vars locais)
- Sugestão de rename `middleware.ts → proxy.ts` (Next 16) — fora de escopo S6

Memória `feedback_vercel_hooks` cobre esse padrão.

## Pendências registradas em `docs/sessions/PENDENCIAS.md`

- P-050: aplicar migration em Supabase branch + prod
- P-051: rodar seed Python (165 INSERTs)
- P-052: ativar `ATENDIMENTO_RBAC_ENABLED` em stages
- P-053: integrar envio de convite via **Microsoft Graph API** (app FIC já no vault)
- P-054: deprecar `atendimento_agents.role` TEXT legado (Fase 2)
- P-055: apertar RLS por `account_id` (Fase 2 SaaS)
- P-056: integration tests com DB real pós-staging
- P-057: realtime de `agent_statuses` via Supabase Realtime

## Integrações com sessões paralelas

Ordem de merge planejada no briefing: A(S4) → **C(S6 esta)** → B(S5).
- S4 (Kanban) já mergeou via PR #44
- S5 (Templates) está em `feature/atnd-s5-templates`
- Pós-merge S6: aplicar `useCan("pipelines", "edit")` no Kanban do S4 e `useCan("templates", "create")` nos botões do S5

## Arquivos principais

```
apps/erp-educacional/
├── supabase/migrations/20260421_atendimento_s6_cargos.sql
├── scripts/seed_atendimento_permissions.py
├── src/
│   ├── lib/atendimento/permissions.ts
│   ├── hooks/atendimento/use-can.ts
│   ├── middleware.ts                           (change aditiva)
│   ├── components/atendimento/permissions/PermissionMatrix.tsx
│   ├── app/api/atendimento/
│   │   ├── me/permissions/route.ts
│   │   ├── roles/route.ts + [id]/route.ts + [id]/permissions/route.ts
│   │   ├── teams/route.ts + [id]/route.ts + [id]/members/route.ts
│   │   ├── users/route.ts + [id]/route.ts
│   │   └── invites/route.ts + [id]/route.ts + accept/route.ts
│   └── app/(erp)/atendimento/configuracoes/
│       ├── layout.tsx + page.tsx (redirect)
│       ├── cargos/page.tsx
│       ├── usuarios/page.tsx
│       └── equipes/page.tsx
├── __tests__/
│   ├── atendimento-permissions.test.ts
│   └── atendimento-permissions-smoke.test.ts
├── .env.example                                (+ATENDIMENTO_RBAC_ENABLED)
└── docs/PENDENCIAS-S6.md
```

## Estatísticas

- **5 commits**, ~3.600 linhas novas
- **5 tabelas** novas + 1 ALTER
- **10 rotas API** App Router
- **3 páginas UI** + 1 component carro-chefe
- **2 arquivos de teste** Vitest
- Sessão executada em turno único sem interrupção
