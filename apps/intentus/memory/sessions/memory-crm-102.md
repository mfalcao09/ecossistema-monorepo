# Sessão 102 — C05 Conversation Intelligence Avançada

**Data**: 21/03/2026
**Fase**: CRM F4 — Escala & Diferenciação (2/4)
**Item**: C05 — Conversation Intelligence Avançada (~20h)
**Status**: ✅ COMPLETO

## O que foi feito

### 1. Migration SQL
- Tabela `conversation_analyses`: armazena resultados de análises batch IA (analysis_type: full_analysis, coaching_insights, deal_impact)
- Tabela `interaction_sentiments`: sentimento por interação (positive/neutral/negative, score, emotions, key_topics, quality_score, objections_detected)
- RLS tenant-based read, service_role full access
- Indexes em tenant_id, analysis_type+created_at, interaction_id, sentiment
- Realtime habilitado em ambas tabelas
- **Migration aplicada**: `add_conversation_intelligence_advanced_tables`

### 2. Persona — resolve-persona.ts
- Adicionada persona `conversation_intelligence`
- System prompt focado em 7 outputs: sentiments, broker_scores, objection_patterns, cadence_recommendations, channel_effectiveness, next_best_actions, summary
- Modelo: gemini-2.5-flash, temperatura: 0.3

### 3. Edge Function — commercial-conversation-intelligence
- **ID deploy**: 270d50f0-dce5-4ff3-81fe-3f48fe1094f8
- **4 actions**:
  - `analyze_conversations`: Busca interações+leads+profiles → envia sample (até 100) para Gemini 2.5 Flash → persiste sentiments + full analysis
  - `get_coaching_insights`: Dados de performance por corretor correlacionados com deals → coaching tips via IA
  - `get_deal_impact`: Mapeia deals por person_id → calcula padrões de interação por deal → correlaciona com win/loss
  - `get_latest`: Busca última análise cached por tipo
- Fallback rule-based (keyword-based sentiment) quando OPENROUTER_API_KEY ausente
- ~638 linhas

### 4. Hook — useConversationIntelligenceAdvanced.ts
- Interfaces completas: SentimentResult, BrokerScore, ObjectionPattern, CadenceRecommendation, ChannelEffectiveness, NextBestAction, FullAnalysisData, CoachingData, DealImpactData, StoredAnalysis, InteractionSentimentRow
- `callEF()` helper via supabase.functions.invoke
- Hooks: useLatestAnalysis(type), useRunConversationAnalysis(), useCoachingInsights(), useDealImpactAnalysis(), useInteractionSentiments(limit)
- UI helpers: getSentimentColor(), getSentimentBgColor(), getSentimentLabel(), getSentimentEmoji(), getQualityBadge(), getUrgencyColor()

### 5. Página — ConversationIntelligenceAdvancedPage.tsx
- Rota: `/comercial/conversation-intelligence-advanced`
- 4 tabs: Visão Geral | Sentimento | Coaching | Deal Impact
- **Tab Visão Geral**: 4 KPIs (sentiment avg, quality score, objeções, cadência), summary, SentimentPie, channel effectiveness, broker quality scores, objection patterns, next best actions
- **Tab Sentimento**: 3 stat cards (positive/neutral/negative), lista scrollável com emoji+badge+score+topics+objections
- **Tab Coaching**: Overall assessment, top performer patterns, cards coaching por corretor com tips/scripts, team recommendations, benchmarks
- **Tab Deal Impact**: 4 KPIs (won/lost + avg interactions), winning/losing patterns, ScatterChart (interactions vs value), correlation insights, recommendations
- Botão "Rodar Análise IA" dispara 3 mutations simultaneamente

### 6. Rota + Sidebar
- App.tsx: rota registrada
- AppSidebar.tsx: entrada "Conv. Intelligence IA" com ícone Brain, roles admin+gerente, módulo comercial_basico

## Validação
- TypeScript: 0 erros
- Vite build: OK (30.98s)
- EF deployed e ACTIVE

## Arquivos modificados/criados
- `supabase/functions/commercial-conversation-intelligence/index.ts` (NEW)
- `supabase/functions/_shared/resolve-persona.ts` (MODIFIED)
- `src/hooks/useConversationIntelligenceAdvanced.ts` (NEW)
- `src/pages/comercial/ConversationIntelligenceAdvancedPage.tsx` (NEW)
- `src/App.tsx` (MODIFIED — rota)
- `src/components/AppSidebar.tsx` (MODIFIED — sidebar entry)

## Pendências
- VAPID keys (push notifications M01): gerar e configurar em Supabase secrets + Vercel env
- WhatsApp módulo: backlog para reestruturação
- Próximo: G03 — Coaching IA para Corretores (~20h)
