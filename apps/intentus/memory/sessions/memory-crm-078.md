# Sessão 78 — CRM F1 Item #5: Stalled Deals Detection (~8h, P0) (15/03/2026)

- **Objetivo**: Implementar quinto item da Fase 1 do plano CRM IA-Native (sessão 73): P05 — Detecção de negócios estagnados (Stalled Deals). Alerta automático quando deals ficam parados no pipeline por tempo excessivo, com scoring multi-fator e sugestões de ação via IA
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). Implementação em 7 tasks ao longo de múltiplas continuações de contexto
- **Backend — `supabase/functions/commercial-stalled-deals/index.ts` (CRIADO — ~630 linhas, self-contained, v1)**:
  - **3 actions**: `detect` (lista deals estagnados com scoring), `get_dashboard` (KPIs agregados + top stalled + breakdown by status/type), `suggest_actions` (sugestões IA por deal)
  - **4-factor stall scoring** (pesos totalizam 100%):
    1. `days_factor` (40%): Ratio days_in_stage / threshold_days
    2. `contact_factor` (25%): Dias desde último contato (via interactions)
    3. `value_factor` (20%): Penaliza deals de alto valor mais parados
    4. `criticality_factor` (15%): Peso por estágio (aprovação/assinatura = 0.9, análise = 0.7, rascunho = 0.3)
  - **Thresholds dinâmicos**: `getPipelineThresholds()` usa `wip_limit` das `pipeline_columns` quando disponível, fallback para `DEFAULT_THRESHOLDS` (12 statuses com dias padrão: rascunho=7, analise=5, assinatura=3, etc.)
  - **Stall levels**: warning (score 50-99% do threshold), critical (score ≥100% do threshold)
  - **IA suggestions**: OpenRouter → Gemini 2.0 Flash (JSON mode, temp 0.3) com contexto do deal (tipo, status, dias parado, último contato, valor). Fallback rule-based (5 templates: contato, escalação, ajuste, reagendamento, revisão)
  - **TERMINAL_STATUSES**: `concluido`, `cancelado` — excluídos da detecção
  - **Self-contained**: Inline CORS whitelist (`app.intentusrealestate.com.br` + `intentus-plataform.vercel.app`), auth/tenant via profiles.user_id
  - **Deploy**: v1 via Supabase MCP (ID: `aec175bb-5538-4b74-8734-96e9da3f00f8`, ACTIVE, verify_jwt: false)
- **Frontend hook — `src/hooks/useStalledDeals.ts` (CRIADO — ~145 linhas)**:
  - Types: `StallLevel`, `SuggestionUrgency`, `StallFactors`, `StalledDeal`, `StalledDealsDashboard`, `ActionSuggestion`, `SuggestActionsResult`
  - Constants: `STALL_LEVEL_LABELS/COLORS/BG`, `URGENCY_LABELS/COLORS`
  - Query hooks: `useStalledDealsDashboard(options?)` (staleTime 3min, refetchInterval 5min), `useDetectStalledDeals(options?)`
  - Mutation hook: `useSuggestStalledActions()` com pulse event wiring (`emitPulseEvent` event_type: "automation_executed", metadata.action: "stalled_deal_suggestions")
- **Frontend UI — `src/components/deals/StalledDealsWidget.tsx` (CRIADO — ~326 linhas)**:
  - `StalledDealsWidget`: Collapsible amber-themed card com 5 KPIs no header (total stalled, critical count, warning count, avg days, value at risk). Lista de deals estagnados com StallScoreBar, badges de nível, info do deal, botão "Sugerir" com IA
  - `SuggestionsDialog`: Modal que chama `useSuggestStalledActions()` on open. Exibe action, urgency badge, reason, talking points, recommended_next_status
  - `StallBadge`: Badge inline para kanban cards (TrendingDown icon, dias estagnado, cor por nível)
  - `useStallBadgeMap(dealType?)`: Hook que retorna Map<dealId, StalledDeal> para lookup O(1) nos cards do kanban
  - `StallScoreBar`: Barra visual de progresso com cor por nível (amber/red)
- **Frontend integração — `src/pages/DealsList.tsx` (MODIFICADO)**:
  - Import: `StalledDealsWidget`, `useStallBadgeMap`, `StallBadge`
  - `activeDealType` useMemo: Escopa detecção ao deal_type do pipeline ativo
  - `stallMap = useStallBadgeMap(activeDealType)`: Lookup O(1) por dealId
  - `StalledDealsWidget` renderizado entre info badge do funil e KanbanBoard
  - `renderLabels` prop: Inclui `StallBadge` para deals estagnados ao lado das labels existentes
- **Build**: 0 erros TypeScript ✅
- **Arquivos criados** (3):
  - `supabase/functions/commercial-stalled-deals/index.ts` — Edge Function self-contained (~630 linhas)
  - `src/hooks/useStalledDeals.ts` — hook central stalled deals (~145 linhas)
  - `src/components/deals/StalledDealsWidget.tsx` — widget + dialog + badge + hook map (~326 linhas)
- **Arquivos modificados** (1):
  - `src/pages/DealsList.tsx` — integração stalled deals (imports, stallMap, widget, StallBadge no kanban)
- **Edge Functions — Versões atualizadas**:
  - `commercial-stalled-deals` → version 1 (3 actions, 4-factor scoring, IA suggestions, self-contained, CORS whitelist)
- **Cronograma CRM IA-Native**: F1 Item #5 ✅ concluído (P05 Stalled Deals Detection). **CRM F1: 5/13 itens concluídos**. Próximo: F1 Item #6
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
