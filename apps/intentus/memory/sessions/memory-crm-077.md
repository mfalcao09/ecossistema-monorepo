# Sessão 77 — CRM F1 Item #4: Lead Scoring IA (~16h, P0) (15/03/2026)

- **Objetivo**: Implementar quarto item da Fase 1 do plano CRM IA-Native (sessão 73): P04 — Lead Scoring Automático com IA. Scoring híbrido (rule-based + AI boost via Gemini 2.0 Flash) com 8 fatores ponderados, histórico de scores, dashboard e batch scoring
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). Implementação em 7 tasks ao longo de múltiplas sessões de contexto (7 continuações)
- **Database migration `add_lead_scoring_columns_and_history`** (via Supabase MCP):
  - 3 colunas em `leads`: `lead_score` (INT), `score_evaluated_at` (TIMESTAMPTZ), `scoring_model_used` (TEXT)
  - Tabela `lead_score_history`: id, tenant_id, lead_id (FK CASCADE), score (INT 0-100), previous_score, factors (JSONB), model_version, trigger_event, created_at
  - 4 índices + 2 RLS policies PERMISSIVE com `auth_tenant_id()`
- **Backend — `supabase/functions/commercial-lead-scoring/index.ts` (CRIADO — ~604 linhas, self-contained, v1)**:
  - **4 actions**: `score_lead` (individual com IA), `score_portfolio` (batch top/bottom), `get_dashboard` (KPIs + trend 7d), `batch_rescore` (batch por IDs, MAX_BATCH_SIZE=50)
  - **8 fatores de scoring** (pesos totalizam 100%):
    1. `calcDataCompleteness` (15%): email, phone, budget, region, interest, notes, person_id
    2. `calcSourceQuality` (12%): indicacao=95, walk_in=85, whatsapp=75, telefone=70, site=60, portal=50, outro=40
    3. `calcBudgetPresence` (15%): presença de budget_min/max + range health
    4. `calcEngagementRecency` (20%): dias desde last_contact_at (1d=100, 30d+=10)
    5. `calcInterestMatch` (10%): interest_type definido + property_id vinculado
    6. `calcRegionDemand` (10%): preferred_region definido + qualificação de regiões alta-demanda
    7. `calcInteractionCount` (10%): contagem de interactions via person_id (0=20, 1=40, 2=50, 3+=exponencial até 100)
    8. `calcAIBoost` (8%): OpenRouter → Gemini 2.0 Flash (JSON mode, temp 0.2) — avalia potencial de conversão. Fallback: score neutro 50
  - **Thresholds**: hot≥70, warm≥40, cold<40
  - **Batch scoring**: Pula IA (latência), usa apenas rule_engine_v1
  - **History**: Cada score salvo em `lead_score_history` com factors JSONB + model_version
  - **Self-contained**: Inline CORS whitelist, auth/tenant resolution via profiles.user_id
  - **Deploy**: v1 via Supabase MCP (ID: `2c87a78e-fda5-4830-af24-37d93370c3fb`, ACTIVE, verify_jwt: false)
- **Frontend hook — `src/hooks/useLeadScoring.ts` (CRIADO — ~196 linhas)**:
  - Types: `LeadScoreLevel`, `ScoringFactor`, `ScoreResult`, `ScorePortfolioResult`, `LeadScoringDashboard`, `BatchRescoreResult`
  - Constants: `SCORE_THRESHOLDS` (hot:70, warm:40), `SCORE_LEVEL_LABELS`, `SCORE_LEVEL_COLORS`, `SCORE_LEVEL_DOT_COLORS`
  - Helper: `getScoreLevel(score)` — retorna hot/warm/cold
  - Query hook: `useLeadScoringDashboard()` (staleTime 3min, refetchInterval 5min)
  - Mutation hooks: `useScoreLead()`, `useScorePortfolio()`, `useBatchRescore()` — invalidam ["leads"] + ["lead-scoring-dashboard"]
  - Pulse event wiring: 3 mutations emitem `emitPulseEvent()` com `event_type: "automation_executed"` + `metadata.action` diferenciado (lead_scored, portfolio_scored, batch_rescore)
- **Frontend UI integrada em 3 componentes existentes**:
  - `LeadDetailDialog.tsx` — Badge de score no header + botão "Pontuar" (Zap icon) com useScoreLead
  - `LeadKanbanBoard.tsx` — Score display no card (Flame icon, colored dot, level label)
  - `LeadsCRM.tsx` — KPI "Leads Quentes" + coluna Score na tabela + botão "Pontuar Todos" com useScorePortfolio
- **Bug encontrado pelo Buchecha (MiniMax M2.5)**: Pulse events usavam `event_type: "lead_created"` — semanticamente incorreto para scoring. Tabela `pulse_events` tem CHECK constraint com 17 valores — `"lead_scored"` NÃO existe. **Fix**: Alterado para `"automation_executed"` com `metadata.action` para distinguir (lead_scored, portfolio_scored, batch_rescore)
- **Build**: 0 erros TypeScript ✅
- **Arquivos criados** (2):
  - `supabase/functions/commercial-lead-scoring/index.ts` — Edge Function self-contained (~604 linhas)
  - `src/hooks/useLeadScoring.ts` — hook central lead scoring (~196 linhas)
- **Arquivos modificados** (3):
  - `src/components/leads/LeadDetailDialog.tsx` — score badge + botão Pontuar
  - `src/components/leads/LeadKanbanBoard.tsx` — score display no kanban card
  - `src/pages/LeadsCRM.tsx` — KPI Leads Quentes + coluna Score + botão Pontuar Todos
- **Edge Functions — Versões atualizadas**:
  - `commercial-lead-scoring` → version 1 (4 actions, 8 fatores, IA boost, self-contained, CORS whitelist)
- **Cronograma CRM IA-Native**: F1 Item #4 ✅ concluído (P04 Lead Scoring IA). **CRM F1: 4/13 itens concluídos**. Próximo: F1 Item #5
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
