# Sessão 66 — Fix produção: /contratos/ freeze + /contratos/analytics freeze + sidebar modules missing (15/03/2026)

- **Objetivo**: Resolver 3 problemas críticos reportados por Marcelo em produção (`app.intentusrealestate.com.br`): (1) `/contratos/` travando aba, (2) `/contratos/analytics` (Dashboard CLM) travando aba, (3) Módulos faltando na sidebar da empresa master
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). Investigação com agentes paralelos + code review MiniMax
- **Contexto**: Marcelo explicitou que sessão 65 testou o Command Center, mas NÃO era ele o problema — os problemas reais eram /contratos/ e /contratos/analytics
- **6 fixes implementados**:
  1. **Fix 1 — useContracts.ts (CRITICAL)**: Root cause do `/contratos/` freeze. Query sem `.limit()`, sem `staleTime`, buscava TODOS os contratos com JOINs pesados (properties + contract_parties + people). **Fix**: `.limit(200)`, `staleTime: 2 * 60 * 1000`, `refetchInterval: 5 * 60 * 1000`
  2. **Fix 2 — ContractAnalytics.tsx (CRITICAL)**: Root cause do `/contratos/analytics` freeze. 4 queries inline sem `tenant_id`, sem `staleTime`, com limits de 1000-2000 + computação O(n*m) em `riskConcentration`. **Fix**: Todas 4 queries reescritas com `getAuthTenantId()`, `.limit(500)`, `staleTime: 5 * 60 * 1000`, `refetchInterval: 10 * 60 * 1000`. `riskConcentration` otimizado com Map pre-building (O(n+m))
  3. **Fix 3 — AppSidebar.tsx filterByRole (CRITICAL)**: Root cause dos módulos faltando na sidebar. `filterByRole` não tratava `superadmin` como role universal — items com `roles: ["admin", "gerente"]` eram invisíveis para users com `"superadmin"` no array de roles. **Fix**: Adicionado `isSuperadminRole = roles.includes("superadmin")` bypass check
  4. **Fix 4 — useTablePreferences.ts (MEDIUM)**: Sem `staleTime` (default 0, refetch a cada interação). **Fix**: `staleTime: 5 * 60 * 1000`
  5. **Fix 5 — useTablePreferences.ts queryKey (MEDIUM)**: Achado do Buchecha — queryKey `["table-preferences", pageKey]` sem `user.id` poderia causar contaminação de cache cross-user. **Fix**: Import `useAuth`, queryKey expandido para `["table-preferences", pageKey, user?.id ?? "anon"]`, `setQueryData` atualizado com key completa
  6. **Fix 6 — useTablePreferences.ts optimistic update**: `setQueryData` usava key parcial `["table-preferences", pageKey]` que não correspondia à key completa de 3 elementos. **Fix**: Atualizado para `["table-preferences", pageKey, user?.id ?? "anon"]`
- **Validação Buchecha (MiniMax M2.5)**: Code review aprovado para todos os fixes + identificou bug adicional #5 (queryKey cross-user)
- **Build**: 0 erros TypeScript (`npx tsc --noEmit`) ✅
- **Arquivos modificados** (4):
  - `src/hooks/useContracts.ts` — .limit(200), staleTime, refetchInterval
  - `src/pages/ContractAnalytics.tsx` — tenant_id + limits + staleTime + Map optimization (4 queries)
  - `src/components/AppSidebar.tsx` — superadmin bypass in filterByRole
  - `src/hooks/useTablePreferences.ts` — staleTime + user.id queryKey + optimistic update fix
- **Nota técnica**: `useAuth.tsx` `isSuperAdmin` (linha 135) só checa `session?.user?.id === MASTER_UID` (hardcoded `85ba82c5-...`). Já `useSuperAdminView.tsx` checa `user?.id === MASTER_UID || hasRole("superadmin")` (com fallback). Marcelo's user_id é `ba91572c-...` (NÃO é o MASTER_UID), mas tem role `superadmin` no `user_roles`
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
