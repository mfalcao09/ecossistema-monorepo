# Session 111 — F9 Exit Experience Architecture

**Data:** 2026-03-21
**Squad:** Claudinho (Claude Opus 4.6) + Buchecha (MiniMax M2.7)
**Fase:** Phase 4 — Offboarding Humanizado (1/2)
**Feature:** F9 — Exit Experience Architecture

## O que foi feito

### F9.1 — Migration
- 3 tabelas: `exit_interviews`, `exit_feedback`, `exit_analytics`
- `exit_interviews`: 8 exit_types, 5 exit_statuses, satisfaction_score (0-10), recommendation_likelihood (0-10 NPS), win_back_offer JSONB, AI fields (sentiment, churn_category, summary, recommendations)
- `exit_feedback`: 12 categories (real estate focused), rating + importance (1-5), AI sentiment/theme
- `exit_analytics`: Aggregated snapshots with `win_back_rate` GENERATED ALWAYS AS stored column
- RLS, indexes, triggers, realtime enabled

### F9.2 — Persona
- `exit_experience_ai` adicionada em `resolve-persona.ts`
- Entre `revenue_ltv_ai` e `churn_interceptor`
- Gemini 2.5 Flash, temperature 0.35
- Especialista em offboarding humanizado, exit interviews, win-back intelligence

### F9.3 — Edge Function
- `relationship-exit-intelligence/index.ts` (~400 lines)
- 12 actions: get_interviews, add_interview, update_interview, get_interview_detail, get_feedback, add_feedback, conduct_interview (AI), analyze_winback (AI), get_stats, get_analytics, generate_analytics, get_category_insights
- 2 AI tool declarations: exit_interview_analysis + winback_offer
- Auto-generates feedback items from AI analysis
- Auto-saves win-back offer on interview record

### F9.4 — Hook
- `useExitExperience.ts` (~400 lines)
- Types: ExitInterview, ExitFeedback, ExitAnalytics, ExitStats, CategoryInsight, GeneratedWinbackOffer + union types
- Direct Queries: useInterviewsDirect, useInterviewDetailDirect, useFeedbackDirect, useStatsDirect, useCategoryInsightsDirect
- Direct Mutations: useAddInterviewDirect, useUpdateInterviewDirect, useAddFeedbackDirect
- EF Mutations: useConductInterview, useAnalyzeWinback
- 20+ UI helpers (labels, emojis, colors)

### F9.5 — Page
- `ExitExperience.tsx` (~350 lines)
- Route: `/relacionamento/exit-experience`
- 3 Tabs: Entrevistas (filters, InterviewCard com Analisar IA/Win-back IA/Concluir/Cancelar), Feedback & Insights (category cards com rating/importance progress bars), Dashboard (by type, by sentiment, by status, win-back funnel)
- 6 KPIs header

### F9.6 — Route + Sidebar
- App.tsx: import ExitExperience + route
- AppSidebar.tsx: UserMinus icon import + sidebar entry

### F9.7 — Build
- tsc: 0 errors
- vite build: OOM na VM (recurso limitado), build OK no Vercel

## Bug fix
- `@supabase/auth-helpers-react` não disponível → substituído por `supabase.auth.getSession()` pattern

## Arquivos criados/modificados
- **CREATED**: `supabase/functions/relationship-exit-intelligence/index.ts`
- **CREATED**: `src/hooks/useExitExperience.ts`
- **CREATED**: `src/pages/ExitExperience.tsx`
- **MODIFIED**: `supabase/functions/_shared/resolve-persona.ts` (exit_experience_ai persona)
- **MODIFIED**: `src/App.tsx` (import + route)
- **MODIFIED**: `src/components/AppSidebar.tsx` (UserMinus import + sidebar entry)

## Status do Cronograma
- Phase 1 — Core Relationship (F1-F3): ✅
- Phase 2 — Engagement (F4-F6): ✅
- Phase 3 — Intelligence (F11-F12): ✅
- Phase 4 — Offboarding (F9-F10): 🔄 F9 ✅ | F10 pendente
