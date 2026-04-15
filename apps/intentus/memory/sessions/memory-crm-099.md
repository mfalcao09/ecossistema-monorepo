# Sessão 99 — 21/03/2026
## F7: Churn Prediction Engine Multi-Dimensional (COMPLETO)

### O que foi feito
1. **Plano IA-Native completo** — 5 pilares, 12 features, 4 fases (~280h)
   - Documento: `plano-relacionamento-ia-native.html`
   - Memória: `memory/projects/relationship-ia-native-plan.md`

2. **F7: Churn Prediction Engine** — IMPLEMENTADO
   - **Tabelas Supabase**: `churn_predictions`, `churn_signals`, `churn_interventions` (com RLS, indexes, realtime)
   - **Edge Function**: `relationship-churn-predictor/index.ts` — v1
     - 3 camadas de sinais: quantitative, qualitative, contextual
     - Collectors paralelos para tickets, pagamentos, NPS, manutenção, contratos, seguros
     - Análise qualitativa via Gemini 2.0 Flash com Function Calling
     - Persiste signals + predictions no banco
     - Output: score 0-100, risk_level, top_reasons, recommended_actions, sentiment_analysis
   - **Persona**: `churn_predictor` adicionada ao `_shared/resolve-persona.ts`
   - **Hook**: `useChurnPrediction.ts` — 10 exports:
     - `useChurnPredictions()` — fetch all predictions
     - `useChurnPredictionByContract()` — single contract
     - `useRunChurnPrediction()` — mutation single
     - `useRunBatchChurnPrediction()` — mutation batch (all active contracts)
     - `useChurnSignals()` — raw signals
     - `useChurnInterventions()` — interventions per prediction
     - `useCreateIntervention()` — create intervention
     - `useUpdateIntervention()` — update outcome
     - `useChurnMetrics()` — computed metrics helper
     - `getChurnRiskColor/Label/Emoji()` — UI helpers
   - **Página**: `ChurnRadar360.tsx`
     - 6 KPIs: Score Médio, Contratos em Risco, MRR em Risco, Críticos, Alto Risco, Saudáveis
     - Gráficos: Pie de distribuição de risco + Histogram de scores
     - Lista filterable de predições por contrato
     - Detail view com razões, ações recomendadas, scripts para CS, sentimento
     - Botão "Executar Ação" para criar intervenções
     - Botão "Rodar Predição IA" para batch
   - **Rota**: `/relacionamento/churn-radar`
   - **Sidebar**: Adicionado "Churn Radar 360°" com icon Radar no módulo Relacionamento
   - **Health Score Fix**: Substituído NPS hardcoded (70) por dados reais de `satisfaction_responses`
   - **Types**: Regenerados com 3 novas tabelas

### Build Status
- TypeScript: ✅ 0 errors
- Vite: ✅ 4579 modules transformed (falha de permissão no dist/ é do sandbox, não do código)

### Próximos passos (F1 do Plano)
- F1: Perfil Comportamental (DNA do Cliente) — 20h
- F3: Sentiment Scanner — 16h
- F8: Churn Interceptor — 16h

### Commit sugerido
```
feat(relationship): implement Churn Prediction Engine (F7) — IA-Native

- Add 3 Supabase tables: churn_predictions, churn_signals, churn_interventions (RLS + realtime)
- Create relationship-churn-predictor Edge Function (Gemini 2.0 Flash, 3-layer signal analysis)
- Add churn_predictor persona to resolve-persona.ts
- Create useChurnPrediction hook (10 exports: queries, mutations, helpers)
- Create ChurnRadar360 page with KPIs, charts, detail view, interventions
- Register route /relacionamento/churn-radar + sidebar entry
- Fix hardcoded NPS (70) → real satisfaction_responses data
- Regenerate Supabase TypeScript types

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
