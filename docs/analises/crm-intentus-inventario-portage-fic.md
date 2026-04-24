# Inventário do CRM do Intentus + Plano de porte para ERP-FIC

> **Data:** 2026-04-20 · **Autor:** Explore agent (via Claudinho)
> **Contexto:** ADR-018 + `docs/sessions/F1-S02-escopo-funcional.md` — Marcelo definiu que o módulo CRM do ERP-FIC será construído por **fork-and-adapt** do CRM do Intentus (`apps/intentus/`), não do zero.
> **Decisão a informar:** escopo real da sessão de implementação (antes chamada F1-S02, a renomear por conflito com plano V4).

---

## 1. Inventário do CRM do Intentus

### 1.1 Schemas Supabase (`apps/intentus/supabase/migrations/`)

| Tabela | Conteúdo |
|---|---|
| `leads` | 21 campos — status (novo/contatado/qualificado/visita_agendada/proposta/convertido/perdido), source (site/portal/indicacao/whatsapp/telefone/walk_in/outro), person_id, lead_score, score_evaluated_at, scoring_model_used |
| `commercial_visits` | visitas agendadas, feedback_rating |
| `commercial_proposals` | rascunho/enviada/aceita/recusada/expirada, proposed_monthly_value |
| `broker_goals` | metas por corretor |
| `deal_requests` + `deal_request_parties` + `deal_request_history` | Pipeline BPMN jurídico imobiliário com 14 status |
| `activity_logs` | Auditoria genérica |
| `teams` + `team_members` | RLS por time |
| `chat_contacts` + `chat_conversations` + `chat_messages` + `chat_channels` + `chat_queues` | Infra de conversas multi-canal (WhatsApp, Telegram, e-mail) |

### 1.2 Edge Functions `commercial-*` (23 EFs em `apps/intentus/supabase/functions/`)

**4 canônicas do plano V4:**
- `commercial-lead-scoring` — 8 fatores + Gemini 2.0 Flash (score_lead / score_portfolio / batch_rescore / get_dashboard)
- `commercial-pulse-feed` — feed central de ações com priorização IA
- `commercial-lead-chatbot` — qualificação BANT conversacional (streaming)
- `commercial-automation-engine` — 12 triggers + 8 ações (engine de automações)

**Suporte e avançadas:**
- `commercial-lead-capture` — captura inbound de portais
- `commercial-lead-dedup` — dedup por email/telefone
- `commercial-lead-distribution` — auto-assign (round-robin, carga, especialidade)
- `commercial-email-service` — SMTP/Gmail/Outlook/Resend (genérico)
- `commercial-sla-engine` — timeboxes por estágio
- `commercial-stalled-deals` — deals sem movimento
- `commercial-win-loss-analysis`, `commercial-deal-forecast`, `commercial-follow-up-ai`, `commercial-conversation-intelligence`, `commercial-broker-assistant`, `commercial-coaching-ai`, `commercial-gamification-engine`, `commercial-prospector-ai`, `commercial-views-engine`, `commercial-narrative-report`, `commercial-nurturing-engine`, `commercial-portal-integration`, `commercial-sales-assistant`

### 1.3 UI / Telas (`apps/intentus/src/`)

- `pages/LeadsCRM.tsx` — kanban + tabela + filtros + scoring + detail dialog
- `pages/DealsList.tsx` — kanban + wizard (StepSelectProperty/LinkParties/CommercialConditions)
- `pages/CommercialDashboard.tsx` — KPIs, funnel, top performers
- `pages/CommercialSlaDetails.tsx`
- `components/leads/` — LeadDetailDialog, LeadKanbanBoard, LeadChatbotDialog
- `components/deals/` — KanbanBoard, DealDetailDialog, DealWizard, SaleStagePipeline, SalesAssistantPanel, StalledDealsWidget

### 1.4 Hooks principais

`useLeads`, `useLeadScoring`, `useLeadChatbot`, `useLeadCapture`, `useLeadDeduplication`, `useLeadDistribution`, `useDealRequests`, `useDealCardFeatures`, `useDealForecast`, `useEmailCRM`, `useConvertLeadToDeal`, `useStalledDeals`, `useLabels`, `usePulseFeed`, `useCommercialAutomationEngine`, `useCardPreferences`, `useNotifications`

### 1.5 Libs de terceiros centrais

`@hello-pangea/dnd` (kanban DnD), `@tanstack/react-query`, `@supabase/supabase-js`, `@react-pdf/renderer` (propostas em PDF), `date-fns`, `sonner` (toasts), `lucide-react`.

---

## 2. Classificação de portabilidade

| Item | Categoria | Fit FIC | Ação |
|---|---|---|---|
| `leads` (schema + type) | Entidade | ✅ Reusa | Renomear `interest_type` → `interest_process` (matrícula/vestibular); `property_id` → `processo_seletivo_id`; opcional: `budget_min/max` → `expected_tuition_min/max` |
| Lead status enum | Entidade | ✅ Reusa | `convertido` = matrícula efetivada |
| Lead source enum | Entidade | 🟡 Adaptar | (portal→enem, walk_in→unidade_física, +evento) |
| `commercial_visits` | Entidade | 🟡 Adaptar | Entrevistas/visitas à unidade |
| `commercial_proposals` | Entidade | 🟡 Adaptar | Vira `enrollment_proposals`; `proposed_monthly_value` aplicável a parcelamento |
| `activity_logs` | Entidade | ✅ Reusa | Auditoria genérica |
| `teams`/`team_members` | Entidade | ✅ Reusa | Secretaria/coordenação/diretoria/comercial = times |
| `chat_*` (5 tabelas) | Entidade | ✅ Reusa | Não tem nada imobiliário |
| Email schema + `useEmailCRM` | Entidade | ✅ Reusa | Genérico |
| `deal_requests` (14 status BPMN) | Entidade | ❌ Substituir | Overkill jurídico; FIC precisa de `matriculas` com 3-4 status |
| `commercial-lead-scoring` | EF | 🟡 Adaptar | Trocar fatores (comprador/investidor → probabilidade_conversão: nota ENEM, renda prevista, engajamento) |
| `commercial-pulse-feed` | EF | ✅ Reusa | Feed genérico |
| `commercial-lead-chatbot` | EF | 🟡 Adaptar | BANT → CAMQ (Curso/Atuação/Matrícula/Questionário) |
| `commercial-automation-engine` | EF | ✅ Reusa | Adicionar triggers FIC (matricula_criada, documento_expirado, saldo_em_atraso) |
| `commercial-lead-dedup` | EF | 🟡 Adaptar | +CPF como chave (obrigatório FIC) |
| `commercial-lead-distribution` | EF | 🟡 Adaptar | +filtro por `curso_id` (coordenador) |
| `commercial-email-service` | EF | ✅ Reusa | Genérico; FIC pode substituir backend por Microsoft Graph (`@ecossistema/office365`) |
| `commercial-lead-capture` | EF | 🟡 Adaptar | Trocar portais imobiliários por ENEM/SAEB + formulário FIC |
| `LeadsCRM` page | UI | 🟡 Adaptar | Labels (Lead→Candidato), +coluna Curso |
| `DealsList` page | UI | ❌ Substituir | Criar `MatriculasList` simples |
| `CommercialDashboard` | UI | 🟡 Adaptar | KPIs (leads→candidatos, deals→matrículas, SLA→compliance docs) |
| Lead detail dialogs | UI | 🟡 Adaptar | +abas documentação (CPF/RG/ENEM) |
| Kanban (`@hello-pangea/dnd`) | UI | ✅ Reusa | Idêntico |
| Email compose | UI | ✅ Reusa | Idêntico (ou re-backed via Graph) |
| RLS policies | Security | ✅ Reusa | +RLS por curso (coordenador isolation) |

---

## 3. Lacunas — o que Intentus não tem e FIC precisa

| Lacuna | Recomendação |
|---|---|
| **Microsoft Graph integration** (ADR-018) | Novo package `@ecossistema/office365` (já planejado) + EF `office365-contact-sync` |
| **Matrícula bridge** (lead.convertido → `matriculas` do ERP-FIC) | Nova EF `lead-to-enrollment-bridge` — atomicamente: marca lead convertido, cria matrícula, dispara financeiro |
| **RLS por Curso** | Adicionar `curso_id` a `leads` + `chat_contacts`; policy análoga a `deal_requests_tenant_isolation` |
| **Documentação obrigatória** (CPF, RG, ENEM) | Nova `lead_documents` (lead_id, doc_type, file_url, verified_at, verified_by) |
| **Status de matrícula simplificado** | `candidate_enrollment` (4 status, não 14) ou `deal_requests` reduzido |
| **Webhook SIS legado** (FIC usa Lyceum/Sophia) | EF `webhook-outbound-fic` POST para SIS ao efetivar matrícula |
| **Ingestão ENEM/INEP** | Webhook inbound + EF `enem-candidate-ingestion` |
| **Parcelamento de anuidade** | EF `enrollment-installment-calculator` (anuidade + plano → parcelas) |

---

## 4. Recomendação tática

**Estratégia (a) — Copiar em bloco e adaptar seletivamente.** Não há `features/crm` pronto no Intentus (código está espalhado em `pages/`, `components/leads`, `components/deals`, `hooks/`). Proposto:

1. Criar `apps/erp-educacional/src/features/crm/` e copiar em bloco:
   - **Schemas** (migrations com renaming de vocabulário)
   - **4 EFs canônicas** + 5 de suporte (dedup, distribution, email-service, lead-capture, + nova bridge)
   - **Hooks** (`features/crm/hooks/`) com adaptação de nomes
   - **UI** (`features/crm/pages/`, `features/crm/components/`) — Kanban direto; dialogs adaptados
2. NÃO reescrever UI — ganha ~60% e ajusta só vocabulário
3. RLS + tenancy já testados no Intentus — copiar pattern
4. Integração Microsoft Graph via `@ecossistema/office365` é **adição nova** (não é no Intentus)

**Timeline estimada (1 dev dedicado):** 3 semanas — 1 sem. estrutura+migrations+EFs, 1 sem. UI+RLS por curso, 1 sem. integração Graph + testes

---

## 5. Implicações para o escopo da sessão

- **Nome da sessão** — "F1-S02" conflita com plano V4 Semana 4 (que também era CRM mas portava de outra forma); trocar por `F1-CRM-FIC` ou equivalente.
- **Escopo expande além do package `@ecossistema/office365`**: além da integração M365, entra fork completo do CRM Intentus — é ~3 sessões, não 1. Quebrar em:
  - `F1-CRM-FIC-01` — schemas + 4 EFs canônicas + hooks base (1 semana)
  - `F1-CRM-FIC-02` — UI adaptada + RLS por curso + MatriculasList (1 semana)
  - `F1-CRM-FIC-03` — `@ecossistema/office365` package + substituir `commercial-email-service` por backend Graph + testes E2E (1 semana)
- **Atualizar `F1-S02-escopo-funcional.md`** — mudar premissa de "construir do zero" para "fork do Intentus + adaptações + integração Graph"
