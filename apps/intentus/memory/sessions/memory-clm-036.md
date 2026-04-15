# Sessão 36 — Fixes Auditoria Sessão 34: Fase 2 Arquitetura (12/03/2026)

- **Objetivo**: Implementar Fase 2 (Arquitetura) do plano de ação da auditoria sessão 34, usando MiniMax como pair programmer (Claudinho + Buchecha)
- **Metodologia**: Claude = Claudinho (commander/planner/reviewer), MiniMax = Buchecha (heavy lifter/code generator). Claude SEMPRE revisa output do MiniMax antes de aplicar. Nicknames de dupla musical brasileira.
- **3 sub-tasks implementadas**:
  1. **Phase 2.1 — Decomposição do ClmCommandCenter.tsx** (~907 linhas → componentes modulares):
     - 8 componentes extraídos para `src/features/command-center/`
     - ClmCommandCenter.tsx refatorado como orchestrator
  2. **Phase 2.2 — Middleware compartilhado para Edge Functions**:
     - **CRIADO**: `supabase/functions/_shared/middleware.ts` (~241 linhas)
     - `createHandler()`: Factory function que encapsula CORS whitelist, auth/tenant resolution, action routing, error handling
     - `HandlerContext`: Tipo com `supabase`, `user`, `tenantId`, `body`, `json()`, `error()` helpers
     - CORS: Env var `ALLOWED_ORIGINS` + fallback regex para dev/preview
     - **4 Edge Functions migradas**: Removido boilerplate CORS/auth/tenant duplicado (~100-150 linhas cada), agora usam `createHandler({ action: handlerFn })`
     - **Deployadas**: contract-api v13, approvals-api v11, obligations-api v11, templates-api v8
  3. **Phase 2.3 — In-memory tenant cache (tenantUtils.ts)**:
     - **Problema**: 95+ arquivos chamam `getAuthTenantId()` que fazia 2 queries (getUser + profiles) a cada chamada
     - **Solução**: Cache module-level com 30min TTL + dedup guard (thundering herd prevention)
     - `resolveAuthCached()`: Cache hit → retorna imediato. In-flight → reusa promise. Miss → 2 queries + cache
     - Auto-invalidação: `supabase.auth.onAuthStateChange` em SIGNED_IN/SIGNED_OUT/USER_UPDATED/TOKEN_REFRESHED
     - `getAuthContext()`: Nova export (userId + tenantId cached)
     - `invalidateAuthCache()`: Nova export para invalidação manual
     - `clmApi.ts`: `resolveAuthContext()` simplificado para usar `getAuthContext()` do cache compartilhado
     - `useAuth.tsx`: `refetchTenant()` chama `invalidateAuthCache()` para sincronizar com superadmin tenant switch
     - **Bug encontrado pelo MiniMax (Buchecha)**: `SIGNED_IN` faltava na lista de eventos de invalidação — sem ele, tenant de user A poderia vazar para user B no login switch. Fix aplicado.
- **Build**: 0 erros TypeScript
- **Arquivos criados**:
  - `supabase/functions/_shared/middleware.ts` — middleware compartilhado (241 linhas)
- **Arquivos modificados** (8 arquivos):
  - `src/lib/tenantUtils.ts` — reescrito com cache 30min TTL + dedup + auto-invalidação (19→103 linhas)
  - `src/lib/clmApi.ts` — resolveAuthContext usa getAuthContext() do cache compartilhado
  - `src/hooks/useAuth.tsx` — invalidateAuthCache() integrado em refetchTenant()
  - `supabase/functions/clm-contract-api/index.ts` — migrado para middleware compartilhado
  - `supabase/functions/clm-approvals-api/index.ts` — migrado para middleware compartilhado
  - `supabase/functions/clm-obligations-api/index.ts` — migrado para middleware compartilhado
  - `supabase/functions/clm-templates-api/index.ts` — migrado para middleware compartilhado
  - `CLAUDE.md` — atualizado com sessão 36
