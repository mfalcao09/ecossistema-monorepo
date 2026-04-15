# Sessão 67 — Fix produção: /contratos/analytics freeze persistente (15/03/2026)

- **Objetivo**: Resolver freeze persistente do `/contratos/analytics` após fixes da sessão 66. Marcelo reportou que a página continuava travando o navegador
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). Investigação profunda + code review MiniMax
- **Root cause**: Fixes da sessão 66 (tenant_id, limits, staleTime) estavam no código mas 3 problemas adicionais persistiam:
  1. `revenueLeakage` useMemo com O(n*m) — `auditTrail.filter().sort()` aninhado dentro de `activeContracts.filter()` (potencialmente 500×2000 = 1M operações)
  2. `useAllRedlining()` sem staleTime — refetchava 2000 registros a cada window focus
  3. onClick handlers inline com `.filter()` em arrays grandes durante render
- **3 fixes implementados**:
  1. **Fix 1 — revenueLeakage O(n*m) → O(n+m) (CRITICAL)**: Pre-build `latestAdjustMap` (Map<contract_id, created_at>) em single pass do auditTrail, depois lookup O(1) por contrato em vez de filter+sort
  2. **Fix 2 — useAllRedlining staleTime (MEDIUM)**: Adicionado `staleTime: 5 * 60 * 1000`, `refetchInterval: 10 * 60 * 1000` — elimina refetch constante no window focus
  3. **Fix 3 — Pre-computed Maps para onClick (MEDIUM)**: 3 novos useMemo: `personContractIdsMap` (person_id→contract_ids[]), `liabilityContractIds` (ids filtrados), `statusContractIdsMap` (status→contract_ids[]). onClick handlers agora usam Map.get() O(1) em vez de .filter() O(n) inline
- **Validação Buchecha (MiniMax M2.5)**: Code review aprovado. 2 achados do Buchecha são false positives no contexto Intentus: (1) `adjustment_index` é string ("IGPM"/"IPCA"), não número — `!c.adjustment_index` correto. (2) `created_at` é ISO 8601 do Supabase — string comparison funciona perfeitamente
- **Build**: 0 erros TypeScript (`npx tsc --noEmit`) ✅
- **Arquivos modificados** (2):
  - `src/pages/ContractAnalytics.tsx` — revenueLeakage Map, 3 pre-computed Maps, 3 onClick handlers atualizados
  - `src/hooks/useContractRedlining.ts` — useAllRedlining staleTime + refetchInterval
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
