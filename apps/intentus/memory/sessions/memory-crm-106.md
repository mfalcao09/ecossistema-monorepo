# Sessao 106 — F5 Digital Twin do Imovel (Completo)

**Data**: 21/03/2026
**Fase**: Relationship Module Phase 2 — F5 Digital Twin
**Item**: F5 — Digital Twin do Imovel (~24h)
**Status**: ✅ Completo

---

## O que foi feito

### 1. Migration — `create_property_digital_twin_tables` (~80 linhas)
- **3 tabelas criadas**:
  - `property_twin_timeline`: Eventos com 10 event_types, 13 categories, severity, status, cost, linked references (ticket, contract, document), ai_generated flag
  - `property_twin_alerts`: Alertas proativos com 8 alert_types, priority, status (active/snoozed/dismissed/resolved/expired), snooze, notification tracking
  - `property_twin_profile`: Perfil AI com UNIQUE(tenant_id, property_id) para upsert, health_score, maintenance_score, documentation_score, risk_level, key_findings/recommendations JSONB
- Indexes, RLS com tenant_isolation, triggers updated_at, realtime enabled

### 2. Persona — `resolve-persona.ts` (property_twin_ai)
- Adicionada persona `property_twin_ai` entre `concierge_ai` e `churn_interceptor`
- System prompt: Digital Twin Analyst — analise de timeline, alertas proativos, health score, recomendacoes, chat contextual, resumo executivo
- Model: gemini-2.5-flash, temperature: 0.3

### 3. Edge Function — `relationship-property-twin/index.ts` (~420 linhas)
- **8 actions**: get_timeline, add_event, get_alerts, dismiss_alert, get_profile, generate_profile, chat, generate_alerts
- **2 AI tool declarations**: property_analysis (health scores + findings + recommendations + auto-alerts), twin_response (contextual chat)
- **Data Fetchers**: fetchPropertyData, fetchTimeline, fetchAlerts, fetchProfile, fetchPropertyDocuments, fetchPropertyTickets, fetchPropertyContracts — todos com tenant isolation
- handleGenerateProfile(): Parallel context fetch → AI analysis → upsert profile → auto-create alerts
- handleChat(): Parallel context fetch → contextual AI response
- handleGenerateAlerts(): Expire old AI alerts → AI scan → create new alerts
- CORS whitelist padrao

### 4. Hook — `usePropertyDigitalTwin.ts` (~400 linhas)
- **Types**: TimelineEvent, TwinAlert, TwinProfile, ChatResponse, GenerateProfileResponse, EventType, EventCategory, Severity, AlertType, AlertStatus, RiskLevel
- **EF Queries**: useTimeline, useAlerts, useTwinProfile
- **Direct Supabase Queries (fallback)**: useTimelineDirect, useAlertsDirect, useTwinProfileDirect, usePropertyDocsDirect, usePropertyTicketsDirect
- **EF Mutations**: useAddEvent, useDismissAlert, useGenerateProfile, useTwinChat, useGenerateAlerts
- **Direct Mutations (fallback)**: useAddEventDirect, useDismissAlertDirect
- **Metrics**: useTwinMetrics — totalEvents, activeAlerts, totalAlerts
- **18 UI Helpers**: getEventTypeLabel/Emoji/Color, getSeverityColor/Label/Emoji, getAlertTypeLabel/Emoji, getRiskColor/Label, getScoreColor, getCategoryLabel

### 5. Pagina — `PropertyDigitalTwin.tsx` (~550 linhas)
- Rota: `/relacionamento/digital-twin`
- **4 Tabs**:
  - **Saude**: 3 ScoreGauge cards (health, maintenance, documentation), risk badge, AI summary, key findings, recommendations, documents, tickets. Botoes "Gerar Perfil IA" e "Gerar Alertas IA"
  - **Timeline**: Filtro por event type, botao add event, timeline vertical com TimelineEventCard (emoji + color-coded, severity badges, cost, performer, category)
  - **Alertas**: Active alerts com AlertCard (resolve/snooze/dismiss), badge count no tab, botao "Escanear com IA"
  - **Chat**: Perguntas sobre o imovel, chat bubbles teal-themed, confidence/response_time badges
- **Componentes locais**: ScoreGauge, TimelineEventCard, AlertCard
- **Add Event Dialog**: Type, category, title, description, severity, performed_by, cost
- Usa Direct queries como primary (EF nao deployed)

### 6. Route + Sidebar
- `App.tsx`: Import PropertyDigitalTwin + Route `/relacionamento/digital-twin`
- `AppSidebar.tsx`: Entry "Digital Twin" com icon Cpu, roles admin/gerente, module relacionamento_basico

### 7. Fix — useActiveModule.ts → .tsx
- Arquivo `.ts` continha JSX (Provider component). Renomeado para `.tsx` para resolver erro esbuild no vite build.

---

## Validacao
- `npx tsc --noEmit` → 0 erros
- `npx vite build` → ✅ sucesso (built in 1m 10s)

## Arquivos criados/modificados
| Arquivo | Acao |
|---------|------|
| Migration `create_property_digital_twin_tables` | Aplicada via Supabase |
| `supabase/functions/_shared/resolve-persona.ts` | Modificado (persona property_twin_ai) |
| `supabase/functions/relationship-property-twin/index.ts` | Criado (~420 linhas) |
| `src/hooks/usePropertyDigitalTwin.ts` | Criado (~400 linhas) |
| `src/pages/PropertyDigitalTwin.tsx` | Criado (~550 linhas) |
| `src/App.tsx` | Modificado (import + route) |
| `src/components/AppSidebar.tsx` | Modificado (icon Cpu + sidebar entry) |
| `src/hooks/useActiveModule.ts` → `.tsx` | Renomeado (fix JSX em .ts) |

## Stack Completa F5
| Camada | Arquivo | Linhas |
|--------|---------|--------|
| Migration | `create_property_digital_twin_tables` | ~80 |
| Persona | `resolve-persona.ts` (property_twin_ai) | ~30 |
| Edge Function | `relationship-property-twin/index.ts` | ~420 |
| Hook | `usePropertyDigitalTwin.ts` | ~400 |
| Pagina | `PropertyDigitalTwin.tsx` | ~550 |
| **Total** | | **~1480 linhas** |

## Notas
- EF `relationship-property-twin` NAO deployed (limite de functions no plano). Existe localmente.
- Hook fornece queries Direct como fallback — pagina funciona para CRUD sem a EF.
- Features AI (generate_profile, chat, generate_alerts) dependem da EF estar deployed.
- usePropertiesList query busca ate 300 imoveis para o property selector dropdown.
- Alertas suportam snooze com snooze_until timestamp.

## Proximo Item Phase 2
- **F6 — Proactive Life Events Engine (~20h)**
