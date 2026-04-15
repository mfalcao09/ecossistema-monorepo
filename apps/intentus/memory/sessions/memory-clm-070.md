# Sessão 70 — Rewrite completo /contratos/analytics: ClmAnalytics do zero com 11 métricas (15/03/2026)

- **Objetivo**: Reescrever a página `/contratos/analytics` completamente do zero — a página antiga (`ContractAnalytics.tsx`, ~1010 linhas) causou browser freeze em 5 sessões consecutivas (64-69) e os fixes incrementais não resolveram. Marcelo decidiu: "reescrever do zero, não copie nenhum código"
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). Marcelo escolheu 9 métricas + 2 extras sugeridas por Buchecha = 11 métricas
- **Decisão do Marcelo**: "as correções que estamos aplicando não estão funcionando. Então, reescrever uma nova, do zero me parece uma boa opção. Comece agora, inclua as sugestões do Buchecha"
- **Página antiga DELETADA**: `src/pages/ContractAnalytics.tsx` (~1010 linhas) — removida completamente
- **Arquitetura nova** (2 arquivos, separação data/UI):
  1. **`src/hooks/useAnalyticsMetrics.ts`** (CRIADO — ~540 linhas):
     - Helper `num(v: unknown): number` — parsing seguro de PostgreSQL numeric→number (lição sessões 68-69)
     - `QUERY_OPTS` constante compartilhada: `staleTime: 3min`, `refetchInterval: 10min`, `retry: 1`
     - **6 data hooks** (queries focadas, 11-15 colunas, ZERO JOINs pesados, tenant_id, `.limit()`):
       - `useContractsForAnalytics()` — 11 colunas, limit 500
       - `useInstallmentsForAnalytics()` — 6 colunas, limit 2000, status pendente/atrasada
       - `useObligationsForAnalytics()` — 5 colunas, limit 1000
       - `useLifecycleEventsForAnalytics()` — 7 colunas, limit 1000, últimos 12 meses
       - `useRedliningForAnalytics()` — 4 colunas, limit 2000
       - `useApprovalsForAnalytics()` — 5 colunas, limit 1000
     - **1 drill-down hook**: `useDrillDownContracts(ids)` — carrega WITH properties JOIN apenas on-demand, chunks de 50, `Promise.all()` paralelo
     - **11 computed metric hooks** (todos `useMemo`, Map-based O(n), single-pass aggregation):
       1. `useRevenueLeakage` — contratos ativos sem parcelas pendentes
       2. `useLiabilityExposure` — soma multa rescisória × valor mensal
       3. `useRiskConcentration` — TOP 8 contratos por valor (Pareto)
       4. `useClauseFrictionHeatmap` — redlining por cláusula (clause_name)
       5. `useApprovalSLA` — aprovações pendentes > 48h
       6. `useReworkIndex` — events status_change com reversão (para status anterior)
       7. `useStalledContracts` — contratos em rascunho/negociação > 15 dias
       8. `useMonthlyVolumeTrend` — contratos criados por mês (12 meses)
       9. `useRevenueByType` — soma valor mensal por contract_type
       10. `useRevenueAtRisk` — contratos expirando em 90 dias × valor mensal [sugestão Buchecha]
       11. `useApprovalVelocity` — tempo médio de aprovação por gestor [sugestão Buchecha]
  2. **`src/pages/ClmAnalytics.tsx`** (CRIADO — ~480 linhas):
     - Layout: Header → 6 KPI cards → 2 charts → 3 tables → 3 tables → lazy heatmap
     - 6 KPI Cards: Revenue Leakage (red), Exposição Passivo (orange), Receita em Risco (amber), SLA Aprovações fora, Índice Retrabalho, Contratos Estagnados
     - 2 Charts (Recharts): Volume Mensal (BarChart) + Revenue por Tipo (BarChart horizontal)
     - 3 Tables: Concentração TOP 8 (% do total), SLA Aprovações (dias pendente), Receita em Risco (dias para expirar)
     - 3 Tables: Retrabalho (reversões), Contratos Estagnados (dias parado), Velocidade Aprovação por Gestor
     - `DrillDownDialog`: Carrega contratos WITH properties JOIN apenas quando usuário clica (on-demand)
     - `MetricCard`: Componente reutilizável com ícone, label, valor formatado, cor customizável
     - Lazy heatmap: Botão "Carregar Heatmap" — componente só monta sob demanda
     - Error state: AlertTriangle + mensagem quando queries falham
     - Loading: Badge spinner no header
     - Branding: Intentus gold #e2a93b, dark theme compatible
- **Rota atualizada**: `App.tsx` — import `ClmAnalytics` substituiu `ContractAnalytics`, rota `/contratos/analytics` mantida
- **Sidebar**: Sem alterações — já apontava para `/contratos/analytics` com título "Dashboard CLM"
- **Validação Buchecha (MiniMax M2.5)**: Code review aprovado. Minor warnings (não críticos): potencial N+1 no drill-down (mitigado por staleTime), heatmap UX delay no first load, limites inconsistentes entre queries, falta error boundaries individuais por widget. Avaliação geral: "rewrite bem arquitetado que endereça diretamente os bugs de performance documentados"
- **Build**: 0 erros TypeScript (`npx tsc --noEmit`) ✅
- **Arquivos criados** (2):
  - `src/hooks/useAnalyticsMetrics.ts` — 6 data hooks + 11 computed metrics (~540 linhas)
  - `src/pages/ClmAnalytics.tsx` — 11 métricas UI (~480 linhas)
- **Arquivos deletados** (1):
  - `src/pages/ContractAnalytics.tsx` — ~1010 linhas (causava browser freeze em 5 sessões)
- **Arquivos modificados** (1):
  - `src/App.tsx` — import ContractAnalytics→ClmAnalytics, route element atualizado
- **Impacto**: Página que travava o navegador em 5 sessões agora carrega com queries focadas (11 cols, 0 JOINs), computações O(n) com Maps, componentes pesados lazy-loaded, e parsing numérico correto
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
