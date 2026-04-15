# Sessão 82 — CRM F1 Item #9: Pipeline Analytics Dashboard (~10h, P0) (15/03/2026)

- **Objetivo**: Implementar nono item da Fase 1 do plano CRM IA-Native (sessão 73): P06 — Pipeline Analytics Dashboard. Dashboard analítico completo do funil comercial com 11 métricas computadas client-side, seguindo o padrão comprovado do `useAnalyticsMetrics.ts` (sessão 70)
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). 100% frontend — sem Edge Function necessária. Todas as métricas computadas client-side de tabelas existentes (`deal_requests`, `deal_request_history`, `pipeline_templates`)
- **Decisão arquitetural**: Seguir padrão da sessão 70 (CLM Analytics rewrite): lightweight queries (poucas colunas, ZERO JOINs), `staleTime`/`refetchInterval`, `useMemo` com Map-based O(n), lazy-load componentes pesados, `Number()` parsing para PostgreSQL numeric
- **2 arquivos criados**:
  1. **`src/hooks/useCommercialAnalytics.ts`** (CRIADO — ~546 linhas): Hook central Pipeline Analytics
     - Helper `num()` para PostgreSQL numeric→number parsing, `fmtBRL()` currency, `monthKey()` date grouping
     - `QUERY_OPTS` compartilhado: staleTime 3min, refetchInterval 10min, retry 1
     - `STAGE_PROBABILITY` map para 14 statuses (0.00-1.00)
     - **3 data hooks** (lightweight, ZERO JOINs, `.limit()`, `tenant_id`): `useDealsForAnalytics()` (12 cols, limit 500), `useHistoryForAnalytics()` (5 cols, limit 2000), `usePipelinesForAnalytics()` (4 cols)
     - **8 computed metric hooks** (todos `useMemo`, Map-based O(n)): `usePipelineVelocity`, `useWeightedPipeline`, `useConversionFunnel`, `useWinLossTrends`, `useDealAging`, `usePipelineForecast`, `useActivityVelocity`, `useRevenueByPipeline`
     - **1 summary hook**: `useSummaryKPIs` (8 KPIs: activeDeals, totalPipelineValue, wonValue, winRate, avgCycleDays, movesThisWeek, wonCount, lostCount)
     - Constants: `WON_STATUSES`, `LOST_STATUSES`, `TERMINAL_STATUSES`, `STAGE_LABELS`
  2. **`src/pages/comercial/PipelineAnalytics.tsx`** (CRIADO — ~465 linhas): Página completa Pipeline Analytics
     - Header com botão voltar para `/comercial/negocios`
     - 6 KPI Cards: Pipeline Total, Ganhos, Win Rate, Ciclo Médio, Movimentações Semana, Previsão Receita
     - 3 Charts (Recharts): Funil de Conversão (BarChart), Win/Loss Tendência 6m (BarChart stacked), Velocidade de Atividade 6 semanas (BarChart)
     - 3 Tables: Pipeline Ponderado por Estágio, Aging de Negócios por Fase, Revenue por Pipeline
     - Error state UI com AlertTriangle para todos os 3 hooks
     - Loading badge spinner no header
     - Branding Intentus (gold #e2a93b)
- **Rota + Sidebar**: `/comercial/analytics` registrada em `App.tsx`. Item "Pipeline Analytics" (BarChart3 icon) no sidebar com roles admin/gerente, module comercial_basico
- **MiniMax (Buchecha) code review — 5 fixes aplicados**:
  1. **useActivityVelocity O(6n)→O(n)**: 6 passes separados (1 por semana) convertidos para single-pass bucket approach com `Math.floor((t - sixWeeksAgo) / MS_PER_WEEK)`
  2. **useSummaryKPIs 3×filter→single-pass**: 3 chamadas `.filter()` separadas (won, lost, active) convertidas para single-pass `for...of` com classificação inline
  3. **Error handling completo**: Adicionado `isError` destructuring para `useHistoryForAnalytics` e `usePipelinesForAnalytics` (antes só deals tinha error handling)
  4. **Unused import cleanup**: Removido `XCircle` não utilizado do import de lucide-react
  5. **Accessibility**: Adicionado `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label` nas barras de progresso de revenue por pipeline
  - **4 false positives descartados**: Missing `num()` (já aplicado no `.map()`), mutation de memoized object (criado dentro do mesmo useMemo), `navigate` unused (usado na linha 148), stale date (intencional com staleTime)
- **Verificação pós-implementação (sessão 84)**: Buchecha revisou ambos os arquivos novamente. useCommercialAnalytics.ts: 6 achados, todos false positives (tenant_id presente linha 189, num() trata NaN linha 31, ConversionFunnel é O(n) Map-based). PipelineAnalytics.tsx: 10 achados, todos false positives (keys estáveis, STAGE_COLORS no module level, error handling cobre 3 hooks, empty states em todas as seções, Deal Aging lazy-loaded). Zero fixes adicionais necessários
- **Build**: 0 erros TypeScript (`npx tsc --noEmit`) ✅
- **Arquivos criados** (2):
  - `src/hooks/useCommercialAnalytics.ts` — 3 data hooks + 8 computed metrics + 1 summary (~546 linhas)
  - `src/pages/comercial/PipelineAnalytics.tsx` — 11 métricas UI (~465 linhas)
- **Arquivos modificados** (2):
  - `src/App.tsx` — import + rota `/comercial/analytics`
  - `src/components/AppSidebar.tsx` — item sidebar "Pipeline Analytics" com BarChart3 icon
- **Cronograma CRM IA-Native**: F1 Item #9 ✅ concluído (P06 Pipeline Analytics). **CRM F1: 9/13 itens concluídos**. Próximo: F1 Item #10
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
