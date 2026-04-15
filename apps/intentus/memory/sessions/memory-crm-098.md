# Sessão 98 — CRM F3 Item #1: A04 Follow-up Inteligente IA (~12h) (21/03/2026)

- **`useSmartFollowUp.ts`** (~290 linhas): Hook completo conectando à EF `commercial-follow-up-ai`. Urgency scoring local (mirrors EF logic), 7 mutations (analyzeDeal, batchAnalyze, scheduleFollowUps, markExecuted, submitFeedback, cancelFollowUp, quickSchedule). KPIs computed: 8 métricas. React Query com auto-refresh.
- **`SmartFollowUpPage.tsx`** (~480 linhas): Dashboard com 8 KPIs, 3 tabs (Deals Priorizados, Agendados, Histórico). Filtro por urgência. Análise IA per-deal com dialog. Quick schedule. Feedback loop (success/no_response/rescheduled/lost). Empty states.
- **Rota**: `/comercial/follow-up` + sidebar "Follow-up IA" com icon Send
- **Bugs pré-existentes corrigidos**: `useDeals.ts` criado (shim para SalesAssistantDashboard), `useFollowUpAI.ts` import fix (`@/lib/supabase` → `@/integrations/supabase/client`)
- **Build**: 0 erros ✅.

## A05 SLA Engine (~12h)
- **`commercial-sla-engine/index.ts`** (~540 linhas): Edge Function v1 com 6 actions (check_violations, get_dashboard, escalate, get_rules, update_rules, get_history). Dynamic SLA rules from `tenants.settings.sla_rules_v2` JSONB. Auto-escalation → `commercial_automation_logs`. Auto-notification → `pulse_events` (sla_violation). Compliance: first_response_rate, avg_response_minutes. Violation types: first_response, follow_up, stage_time, total_time.
- **`useSlaEngineV2.ts`** (~150 linhas): 6 hooks (useSlaEngineDashboard, useSlaRulesV2, useSlaHistory, useUpdateSlaRules, useCheckSlaViolations, useEscalateSla). Types exportados: SlaRules, SlaViolation, SlaSummary, SlaComplianceData, SlaDashboardData. Labels: SLA_TYPE_LABELS, SEVERITY_COLORS, DEAL_STATUS_LABELS.
- **`SlaMonitor.tsx`** (reescrito): Migrado de frontend-only para backend-powered via useSlaEngineV2. 3 tabs (Violações, Regras editáveis, Histórico). Rules editor: Lead SLA, Deal SLA (per-stage hours), Escalation settings. Botão "Verificar agora" → check_violations.
- **Deploy**: EF `commercial-sla-engine` v1 deployed (ID: 261d4794). Status: ACTIVE.
- **Build**: 0 erros ✅. **CRM F3: 2/8**

## L06 Detecção de Duplicados IA (~10h) — REWRITE
- **`commercial-lead-dedup/index.ts`** (reescrito ~540 linhas): EF v2 com CORS fix (dynamic origin), auth fix (Authorization header in createClient), 6 actions (scan_all, check_duplicate, merge_duplicates, dismiss_duplicate, get_dashboard, get_history). Matching: CPF(50pts) + Email(40pts) + Phone(30pts) + Name/Levenshtein(30pts) = max 100. Union-Find clustering. Smart merge (fill empty fields from dup → primary). Soft-delete. Pulse events. Automation logs (dedup_merge, dedup_dismiss).
- **`useLeadDeduplication.ts`** (reescrito ~160 linhas): 6 hooks backend-powered via React Query (useDedupDashboard, useDuplicateScan, useCheckDuplicate, useMergeDuplicates, useDismissDuplicate, useDedupHistory). Types: DuplicateMatch, DuplicateCluster, ScanResult, DedupDashboard, DedupHistoryEntry. Constants: MATCH_TYPE_LABELS (6 tipos), MATCH_TYPE_COLORS.
- **`LeadDeduplication.tsx`** (reescrito ~360 linhas): 3 tabs (Scan & Duplicados, Dashboard, Histórico). KPIs: duplicados potenciais, mesclados 30d, qualidade de dados %, completude %. Dashboard: quality score, completeness score com breakdown email/phone/cpf, duplicados por tipo. Cluster cards com merge + dismiss. History com ícones por tipo de ação.
- **Deploy**: EF `commercial-lead-dedup` v2 deployed (ID: e87cba15). Status: ACTIVE.
- **Build**: 0 erros ✅. **CRM F3: 3/8**

## L04 Prospector IA — Captação Ativa (~14h)
- **`commercial-prospector-ai/index.ts`** (~484 linhas): EF v1 com 6 actions (analyze_icp, generate_approach, create_campaign, update_campaign_contact, get_campaigns, get_dashboard). ICP analysis: fetches converted leads, computes source/budget/region metrics, calls Gemini 2.0 Flash para análise ICP estruturada. Approach templates: gera 3 templates por canal via Gemini. Campaigns: stored in `commercial_automation_logs` (entity_type: "campaign"). Dashboard: funnel stats, source breakdown, campaign aggregate metrics.
- **`useProspectorAI.ts`** (~190 linhas): 6 hooks (useProspectorDashboard, useAnalyzeIcp, useGenerateApproach, useCreateCampaign, useUpdateCampaignContact, useProspectorCampaigns). Types: IcpAnalysis, IcpResult, ApproachTemplate, ApproachResult, Campaign, CampaignDetails, ProspectorDashboard. Constants: SOURCE_LABELS, STATUS_LABELS, CHANNEL_LABELS.
- **`ProspectorAIPage.tsx`** (~450 linhas): 4 tabs (Dashboard com FunnelBar + sources + campaign metrics, Análise ICP com IA, Templates de abordagem por canal/tom, Campanhas com tracking). Sub-components: KpiCard, FunnelBar. Create campaign dialog. Quick-track buttons (+1 Contact/Response/Meeting/Conversion).
- **Rota**: `/comercial/prospector` + sidebar "Prospector IA" com icon Target
- **Deploy**: EF `commercial-prospector-ai` v1 deployed (ID: b95211a1). Status: ACTIVE.
- **Build**: 0 erros ✅. **CRM F3: 4/8**

## C03 Campanhas Nurturing Multi-Canal (~16h)
- **`commercial-nurturing-engine/index.ts`** (~560 linhas): EF v1 com 10 actions (create_campaign, get_campaigns, get_campaign_detail, update_campaign, add_contacts, update_contact_step, generate_content, get_dashboard, pause_campaign, resume_campaign). Multi-canal: WhatsApp, Email, SMS, Telefone. Sequências multi-step com delay_hours. Enrollment por lead_ids ou segment_filter (status/source/region/min_score). Métricas auto-calculadas: open_rate, response_rate, conversion. Conteúdo IA via Gemini 2.0 Flash com A/B variant e personalization tips. Campaigns stored in `commercial_automation_logs` (automation_name: "nurturing_campaign"). Pulse events.
- **`useNurturingCampaigns.ts`** (~260 linhas): 9 hooks (useNurturingDashboard, useNurturingCampaigns, useNurturingCampaignDetail, useCreateNurturingCampaign, useUpdateNurturingCampaign, useAddNurturingContacts, useUpdateContactStep, usePauseCampaign, useResumeCampaign, useGenerateNurturingContent). Types: NurturingStep, CampaignContact, CampaignMetrics, NurturingCampaignData, NurturingCampaignRecord, NurturingDashboard, GeneratedContent. Constants: CHANNEL_LABELS, CHANNEL_COLORS, STATUS_LABELS, STATUS_COLORS, CONTACT_STATUS_LABELS, GOAL_OPTIONS (7 tipos).
- **`NurturingCampaignsPage.tsx`** (~530 linhas): 4 tabs (Dashboard com KPIs + funil + status/canal breakdown, Campanhas com cards + pause/resume + progress bar, Detalhe com sequência visual + contatos com avançar/converter, Conteúdo IA com gerador multi-canal). Create dialog com multi-step builder (add/remove steps, canal por step, delay_hours). Sub-components: KpiCard, ChannelIcon.
- **Rota**: `/comercial/nurturing` + sidebar "Nurturing" com icon Megaphone
- **Deploy**: EF `commercial-nurturing-engine` v1 deployed (ID: 58c4726a). Status: ACTIVE.
- **Build**: 0 erros ✅. **CRM F3: 5/8**

## G02 Ranking Gamificação (~16h) — REWRITE
- **`commercial-gamification-engine/index.ts`** (~597 linhas): EF v1 com 7 actions (get_dashboard, get_broker_detail, get_challenges, create_challenge, record_achievement, analyze_performance, get_leaderboard_history). Backend-powered ranking: deals/leads/visits/interactions/revenue aggregation. Points system: deal_won=100, lead_converted=50, visit_completed=20, interaction=5, revenue_per_10k=10. 5 badges com progress tracking. Streak computation (consecutive visit days). Leaderboard snapshots via `commercial_automation_logs` (entity_type: "gamification_snapshot"). Challenges system: 6 templates (weekly/monthly), stored in `commercial_automation_logs` (entity_type: "gamification_challenge"). Achievement recording via `pulse_events`. AI performance analysis via Gemini 2.0 Flash (strengths, improvements, tips, nextActions).
- **`useGamification.ts`** (reescrito ~210 linhas): 7 hooks backend-powered (useGamificationDashboard, useBrokerDetail, useGamificationChallenges, useCreateChallenge, useRecordAchievement, useAnalyzePerformance, useLeaderboardHistory) + legacy compat `useGamification()`. Types: BrokerRanking, GamificationDashboard, WeeklyHistory, BrokerDetail, Challenge, ChallengeTemplate, ChallengesData, PerformanceAnalysis, LeaderboardSnapshot. Constants: BADGE_COLORS, BADGE_LABELS, METRIC_LABELS, CHALLENGE_TYPE_LABELS.
- **`GamificationRanking.tsx`** (reescrito ~420 linhas): 4 tabs (Ranking com pódio + streaks + badges + full list, Desafios com ativos + create from templates, Detalhe Corretor com breakdown + badge progress + weekly history + AI analysis, Histórico com leaderboard snapshots). Sub-components: KPI, BreakdownCard.
- **Import fix**: App.tsx changed from named `{ GamificationRanking }` to default `import GamificationRanking`.
- **Deploy**: EF `commercial-gamification-engine` v1 deployed (ID: 1c72402f). Status: ACTIVE.
- **Build**: 0 erros ✅. **CRM F3: 6/8**

## P07 Deal Forecast IA (~14h)
- **`commercial-deal-forecast/index.ts`** (~530 linhas): EF v1 com 5 actions (forecast_deal, forecast_pipeline, get_dashboard, get_accuracy, analyze_bottlenecks). Probability scoring: stage weight (10-85) + interaction bonus (3pts/ea, max 15) + visit bonus (5pts/ea, max 15) - recency penalty (3/8/15) - pipeline age penalty (5/10/15) - value penalty. Clamp 5-95%. Time-to-close estimation baseada em histórico (6 meses). Risk level: low/medium/high/critical por # risk factors. Signals: positive/negative/neutral. Dashboard KPIs: totalDeals, totalVGV, weightedVGV, avgProbability, highProbDeals, atRiskDeals, avgDaysToClose. Aggregações: byStage, byRisk, byBroker. AI Bottleneck Analysis via Gemini 2.0 Flash (analysis, bottlenecks, recommendations, forecast scenarios).
- **`useDealForecast.ts`** (~180 linhas): 5 hooks backend-powered (useForecastDashboard, usePipelineForecast, useDealForecastSingle, useForecastAccuracy, useAnalyzeBottlenecks). Types: DealForecast, HistoricalStats, StageBreakdown, BrokerBreakdown, ForecastDashboard, BottleneckAnalysis. Constants: STAGE_LABELS, RISK_LABELS, RISK_COLORS, STAGE_COLORS.
- **`DealForecastPage.tsx`** (~338 linhas): 3 tabs (Visão Geral com stage/risk/broker distribution + historical stats, Deals Forecast com sorted by probability + expandable cards com signals/risks, Em Risco com filtered high/critical). AI bottleneck analysis button in header. Sub-components: KPI, DealCard (expandable).
- **Rota**: `/comercial/deal-forecast` + sidebar "Deal Forecast IA" com icon LineChart
- **Deploy**: EF `commercial-deal-forecast` v1 deployed (ID: ea7fc5c2). Status: ACTIVE.
- **Build**: 0 erros ✅. **CRM F3: 7/8**

## E03 Integração Portais BR (~20h)
- **Abordagem escolhida**: Caminho 2 — Multi-formato com Dashboard. Gera XML nos formatos VrSync (ZAP/VivaReal) e OLX nativo. Dashboard de validação por portal. Download direto.
- **`commercial-portal-integration/index.ts`** (~737 linhas): EF v1 com 6 actions (generate_xml, get_dashboard, validate_properties, update_portal_settings, get_property_status, toggle_property_portal). VrSync XML Generator: ListingDataFeed com Header + Listings. Maps property_type→VrSync PropertyType, purpose→TransactionType, 15 features mapeadas. OLX XML Generator: Carga com Imovel elements, SubTipoImovel, CategoriaImovel, max 20 fotos. Validation: validateForVrSync (12+ regras) + validateForOLX (5+ regras). Dashboard: portalStats aggregation + propertyStatuses. Toggle: updates `published_portals` ARRAY. Portal settings: stored in `tenants.settings.portal_settings` JSONB.
- **`usePortalIntegration.ts`** (~155 linhas): 6 hooks (usePortalDashboard, useValidateProperties, useGenerateXML, useTogglePropertyPortal, useUpdatePortalSettings, usePropertyPortalStatus). Types: PortalStats, PropertyStatus, PortalDashboard, ValidationError, ValidationResult, GeneratedXML, PropertyPortalStatus. Constants: PORTAL_LABELS, PORTAL_COLORS, PORTAL_FORMAT, PROPERTY_TYPE_LABELS, PURPOSE_LABELS.
- **`PortalIntegrationPage.tsx`** (~290 linhas): 4 tabs (Dashboard com KPIs + PortalCards + problem list, Imóveis com toggle switches por portal + validation status, Gerar XML com download por formato, Validação com grouped errors por propriedade).
- **Rota**: `/comercial/portais` + sidebar "Portais BR" com icon Globe
- **Deploy**: EF `commercial-portal-integration` v1 deployed (ID: c1218aee). Status: ACTIVE.
- **Build**: 0 erros ✅. **CRM F3: 8/8 — FASE 3 COMPLETA!**
