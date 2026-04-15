# Sessão 79 — CRM F1 Item #6: Distribuição Inteligente de Leads (~12h, P0) (15/03/2026)

- **Objetivo**: Implementar sexto item da Fase 1 do plano CRM IA-Native (sessão 73): L05 — Distribuição Inteligente de Leads. Auto-assign de leads a corretores baseado em algoritmo de scoring 5 fatores ponderados, com 5 estratégias de distribuição, dashboard de monitoramento, configuração de regras e histórico de atribuições
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). Implementação em 7 tasks ao longo de múltiplas continuações de contexto
- **Database migration `create_lead_distribution_tables`** (via Supabase MCP):
  - Tabela `lead_distribution_rules`: strategy, 5 weight columns (workload/expertise/region/performance/availability), max_leads_per_broker, auto_assign_enabled, config JSONB, is_active, created_by. RLS PERMISSIVE com `auth_tenant_id()`
  - Tabela `lead_assignment_logs`: lead_id FK CASCADE, broker_id, broker_name, strategy_used, scoring JSONB, total_score, assigned_by CHECK (auto/manual/reassign), previous_broker_id. RLS PERMISSIVE com `auth_tenant_id()`
  - 4 índices para performance
  - 3 colunas em `leads`: `lead_score` (INT), `score_evaluated_at` (TIMESTAMPTZ), `scoring_model_used` (TEXT) — já existiam da sessão 77
- **Backend — `supabase/functions/commercial-lead-distribution/index.ts` (CRIADO — ~741 linhas, self-contained, v1)**:
  - **4 actions**: `auto_assign` (auto-atribui lead ao melhor corretor), `get_dashboard` (KPIs + broker distribution), `configure_rules` (CRUD regras), `get_assignment_history` (logs paginados)
  - **5 estratégias de distribuição**: round_robin (rodízio simples), workload (por carga), score (por pontuação), region (por região), hybrid (combinação ponderada — recomendado)
  - **5-factor scoring engine** (pesos configuráveis, total 100%):
    1. `calcWorkloadScore` (20%): Inverte proporção de leads ativos vs max_leads_per_broker
    2. `calcExpertiseScore` (20%): Taxa de conversão do corretor (convertido÷total)
    3. `calcRegionScore` (30%): Match fuzzy entre preferred_region do lead e regions do corretor
    4. `calcPerformanceScore` (15%): Média ponderada de leads convertidos (30d×2 + 90d×1)
    5. `calcAvailabilityScore` (15%): Hardcoded 90 (futuro: integração calendário)
  - **Round robin helper**: `roundRobinPick()` com capacity check (last_assigned_at mais antigo, dentro do max_leads_per_broker)
  - **Terminal lead guard**: Leads com status `convertido` ou `perdido` não são re-atribuídos
  - **RBAC**: configure_rules, get_assignment_history, get_dashboard requerem `hasAdminRole` (superadmin/admin/gerente)
  - **Self-contained**: Inline CORS whitelist (`app.intentusrealestate.com.br` + `intentus-plataform.vercel.app`), auth/tenant via profiles.user_id
  - **Deploy**: v1 via Supabase MCP (ID: `614a18f1-90ad-41ee-a43d-e533e0b8eb09`, ACTIVE, verify_jwt: false)
- **Frontend hook — `src/hooks/useLeadDistribution.ts` (CRIADO — ~217 linhas)**:
  - Types: `DistributionStrategy`, `DistributionRule`, `ScoringBreakdown`, `AssignmentCandidate`, `AutoAssignResult`, `BrokerDistribution`, `DistributionDashboard`, `AssignmentLog`, `ConfigureRulesParams`
  - Constants: `STRATEGY_LABELS` (5), `STRATEGY_DESCRIPTIONS` (5), `WEIGHT_LABELS` (5 com `WeightKey` typed key)
  - API helper: `invokeDistribution<T>(action, params)` com null-check no response
  - Query hooks: `useDistributionDashboard()` (staleTime 3min, refetchInterval 5min), `useAssignmentHistory(options?)`
  - Mutation hooks: `useAutoAssignLead()` (conditional invalidation only when assigned), `useConfigureDistribution()`
  - Fire-and-forget: `autoAssignLeadFireAndForget(leadId, qc?)` — aceita QueryClient opcional para invalidação de cache
- **Frontend UI — `src/pages/comercial/LeadDistributionSettings.tsx` (CRIADO — ~530 linhas)**:
  - Página admin em `/comercial/distribuicao-leads` com 3 tabs: Configuração, Dashboard, Histórico
  - Config tab: Strategy selector (5 estratégias com descrições), weight sliders (validação soma=100), max leads per broker, toggle auto-assign
  - Dashboard tab: 5 KPI cards (total 30d, 7d, auto, manual, taxa auto %) + broker distribution bars com labels de contagem + progressBar visual
  - History tab: Tabela de logs com strategy badges, scores, timestamps, tipo de atribuição (auto/manual/reassign)
  - **6 MiniMax review fixes aplicados**: useEffect+useRef para sync de form state (substituiu setState em useMemo), remoção de variáveis/imports não usados, guard isNaN em inputs numéricos, validação segura de strategy_used com operador `in`, memoização maxLeads com IIFE
- **Wiring auto-assign — `src/hooks/useLeads.ts` (MODIFICADO)**:
  - Import `autoAssignLeadFireAndForget` de useLeadDistribution
  - `useCreateLead` onSuccess: quando `!data.assigned_to` (sem atribuição manual), chama `autoAssignLeadFireAndForget(data.id, qc)` fire-and-forget
- **Rota + Sidebar**: `/comercial/distribuicao-leads` registrada em App.tsx. Item "Distribuição de Leads" (Share2 icon) no sidebar com roles admin/gerente
- **MiniMax (Buchecha) code reviews — 3 rodadas (30 findings total, ALL RESOLVED)**:
  - Edge Function (15 findings): 5 CRITICAL (auth checks, terminal lead guard, log error handling), 5 WARNING (region min length, unknown action message, null-safety), 5 INFO (capacity rewrite, strategy validation)
  - useLeadDistribution.ts (5 findings): 1 CRITICAL (cache invalidation), 2 WARNING (null-safety, conditional invalidation), 2 INFO (config type, WeightKey type)
  - LeadDistributionSettings.tsx (10 findings): 2 CRITICAL (setState in useMemo, unused imports), 4 WARNING (empty string handling, unsafe type assertion, isHybrid logic, mutation error handling), 4 INFO (dependency array, maxLeads compute, accessibility, hardcoded color)
- **Build**: 0 erros TypeScript (`npx tsc --noEmit`) ✅
- **Arquivos criados** (3):
  - `supabase/functions/commercial-lead-distribution/index.ts` — Edge Function self-contained (~741 linhas)
  - `src/hooks/useLeadDistribution.ts` — hook central distribuição de leads (~217 linhas)
  - `src/pages/comercial/LeadDistributionSettings.tsx` — página admin 3 tabs (~530 linhas)
- **Arquivos modificados** (3):
  - `src/hooks/useLeads.ts` — import autoAssignLeadFireAndForget + wiring no useCreateLead onSuccess
  - `src/App.tsx` — import + rota `/comercial/distribuicao-leads`
  - `src/components/AppSidebar.tsx` — item sidebar "Distribuição de Leads" com Share2 icon
- **Edge Functions — Versões atualizadas**:
  - `commercial-lead-distribution` → version 1 (4 actions, 5-factor scoring, 5 strategies, self-contained, CORS whitelist)
- **Cronograma CRM IA-Native**: F1 Item #6 ✅ concluído (L05 Distribuição Inteligente de Leads). **CRM F1: 6/13 itens concluídos**. Próximo: F1 Item #7
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
