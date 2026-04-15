# Sessao 110 — F12 Revenue Attribution & LTV Predictor (Completo)

**Data**: 21/03/2026
**Fase**: Intelligence & Monetization Phase 3 — F12 Revenue Attribution & LTV Predictor
**Item**: F12 — Revenue Attribution & LTV Predictor (~20h)
**Status**: ✅ Completo

---

## O que foi feito

### 1. Migration — `create_revenue_attribution_ltv_tables` (~150 linhas)
- **3 tabelas criadas**:
  - `revenue_attributions`: 6 attribution_types (first_touch, last_touch, linear, time_decay, position_based, algorithmic), 10 channels, 13 touchpoints, revenue_amount, attribution_weight, attributed_revenue (GENERATED ALWAYS AS revenue_amount * attribution_weight STORED), touchpoint_date, conversion_date, days_to_conversion, ai_generated, ai_confidence, metadata JSONB
  - `ltv_predictions`: 6 ltv_segments (platinum/gold/silver/bronze/at_risk/churned), current_ltv, predicted_ltv_12m/36m/lifetime, confidence_score, scores (payment_score, engagement_score, churn_probability, expansion_probability, referral_potential), risk_factors/growth_drivers/recommended_actions JSONB arrays, segment tracking (previous_segment, segment_changed_at), UNIQUE(tenant_id, person_id)
  - `ltv_snapshots`: Historical snapshots for trend analysis — snapshot_date, current_ltv, predicted values, segment, churn_probability, confidence_score
- Indexes, RLS com tenant_isolation, triggers via set_updated_at(), realtime for attributions + predictions

### 2. Persona — `resolve-persona.ts` (revenue_ltv_ai)
- Adicionada entre `nba_engine_ai` e `churn_interceptor`
- System prompt: Revenue Attribution & LTV Predictor — attribution models, LTV prediction (12m/36m/lifetime), segmentation, risk analysis, ROI por canal, trend analysis
- Model: gemini-2.5-flash, temperature: 0.3

### 3. Edge Function — `relationship-revenue-ltv/index.ts` (~370 linhas)
- **10 actions**: get_attributions, add_attribution, get_predictions, get_prediction, get_snapshots, calculate_ltv, attribute_revenue, get_stats, get_roi_by_channel, get_segment_analysis
- **2 AI tool declarations**:
  - `ltv_predictions`: predictions array (person_id, current_ltv, predicted values, confidence, segment, scores, risk_factors, growth_drivers, recommended_actions) + summary + total_portfolio_ltv + avg_client_ltv
  - `revenue_attributions`: attributions array (channel, touchpoint, revenue_amount, attribution_weight, dates, days_to_conversion) + summary + top_channel + top_touchpoint + total_attributed_revenue
- handleCalculateLtv(): Parallel fetch → AI prediction → upsert predictions + save snapshots + track segment changes
- handleAttributeRevenue(): Data fetch → AI attribution → bulk insert
- handleGetStats(): Aggregation by channel, touchpoint, segment com totals

### 4. Hook — `useRevenueLtv.ts` (~340 linhas)
- **Types**: RevenueAttribution, LtvPrediction, LtvSnapshot, RevenueLtvStats, RiskFactor, GrowthDriver, RecommendedAction + 4 union types (AttributionType, AttributionChannel, Touchpoint, LtvSegment)
- **Direct Supabase Queries**: useAttributionsDirect (com filtros), usePredictionsDirect (com join people + filtro segment), useSnapshotsDirect (por person), useStatsDirect
- **Direct Mutations**: useAddAttributionDirect
- **EF Mutations (AI)**: useCalculateLtv, useAttributeRevenue
- **20 UI Helpers**: getSegmentLabel/Color/Emoji, getChannelLabel/Emoji, getTouchpointLabel/Emoji, getAttributionTypeLabel, getChurnRiskLabel/Color, formatCurrency, formatPercent

### 5. Página — `RevenueLtvPredictor.tsx` (~370 linhas)
- Rota: `/relacionamento/revenue-ltv`
- **3 Tabs**:
  - **LTV Clientes**: Cards com LTV atual/12m/36m/lifetime, progress bars (payment, engagement, churn), segment badges, segment migration indicators, expandable details (risk_factors, growth_drivers, recommended_actions). Filtro por segmento
  - **Revenue Attribution**: Cards com channel→touchpoint flow, attributed revenue, modelo, peso, days_to_conversion. Filtro por canal
  - **Dashboard**: 4 cards (distribuição por segmento com progress bars, receita por canal, receita por touchpoint, saúde do portfolio com potencial restante)
- **Componentes locais**: KpiCard, LtvClientCard (expandable), AttributionCard
- Botões "Calcular LTV IA" e "Atribuir Receita IA" no header
- 6 KPIs: Clientes Analisados, LTV Total Portfolio, LTV Médio, Receita Atual, Churn Médio, Atribuições

### 6. Route + Sidebar
- `App.tsx`: Import RevenueLtvPredictor + Route `/relacionamento/revenue-ltv`
- `AppSidebar.tsx`: Entry "Revenue & LTV" com icon DollarSign, roles admin/gerente, module relacionamento_basico

---

## Validação
- `npx tsc --noEmit` → 0 erros
- `npx vite build` → ✅ sucesso (built in 54.39s)

## Arquivos criados/modificados
| Arquivo | Ação |
|---------|------|
| Migration `create_revenue_attribution_ltv_tables` | Aplicada via Supabase |
| `supabase/functions/_shared/resolve-persona.ts` | Modificado (persona revenue_ltv_ai) |
| `supabase/functions/relationship-revenue-ltv/index.ts` | Criado (~370 linhas) |
| `src/hooks/useRevenueLtv.ts` | Criado (~340 linhas) |
| `src/pages/RevenueLtvPredictor.tsx` | Criado (~370 linhas) |
| `src/App.tsx` | Modificado (import + route) |
| `src/components/AppSidebar.tsx` | Modificado (sidebar entry) |

## Stack Completa F12
| Camada | Arquivo | Linhas |
|--------|---------|--------|
| Migration | `create_revenue_attribution_ltv_tables` | ~150 |
| Persona | `resolve-persona.ts` (revenue_ltv_ai) | ~40 |
| Edge Function | `relationship-revenue-ltv/index.ts` | ~370 |
| Hook | `useRevenueLtv.ts` | ~340 |
| Página | `RevenueLtvPredictor.tsx` | ~370 |
| **Total** | | **~1270 linhas** |

## PHASE 3 — Completa! ✅
| Feature | Status | Linhas |
|---------|--------|--------|
| F11 — Next Best Action Engine (24h) | ✅ Completo | ~1215 |
| F12 — Revenue Attribution & LTV Predictor (20h) | ✅ Completo | ~1270 |
| **Total Phase 3** | | **~2485 linhas** |

## Cronograma IA-Native — Status Global
| Phase | Features | Status |
|-------|----------|--------|
| Phase 1 — Core Relationship (F1-F3) | CLM, CRM, Smart Notifications | ✅ Completo |
| Phase 2 — Engagement (F4-F6) | Churn Interceptor, Digital Twin, Life Events | ✅ Completo |
| Phase 3 — Intelligence (F11-F12) | Next Best Action, Revenue & LTV | ✅ Completo |
