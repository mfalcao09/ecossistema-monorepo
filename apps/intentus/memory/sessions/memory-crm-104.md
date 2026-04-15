# Sessão 104 — M02 Filtros Avançados + Views Customizáveis

**Data**: 21/03/2026
**Fase**: CRM F4 — Escala & Diferenciação (4/4 — FASE COMPLETA!)
**Item**: M02 — Filtros Avançados + Views Customizáveis (~24h)
**Status**: ✅ Completo

---

## O que foi feito

### 1. Migration — `add_advanced_filters_and_custom_views`
- **saved_filters**: Filtros salvos (conditions JSONB, logic_operator AND/OR, sort_config JSONB, is_default, is_shared, is_pinned, use_count)
  - module CHECK: pipeline, leads, interactions, deals, brokers, properties, contracts, visits, tasks, reports
- **custom_views**: Views customizáveis (columns JSONB, filter_id FK, layout CHECK list/grid/kanban/table/calendar, group_by, color_rules JSONB, row_density CHECK compact/comfortable/spacious)
- RLS: tenant-based read + service_role full + users manage own/shared
- Indexes: tenant_id, module, created_by, filter_id, is_default
- Realtime enabled

### 2. Edge Function — SKIP (limite de EFs no plano Supabase)
- Arquivo local criado: `supabase/functions/commercial-views-engine/index.ts` (referência)
- Implementação é frontend-only via Supabase client direto

### 3. Hook — `useAdvancedFilters.ts`
- **Types**: FilterOperator (17 operadores), FieldType, CrmModule (10 módulos), ViewLayout (5 layouts), RowDensity, LogicOperator, FilterCondition, SortConfig, SavedFilter, ColumnConfig, ColorRule, CustomView, QueryPart, FieldDefinition
- **MODULE_FIELDS**: Definições de campos para 10 módulos (pipeline, leads, interactions, deals, brokers, properties, contracts, visits, tasks, reports)
- **OPERATORS_BY_TYPE**: Operadores disponíveis por tipo de campo
- **Helpers**: getModuleFields, getOperatorsForField, getFieldType, getAllModules, getModuleLabel, getOperatorLabel, getLayoutLabel, getLayoutIcon, getDensityLabel, buildQueryParts
- **Queries**: useFilters(module), useViews(module)
- **Mutations**: useSaveFilter, useDeleteFilter, useSetDefaultFilter, useSaveView, useDeleteView, useSetDefaultView, useDuplicateView

### 4. Page — `AdvancedFiltersPage.tsx`
- Rota: `/comercial/filtros-avancados`
- Module selector dropdown (10 módulos)
- **3 tabs**:
  - **Filtros**: 4 KPIs, filter builder visual (add condition rows com field/operator/value, AND/OR toggle), preview, filtros salvos list com edit/default/delete
  - **Views**: 4 KPIs, view builder (nome, layout selector 5 opções, density 3 opções, group by, linked filter, column manager com toggle+reorder), views salvos list com edit/duplicate/default/delete
  - **Configuração**: Default filter/view selectors per module, campos disponíveis badge list, resumo, all modules overview grid

### 5. Route + Sidebar
- `App.tsx`: Route `/comercial/filtros-avancados` → `AdvancedFiltersPage`
- `AppSidebar.tsx`: Entry "Filtros & Views" com icon SlidersHorizontal, roles admin/gerente

---

## Validação
- `npx tsc --noEmit` → 0 erros
- `npx vite build` → ✅ sucesso (3GB memory, warning chunk size pré-existente)

## Arquivos criados/modificados
| Arquivo | Ação |
|---------|------|
| `supabase/functions/commercial-views-engine/index.ts` | Criado (referência local) |
| `src/hooks/useAdvancedFilters.ts` | Criado |
| `src/pages/comercial/AdvancedFiltersPage.tsx` | Criado |
| `src/App.tsx` | Modificado (route) |
| `src/components/AppSidebar.tsx` | Modificado (sidebar entry) |

## Notas
- EF não deployada (limite de funções no plano Supabase) — frontend-only pattern (mesmo de P02, P06, A03, G01, I06, etc.)
- **CRM FASE 4 COMPLETA! Todas 4 fases do CRM IA-Native concluídas.**
- Total CRM: F1 (13/13) + F2 (11/11) + F3 (8/8) + F4 (4/4) = 36/36 itens ✅
- Próximo: Backlog — Reestruturação módulo WhatsApp/Atendimento
