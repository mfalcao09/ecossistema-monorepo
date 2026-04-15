# Sessão 68 — Fix produção: /contratos/analytics freeze DEEP — lightweight query + lazy heatmap + drill-down on-demand (15/03/2026)

- **Objetivo**: Resolver freeze persistente do `/contratos/analytics` MESMO após commits das sessões 66+67. Marcelo confirmou: "Eu já fiz o commit e continua travando"
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). Investigação profunda do data transfer pattern
- **Root cause profundo**: Sessões 66+67 otimizaram computação client-side (Map, memoização, staleTime), mas o problema REAL era a QUERY: `useContracts()` faz `SELECT *, properties:property_id(...), contract_parties(..., people:person_id(...))` — JOINs pesados trazendo TODOS os campos + relações aninhadas para 200 contratos. O JSON payload enorme travava o parser/renderer do browser
- **4 fixes implementados**:
  1. **Fix 1 — useContractsAnalytics() lightweight hook (CRITICAL)**: Nova query local que seleciona APENAS 11 colunas necessárias para analytics (id, status, contract_type, monthly_value, start_date, end_date, adjustment_index, termination_penalty_rate, signing_platform, created_at, property_id). ZERO JOINs. `.limit(500)`, `staleTime: 3min`, `refetchInterval: 10min`. Tipo `AnalyticsContract` dedicado. Substitui `useContracts()` na página
  2. **Fix 2 — Lazy-load ClauseFrictionHeatmap (HIGH)**: Componente carregava 2000 redlining entries no mount. Adicionado estado `showHeatmap` com botão "Carregar Heatmap de Fricção de Cláusulas" — componente só monta sob demanda
  3. **Fix 3 — useDrillDownContracts() on-demand (HIGH)**: Novo hook que carrega contratos COM properties JOIN apenas quando o usuário clica em um KPI (drill-down dialog). `enabled: !!ids`, batch em chunks de 50 IDs, `staleTime: 2min`. Dialog usa `drillDownData` em vez de `contracts` pré-carregados
  4. **Fix 4 — Promise.all() para chunks paralelos (MEDIUM, achado Buchecha)**: `useDrillDownContracts` inicialmente usava `for...of` sequencial para chunks — Buchecha identificou como CRITICAL: 4 chunks sequenciais (~800ms) vs paralelos (~200ms). Convertido para `Promise.all(chunks.map(...)).then(arr => arr.flat())`. Adicionado `.order("created_at", { ascending: false })` em cada chunk
- **Validação Buchecha (MiniMax M2.5)**: Code review aprovado. Identificou sequential chunk fetch como critical (Fix 4). 2 achados menores: missing .order (corrigido) e edge case de tipo (cosmético, não blocker)
- **Build**: 0 erros TypeScript (`npx tsc --noEmit`) ✅
- **Arquivos modificados** (1):
  - `src/pages/ContractAnalytics.tsx` — useContractsAnalytics, useDrillDownContracts, lazy heatmap, Promise.all chunks
- **Impacto estimado**: Payload JSON reduzido ~90% (11 cols flat vs ALL cols + 3 JOINs aninhados). Queries no mount: 4→1 (drill-down + heatmap agora on-demand)
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
