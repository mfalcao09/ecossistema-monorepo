# Sessão 83 — CRM F1 Item #10: G01 Metas Inteligentes (~8h, P0) (15/03/2026)

- **Objetivo**: Implementar décimo item da Fase 1 do plano CRM IA-Native (sessão 73): G01 — Metas Inteligentes. Upgrade do sistema BrokerGoals com multi-period (semanal/mensal/trimestral/anual), 7 métricas expandidas, historical tracking via goal_snapshots, goal templates e performance trends
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). Implementação em 6 tasks ao longo de múltiplas continuações de contexto
- **Database migrations** (via Supabase MCP):
  - Tabela `broker_goals` expandida: 7 novas colunas (`is_template`, `template_name`, `template_description`, `created_by`, `description`, `period_start`, `period_end` já existiam — ENUMs expandidos)
  - ENUMs: `goal_period_type` (mensal, trimestral, semanal, anual), `goal_metric` (volume_vendas, negocios_fechados, leads_convertidos, visitas_realizadas, captacoes, ticket_medio, tempo_resposta)
  - Tabela `goal_snapshots`: id, tenant_id, goal_id (FK CASCADE), snapshot_date, current_value, target_value, percentage, created_at. RLS PERMISSIVE com `auth_tenant_id()`
  - Índices + RLS policies PERMISSIVE
- **Backend hook — `src/hooks/useSmartGoals.ts` (CRIADO — ~665 linhas)**:
  - Types: `GoalMetric` (7), `GoalPeriodType` (4), `SmartGoal`, `SmartGoalWithProgress`, `GoalSnapshot`, `GoalTrend`, `CreateGoalParams`, `UpdateGoalParams`
  - Constants: `METRIC_LABELS` (7), `METRIC_ICONS` (7 lucide-react), `METRIC_FORMAT` (number/currency/hours), `PERIOD_LABELS` (4), `ALL_METRICS`, `ALL_PERIODS`
  - Helpers: `getMetricLabel()`, `formatMetricValue()`, `getPeriodDates()`
  - Core: `calculateBatchProgress()` — 5 parallel queries via Promise.all com tenant_id + .limit(2000). Métricas: negocios_fechados, volume_vendas, leads_convertidos, visitas_realizadas, captacoes, ticket_medio, tempo_resposta
  - Query hooks: `useSmartGoals(options?)` (JOIN profiles for user_name), `useGoalTemplates()`, `useGoalSnapshots(goalId)`, `useProfilesForGoals()`
  - Mutation hooks: `useCreateGoal()`, `useUpdateGoal()`, `useDeleteGoal()`, `useSaveGoalSnapshot()`, `useCreateFromTemplate()`
  - **Backward compat**: `useMyGoals.ts` preservado (usado por useCommercialDashboard.ts)
- **Frontend UI — `src/pages/comercial/BrokerGoals.tsx` (REESCRITO — ~891 linhas)**:
  - ICON_MAP: 7 ícones lucide-react mapeados por string
  - usePeriodNav: Hook custom para navegação de períodos (anterior/próximo/atual)
  - GoalTrendChart: Recharts LineChart com useGoalSnapshots
  - 4 Tabs: Ranking (cards por usuário com progress bars), Todas as Metas (tabela com filtros período/métrica/usuário + CRUD), Templates (galeria de templates + criar de template), Tendências (charts por meta)
  - CreateGoalDialog: Form completo (user_id, metric, period_type, target_value, description, is_template, template_name)
  - Period navigation: setas para navegar entre períodos com label formatado
  - RBAC: admin/gerente podem criar/editar/excluir metas de qualquer usuário, corretores veem apenas suas metas
- **MiniMax (Buchecha) code review — 3 CRITICAL fixes aplicados**:
  1. **CRITICAL: tenant_id missing in calculateBatchProgress** — 5 batch queries buscavam dados de TODOS os tenants. Fix: `getAuthTenantId()` + `.eq("tenant_id", tenantId)` + `.limit(2000)` em todas as 5 queries usando IIFE pattern
  2. **CRITICAL: tenant_id missing in useGoalSnapshots** — query por goal_id sem filtro tenant. Fix: `getAuthTenantId()` + `.eq("tenant_id", tenantId)` adicionado
  3. **FALSE POSITIVE: useSaveGoalSnapshot** — já tinha tenant_id (lines 599-601). Descartado
  - HIGH: `as any` casts — known issue (TS-02 pending). Noted
  - LOW: Number() parsing in GoalTrendChart — noted for future
- **Build**: 0 erros TypeScript (`npx tsc --noEmit`) ✅
- **Arquivos criados** (1):
  - `src/hooks/useSmartGoals.ts` — hook central smart goals (~665 linhas)
- **Arquivos modificados** (1):
  - `src/pages/comercial/BrokerGoals.tsx` — reescrito com 4 tabs (~891 linhas)
- **Cronograma CRM IA-Native**: F1 Item #10 ✅ concluído (G01 Metas Inteligentes). **CRM F1: 10/13 itens concluídos**. Próximo: F1 Item #11
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
