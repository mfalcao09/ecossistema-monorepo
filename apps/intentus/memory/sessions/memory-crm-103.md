# Sessão 103 — G03 Coaching IA para Corretores

**Data**: 21/03/2026
**Fase**: CRM F4 — Escala & Diferenciação (3/4)
**Item**: G03 — Coaching IA para Corretores (~20h)
**Status**: ✅ Completo

---

## O que foi feito

### 1. Migration — `add_coaching_ai_tables`
- **coaching_plans**: Planos de desenvolvimento individualizados (status, focus_areas, objectives JSONB, ai_recommendations)
- **coaching_sessions**: Sessões 1:1 com prep IA (ai_prep JSONB, metrics_snapshot JSONB, coach_rating 1-5)
- **coaching_action_items**: Itens de ação com tracking (8 categorias CHECK, 5 status CHECK, due_date, evidence)
- **broker_skill_assessments**: Avaliações de skills (8 dimensões JSONB, overall_score, assessment_type CHECK)
- RLS: tenant-based read, service_role full access
- Indexes: tenant_id, broker_id, status, scheduled_at, session_id, created_at
- Realtime enabled for all 4 tables

### 2. Edge Function — `commercial-coaching-ai`
- **Deploy ID**: `dd9d911a-6f5a-41c2-aa7b-ba5ff8b0cb96`
- Self-contained com inline CORS, auth, Gemini 2.5 Flash via OpenRouter
- **7 actions**:
  - `assess_broker_skills` — Analisa 90 dias de dados do corretor, IA avalia 8 skills (0-100)
  - `generate_coaching_plan` — Gera plano de desenvolvimento com objectives + weekly_actions
  - `prep_session` — IA prepara agenda para sessão 1:1 (talking points, coaching moments, recognition)
  - `save_session` — Salva/completa sessão com notes, takeaways, rating, action_items
  - `get_broker_development` — Retorna histórico completo de coaching do corretor
  - `get_team_overview` — Visão consolidada da equipe com needs_attention flag
  - `update_action_item` — Atualiza status/evidence de action items
- Fallback rule-based quando OPENROUTER_API_KEY ausente
- `fetchBrokerData()` com queries paralelas (interactions, deals, profiles, sentiments, leads)

### 3. Hook — `useCoachingAI.ts`
- 17 interfaces TypeScript completas
- 2 queries: `useTeamOverview()`, `useBrokerDevelopment(brokerId)`
- 5 mutations: `useAssessBrokerSkills()`, `useGenerateCoachingPlan()`, `usePrepSession()`, `useSaveSession()`, `useUpdateActionItem()`
- 8 UI helpers: getSkillLabel, getSkillIcon, getLevelColor, getLevelBgColor, getLevelLabel, getPriorityColor, getStatusColor, getScoreColor

### 4. Page — `CoachingAIPage.tsx`
- Rota: `/comercial/coaching-ia`
- 4 tabs:
  - **Visão Time**: KPIs, attention alerts, broker list com scores
  - **Corretor**: Header + 3 ações (Avaliar/Gerar Plano/Prep), RadarChart skills, plano ativo, evolução BarChart
  - **Sessão 1:1**: Prep IA (recognition, agenda, metrics, coaching moments), form de registro (topics, notes, rating)
  - **Action Items**: Stats (pending/completed/overdue), toggle-to-complete, lista

### 5. Route + Sidebar
- `App.tsx`: Route `/comercial/coaching-ia` → `CoachingAIPage`
- `AppSidebar.tsx`: Entry "Coaching IA" com icon Brain, roles admin/gerente

---

## Validação
- `npx tsc --noEmit` → 0 erros
- `npx vite build` → ✅ sucesso (warning chunk size pré-existente)
- EF deploy ativo

## Arquivos criados/modificados
| Arquivo | Ação |
|---------|------|
| `supabase/functions/commercial-coaching-ai/index.ts` | Criado |
| `src/hooks/useCoachingAI.ts` | Criado |
| `src/pages/comercial/CoachingAIPage.tsx` | Criado |
| `src/App.tsx` | Modificado (route) |
| `src/components/AppSidebar.tsx` | Modificado (sidebar entry) |

## Notas
- EF local (~38KB) é a versão legível; deploy via MCP usou versão minificada (funcionalidade idêntica)
- Buchecha (MiniMax M2.7) timeout na fase de arquitetura; implementação seguiu patterns do codebase diretamente
- Próximo item F4: **M02 — Filtros Avançados + Views Customizáveis (~24h)**
