# Sessao 107 — F6 Proactive Life Events Engine (Completo)

**Data**: 21/03/2026
**Fase**: Relationship Module Phase 2 — F6 Life Events Engine
**Item**: F6 — Proactive Life Events Engine (~20h)
**Status**: ✅ Completo

---

## O que foi feito

### 1. Migration — `create_life_events_engine_tables`
- **3 tabelas criadas**:
  - `client_life_events`: Eventos com 10 event_types, 6 categories, recurrence, ai_generated, pattern_confidence, ai_recommendation JSONB, status (6 states), priority, tags array
  - `life_event_rules`: Regras configuraveis com 5 rule_types, conditions JSONB, recommended_action (5 types), action_config JSONB, cooldown_days, is_active toggle
  - `life_event_actions`: Acoes executadas com 9 action_types, content_generated JSONB, result JSONB, executed_at/by
- Helper function `set_updated_at()` criada (moddatetime extension nao disponivel)
- Indexes, RLS com tenant_isolation, triggers updated_at, realtime enabled

### 2. Persona — `resolve-persona.ts` (life_events_ai)
- Adicionada persona `life_events_ai` entre `property_twin_ai` e `churn_interceptor`
- System prompt: Life Events Analyst — deteccao de eventos, pattern matching, triggers de mercado, geracao de conteudo, priorizacao, recomendacao de acoes
- Model: gemini-2.5-flash, temperature: 0.4

### 3. Edge Function — `relationship-life-events-engine/index.ts` (~380 linhas)
- **10 actions**: get_events, add_event, update_event, get_rules, add_rule, toggle_rule, get_actions, scan_events, generate_content, get_stats
- **2 AI tool declarations**:
  - `detected_life_events`: Scan de dados para detectar eventos (events array + summary + total_opportunities)
  - `generated_content`: Conteudo personalizado (subject, greeting, body, CTA, closing, tone, personalization_score, alternative_channels)
- **Data Fetchers**: fetchTenantClients, fetchTenantContracts, fetchRecentPayments, fetchExistingEvents, fetchEventWithDetails, fetchPersonContext
- handleScanEvents(): Parallel fetch (clients + contracts + payments + existing) → AI detection → bulk insert → logInteraction
- handleGenerateContent(): Event + person context → AI content generation → save action → update event status
- handleGetStats(): Aggregation de events/rules/actions com breakdowns by_type e by_category
- CORS whitelist padrao

### 4. Hook — `useLifeEventsEngine.ts` (~420 linhas)
- **Types**: LifeEvent, LifeEventRule, LifeEventAction, LifeEventStats, GeneratedContent, ScanResult + 9 union types
- **Direct Supabase Queries**: useEventsDirect (com filtros), useRulesDirect, useActionsDirect, useStatsDirect
- **Direct Mutations**: useAddEventDirect, useUpdateEventDirect, useAddRuleDirect, useToggleRuleDirect
- **EF Mutations (AI)**: useScanEvents, useGenerateContent
- **22 UI Helpers**: getEventTypeLabel/Emoji/Color, getStatusLabel/Color/Emoji, getPriorityColor/Label/Emoji, getCategoryLabel/Emoji, getRuleTypeLabel, getActionTypeLabel/Emoji, getRecurrenceLabel, getDaysUntil, getDaysUntilLabel

### 5. Pagina — `LifeEventsEngine.tsx` (~540 linhas)
- Rota: `/relacionamento/life-events`
- **3 Tabs**:
  - **Calendario**: Eventos agrupados por timing (Atrasados/Hoje/Esta Semana/Este Mes/Futuro/Concluidos), filtros por status e tipo, cards com acoes (Gerar Conteudo IA, Marcar Acao, Descartar), preview de conteudo gerado
  - **Regras**: Lista de regras com toggle ativo/inativo, dialog para criar nova regra (tipo, evento, acao, prioridade, cooldown)
  - **Dashboard**: 4 cards (por tipo, por categoria, visao por status, acoes executadas)
- **Componentes locais**: KpiCard, EventCard, RuleCard, ContentPreview
- **Add Event Dialog**: Tipo, categoria, titulo, descricao, data, prioridade, recorrencia
- **Add Rule Dialog**: Nome, descricao, tipo de regra, tipo de evento, acao recomendada, prioridade, cooldown
- Botao "Scan IA" no header para detectar eventos automaticamente

### 6. Route + Sidebar
- `App.tsx`: Import LifeEventsEngine + Route `/relacionamento/life-events`
- `AppSidebar.tsx`: Entry "Life Events" com icon CalendarDays, roles admin/gerente, module relacionamento_basico

---

## Validacao
- `npx tsc --noEmit` → 0 erros
- `npx vite build` → ✅ sucesso (built in 41.46s)

## Arquivos criados/modificados
| Arquivo | Acao |
|---------|------|
| Migration `create_life_events_engine_tables` | Aplicada via Supabase |
| `supabase/functions/_shared/resolve-persona.ts` | Modificado (persona life_events_ai) |
| `supabase/functions/relationship-life-events-engine/index.ts` | Criado (~380 linhas) |
| `src/hooks/useLifeEventsEngine.ts` | Criado (~420 linhas) |
| `src/pages/LifeEventsEngine.tsx` | Criado (~540 linhas) |
| `src/App.tsx` | Modificado (import + route) |
| `src/components/AppSidebar.tsx` | Modificado (sidebar entry) |

## Stack Completa F6
| Camada | Arquivo | Linhas |
|--------|---------|--------|
| Migration | `create_life_events_engine_tables` | ~130 |
| Persona | `resolve-persona.ts` (life_events_ai) | ~30 |
| Edge Function | `relationship-life-events-engine/index.ts` | ~380 |
| Hook | `useLifeEventsEngine.ts` | ~420 |
| Pagina | `LifeEventsEngine.tsx` | ~540 |
| **Total** | | **~1500 linhas** |

## Notas
- EF `relationship-life-events-engine` NAO deployed (limite de functions no plano). Existe localmente.
- Hook fornece queries Direct como fallback — pagina funciona para CRUD sem a EF.
- Features AI (scan_events, generate_content) dependem da EF estar deployed.
- moddatetime extension nao disponivel — usada function custom `set_updated_at()` para triggers.
- Eventos suportam recurrence (none/yearly/monthly/quarterly) com next_occurrence calculada.

## PHASE 2 COMPLETA!
| Feature | Status | Linhas |
|---------|--------|--------|
| F4 — IntelliHome Concierge (32h) | ✅ Completo | ~1936 |
| F5 — Digital Twin do Imovel (24h) | ✅ Completo | ~1480 |
| F6 — Proactive Life Events Engine (20h) | ✅ Completo | ~1500 |
| **TOTAL PHASE 2** | **✅ COMPLETO** | **~4916 linhas** |
