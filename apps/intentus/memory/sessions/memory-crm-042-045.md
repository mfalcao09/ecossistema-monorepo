# Sessão 42-45 — Fixes Módulo Comercial: 4 Fases Completas (12/03/2026)

- **Objetivo**: Implementar TODAS as 4 fases do plano de ação do diagnóstico comercial (sessão 39), sem parar, usando MiniMax como pair programmer (Claudinho + Buchecha)
- **Metodologia**: Claude = Claudinho (commander/planner/reviewer), MiniMax = Buchecha (heavy lifter/code generator). Claude SEMPRE revisa output do MiniMax antes de aplicar. Execução contínua com auto-save após cada fase.
- **Fase 1 — Segurança (~6h)** ✅:
  - **SEC-01**: Removidas credenciais hardcoded de OUTRO projeto Supabase em `MarketEvaluations.tsx` — substituídas por `getAuthTenantId()` do projeto correto
  - **SEC-02 a SEC-07**: Adicionado filtro `tenant_id` em 7 hooks sem isolamento multi-tenant: `useLabels`, `useCommissionSplits`, `useProfiles`, `useDealCardFeatures`, `useSalesMirror`, `useSaasPipeline`, `useMyGoals`
  - **SEC-08**: CORS whitelist em 3 Edge Functions comerciais: `commercial-ai-insights`, `relationship-ai-insights`, `default-risk-ai` — env var `ALLOWED_ORIGINS` + regex para dev/preview
  - **Shared AI helpers**: Criado `supabase/functions/_shared/resolve-persona.ts` com `resolvePersona()`, `callGemini()`, `logInteraction()` — elimina duplicação de código IA entre 3 EFs
  - **3 Edge Functions re-deployadas** com CORS + shared helpers
- **Fase 2 — Bugs Críticos (~8h)** ✅:
  - **BUG-01**: `BrokerGoals` — mock progress (`charCodeAt(0) % 100`) substituído por cálculo real via query batch (`useMyGoals` com métricas reais: deals concluídos, valor total vendas, novos leads, visitas)
  - **BUG-02**: `DealMessagesTab` — `commentTarget` agora enviado corretamente na mutation insert
  - **BUG-03**: `CommercialReports` — status `"fechado"` (inexistente) substituído por `"concluido"` (correto)
  - **BUG-04**: `DealsList` — `aprovado_comercial` removido da coluna duplicada no Kanban
  - **BUG-05**: `KanbanBoard` — lógica de drop multi-status melhorada (verifica se status atual é válido na coluna destino antes de forçar `statuses[0]`)
  - **BUG-06**: `useMyGoals` — `volume_vendas` agora soma `proposed_value` em vez de contar registros
  - **BUG-07**: `relationship-ai-insights` — `.single()` → `.maybeSingle()` na persona lookup
  - **ARCH-02**: 2 Edge Functions migradas de Lovable AI Gateway → OpenRouter (Gemini 2.0 Flash): `commercial-ai-insights`, `relationship-ai-insights`. Removida dependência de `LOVABLE_API_KEY`
- **Fase 3 — Arquitetura (~10h)** ✅:
  - **ARCH-03/PERF-01**: `useCommercialDashboard` — tenant_id adicionado em todas as 8 queries Supabase para isolamento multi-tenant correto
  - **ARCH-04**: `useMyGoals` — N+1 queries eliminadas com batch queries (1 query por métrica em vez de 1 query por meta)
  - **ARCH-05**: `useDealAttachments` — auth duplicada eliminada, usa `getAuthContext()` do cache compartilhado
  - **Nota**: Server-side aggregation via Edge Function (ARCH-03 completo) planejado como melhoria futura — tenant_id fix já resolve o problema de segurança imediato
- **Fase 4 — Qualidade (~8h)** ✅:
  - **TS-01**: `deal: any` → `DealRequest` em 6 arquivos:
    1. `DealAssignment.tsx` — `deal: any` → `deal: DealRequest`
    2. `DealDetailsTab.tsx` — `deal: any` → `deal: DealRequest`
    3. `DealActionsTab.tsx` — `deal: any` → `deal: DealRequest`
    4. `DealDetailDialog.tsx` — 5 ocorrências: props + OptionsMenu + AddToCardPopover + LocationBlock
    5. `KanbanBoard.tsx` — `deals: any[]` → `deals: DealRequest[]` + `deal: any` → `deal: DealRequest` + removidas anotações `: any` redundantes em callbacks
    6. `IntakeKanban.tsx` — `Map<string, any>` → `Map<string, DealRequest>` + `deal: any` → `deal: DealRequest` + `navigate: any` → `navigate: (path: string) => void`
  - **TS-02 (tipos gerados Supabase)**: Deferido — requer `supabase gen types` CLI, afeta 26+ arquivos. Melhoria codebase-wide, não localizada
  - **TS-03**: Confirmado já corrigido na Fase 1 — sem `as unknown as` em useCommissionSplits
  - **UX-01**: Confirmado já corrigido em continuação anterior — labels SaaS-specific em useSaasPipeline
- **Build**: 0 erros TypeScript após todas as 4 fases ✅
- **Arquivos modificados** (~25+ arquivos total nas 4 fases):
  - **Fase 1**: MarketEvaluations.tsx, useLabels.ts, useCommissionSplits.ts, useProfiles.ts, useDealCardFeatures.ts, useSalesMirror.ts, useSaasPipeline.ts, useMyGoals.ts, commercial-ai-insights/index.ts, relationship-ai-insights/index.ts, default-risk-ai/index.ts, _shared/resolve-persona.ts (CRIADO)
  - **Fase 2**: BrokerGoals.tsx, useMyGoals.ts, DealMessagesTab.tsx, CommercialReports.tsx, DealsList.tsx, KanbanBoard.tsx, relationship-ai-insights/index.ts, commercial-ai-insights/index.ts
  - **Fase 3**: useCommercialDashboard.ts, useMyGoals.ts, useDealAttachments.ts
  - **Fase 4**: DealAssignment.tsx, DealDetailsTab.tsx, DealActionsTab.tsx, DealDetailDialog.tsx, KanbanBoard.tsx, IntakeKanban.tsx
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
