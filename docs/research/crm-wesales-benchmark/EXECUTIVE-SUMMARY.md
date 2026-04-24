# Executive Summary — WeSales CRM Benchmark

**Produto analisado:** WeSales CRM (whitelabel GoHighLevel, operado pela agência **Gestleads** no Brasil)
**Conta analisada:** MARCELO S B FALCAO's Account — location `Y7zRiUzHgMiV4SsmLhJK` — São Paulo, SP
**Metodologia:** Chrome MCP navegando conta logada do Marcelo (3 sessões, 2026-04-21)
**Arquivos gerados:** **39 documentos** (.md) + 1 design-tokens JSON curado

---

## 🎯 O que é WeSales em 1 linha

Plataforma all-in-one SaaS que **consolida 10+ categorias de produto** (CRM + Inbox + Calendar + Pipeline + E-commerce + LMS + Community + Sales Funnels + Websites + Social Planner + AI Agents + Ad Manager + Affiliate Program + Reputation Management + Analytics + 1306 integrations marketplace) numa única interface multi-tenant, com pricing agressivo (WhatsApp oficial a $11/mo vs $49-499 dos concorrentes BR).

---

## 📊 Escopo capturado (3 sessões)

### Sessão 1 — Captura ampla
17 seções top-level + modal "Add Contact" + sitemap + tokens baseline + README + features-matrix + gaps-intentus

### Sessão 2 — Drill inicial profundo
- WhatsApp Settings (paywall **$11/mês** LeadConnector)
- Custom Fields (**13 tipos** de campo + template interpolation mustache)
- Automation Workflow Builder (🔥 **AI-first BETA** — "chat with AI to build workflows" + voice input)
- AI Agents landing (marketing copy agressivo + 8 sub-surfaces IA)
- Agent Templates marketplace (Clara 78.2K installs, etc)

### Sessão 3 — Drill sistemático (esta)
- **10 novos drill docs** cobrindo sub-pages de cada seção top-level
- ~50 URLs visitadas
- Findings principais em cada área documentados

---

## 🔥 Top 10 findings críticos

### 1. Stack de pricing WhatsApp valida estratégia Jarvis
- WeSales **"WhatsApp Não Oficial"** (Baileys-style) = **grátis** (aquisição)
- WeSales **WhatsApp oficial via LeadConnector** = **$11/mês** (monetização)
- Confirma arquitetura dual do Jarvis (`apps/whatsapp-gateway` + WABA roadmap)

### 2. AI-first workflow creation (BETA)
- `/automation/workflows` tem prompt input **"Build workflows for free by chatting with AI"** + **voice input mic**
- Exemplos: "After sending a proposal, wait 24 hours then send SMS follow-up..."
- **Big bet pro Intentus:** ser primeiro CRM BR com "cria fluxo falando em português"

### 3. Agent Templates marketplace validado
- **Clara** (Service AI Receptionist): **78.2K installs**, Paid
- **Dental Appointment Booking**: **50.3K installs**, Free, by LeadConnector
- Model comprovado: third-party vendors monetizam, LeadConnector loss-leader
- Implicação: Intentus pode **consumir** templates ou **publicar** como vendor

### 4. Arquitetura AI completa (8 sub-surfaces)
- Agent Studio (multi-agent, folders, canvas builder, **version management**)
- Voice AI / Conversation AI (paywalled)
- **Knowledge Base** (multi-KB RAG)
- Agent Templates (marketplace)
- **Content AI** (text + **image** generation, 7 tipos: Social/Blog/Funnel/Website/Email/Conversation)
- Agent Logs (Sessions + Metrics, audit-ready)
- Branding premium: **"AI Employee plan"**

### 5. 13 tipos de Custom Fields + universal interpolation
- Single Line / Multi Line / Text Box List / Number / Phone / Monetary / Dropdown (Single/Multiple) / Radio / Checkbox / Date Picker / **File Upload** / **Signature**
- Todos geram unique key `{{ object.field }}` (mustache)
- **Signature field nativo** competindo com BRy embutido

### 6. Lead Scoring rules engine
- `/settings/scoring` com Engagement Score default seedado:
  - "if email is Opened" → +1 ponto
  - "if appointment Confirmed" → +1 ponto
- Builder permite N rules, N score models (Engagement, Churn Risk, etc)
- Feature raramente encontrada em CRMs SMB

### 7. E-commerce full-stack embutido
Módulo Payments tem: Invoices recurring + Estimates → Invoice conversion + Proposals/Contracts + Orders + **Abandoned Checkouts** + Subscriptions + Payment Links + Products + **Inventory** + Coupons + **Gift Cards** + 7 providers (**Mercado Pago para Brasil**, Stripe, PayPal, Authorize.net, Square, Adyen, Manual)

### 8. LMS + Community + Certificates + Gamification
- **GoKollab** como marca sub-branded pra Courses
- Courses (drip content, quizzes, certificates)
- Communities (Skool-style)
- **Credentials + Badges** dupla entidade (big milestones vs micro wins)
- Branded Mobile App whitelabel

### 9. Reporting ads-forward + Attribution nativa
- Google Ads + Facebook Ads native (não integração passiva)
- **First/Last-touch Attribution** com full UTM tracking
- Session Events com 11 colunas (Contact, Campaign, UTM Medium/Content/Source/Term, Referrer, URL Link, etc)
- Agent Report (produtividade por rep) + Appointment Report (Show/NoShow rate)
- **Local Marketing Audit** (SEO local score)

### 10. Compliance + Transparency operational
- **Audit Logs** com filtros por Module/Action/User (SOC2/LGPD ready)
- **Labs** beta program transparente (countdowns "Live in 9 days")
- **Custom Objects** enterprise-level
- **Private Integrations** (API v2.0) + 1306 apps marketplace
- **Brand Voice management** (cross-content consistency)

---

## 📈 Cobertura comparativa (features nativas %)

| Categoria | WeSales | Pipedrive | HubSpot All Hubs | Intentus hoje |
|-----------|:-------:|:---------:|:----------------:|:-------------:|
| CRM Core | 95% | 90% | 100% | 35% |
| Inbox/Conversations | 90% | 35% | 85% | 10% |
| Pipeline/Deals | 95% | 100% | 100% | 40% |
| Calendar/Booking | 90% | 30% | 95% | 5% |
| Automation | 100% | 60% | 100% | 30% |
| Marketing | 95% | 20% | 90% | 5% |
| Sites/Funnels | 95% | 0% | 60% | 0% |
| Payments/E-com | 95% | 15% | 30% | 10% |
| LMS/Community | 90% | 0% | 0% | 20% |
| AI Agents | 95% | 0% | 40% | 15% |
| Reporting | 95% | 50% | 95% | 15% |
| Reputation | 90% | 0% | 0% | 0% |
| Settings/Admin | 95% | 70% | 95% | 25% |
| **MÉDIA** | **94%** | **38%** | **74%** | **16%** |

---

## 🎯 Priorização Quick Wins (ICE score)

| Rank | Feature | ICE Score | Deploy em |
|-----:|---------|:---------:|-----------|
| **#0** | AI prompt-to-workflow (linguagem natural → fluxo) ⭐⭐ | 400 | atnd-s8a v2 |
| **#1** | Custom Values globais `{{ x }}` em templates | 576 | atnd-s5 |
| **#2** | Snippets em conversations | 567 | atnd-s5 |
| **#3** | Team Inbox vs My Inbox | 540 | atnd-s8b |
| **#4** | Right-rail contextual (9-slot) em conversation | 504 | atnd-s8b |
| **#5** | Trigger Links rastreáveis (UTM + workflow trigger) | 486 | atnd-s5 |
| **#6** | WhatsApp dual stack (Baileys + WABA oficial) | 500 | jarvis-gateway |
| **#7** | Lead Scoring nativo (Engagement Score pattern) | 320 | atnd-s4 v2 |
| **#8** | Manual Actions queue (fila SDR) | 320 | atnd-s4 v2 |
| **#9** | SLA Settings + alertas | 280 | atnd-s7 v2 |
| **#10** | Conversation AI com handoff | 450 | Jarvis V2 |

---

## 🗂 Navegação deste benchmark (39 arquivos)

### Docs principais (ler primeiro)
- `README.md` — visão geral
- **`EXECUTIVE-SUMMARY.md`** ← este arquivo
- `CAPTURE-LOG.md` — histórico das 3 sessões
- `sitemap.md` — 17 seções + URLs
- `features-matrix.md` — comparação vs Pipedrive/HubSpot/outros
- `gaps-intentus.md` — ICE-scored roadmap

### Docs por seção (high-level + drills)
Cada seção tem 1 doc high-level + 0-2 drill docs conforme descobertas:

- `sections/01-launchpad.md` + `01-dashboard.md`
- `sections/03-conversations.md` + **`03-conversations-subpages.md`** (SLA Settings!)
- `sections/04-calendars.md`
- `sections/05-contacts.md` + **`05-contacts-subpages.md`** (Tasks, Bulk history, Companies)
- `sections/06-opportunities.md`
- `sections/07-payments.md` + **`07-payments-subpages.md`** (7 providers, Mercado Pago BR)
- `sections/08-ai-agents.md` + **`08-ai-agents-drill.md`** + **`08-ai-agents-complete-drill.md`** ⭐
- `sections/09-marketing.md` + **`09-marketing-subpages.md`** (Brand Voice, LinkedIn Ads!)
- `sections/10-automation.md` + **`10-automation-drill.md`** ⭐ (AI-first BETA)
- `sections/11-sites.md` + **`11-sites-subpages.md`** (13 sub-items: Quizzes, QR Codes, WordPress!)
- `sections/12-memberships.md` + **`12-memberships-subpages.md`** (GoKollab, Certificates+Badges)
- `sections/13-media-storage.md`
- `sections/14-reputation.md` + **`14-reputation-subpages.md`** (AI Summary, Video Testimonials, Listings paid)
- `sections/15-reporting.md` + **`15-reporting-subpages.md`** (Attribution full UTM)
- `sections/16-app-marketplace.md`
- `sections/17-settings.md` + **`17-settings-whatsapp.md`** + **`17-settings-custom-fields.md`** + **`17-settings-subpages.md`** (10+ settings drills)
- `sections/modal-add-contact.md`

### Tokens + Screenshots
- `tokens/design-tokens-summary.md` — 765 CSS vars curated (GHL whitelabel tokens)
- `screenshots/README.md` — instruções pra Marcelo fazer uploads manuais

---

## 🎬 Recomendação para consumo

### Se tiver 10 minutos
Leia **EXECUTIVE-SUMMARY.md** + **README.md** + top 5 seções em `gaps-intentus.md`.

### Se tiver 1 hora
Acima + todos os **drill docs** (marcados com ⭐). Foco em:
1. `10-automation-drill.md` (AI workflow builder BETA)
2. `08-ai-agents-complete-drill.md` (arquitetura AI)
3. `17-settings-whatsapp.md` (pricing model)

### Se tiver 1 dia
Leia todos os 39 docs. Boa sequência:
- Dia: sitemap → README → features-matrix → gaps-intentus
- Tarde: all section docs em ordem
- Final: EXECUTIVE-SUMMARY + CAPTURE-LOG

---

## ✅ Completude do benchmark

| Dimensão | Status |
|----------|:---:|
| 17 seções top-level | ✅ 100% |
| Sub-pages drilled | ✅ ~50 URLs |
| Modais (Add Contact, Create Agent, Add Field) | ✅ 3+ |
| Design tokens (765 vars) | ✅ curado |
| Marketing copy capturado | ✅ |
| Feature matrix vs concorrentes | ✅ |
| Gap analysis Intentus | ✅ ICE-scored |
| Screenshots persistentes | ❌ (Chrome MCP limitation — Marcelo fará manualmente) |
| Voice AI/Conversation AI drilled | ❌ (feature-gated, spinner infinito) |
| Phone System drilled | ❌ (2FA bloqueou, respeitado) |
| GIF recordings de fluxos | ❌ (skipado por budget) |
| Mobile responsive | ❌ (skipado) |

**Completude ponderada: ~85% do capturável sem ativar subscriptions/setup.**
