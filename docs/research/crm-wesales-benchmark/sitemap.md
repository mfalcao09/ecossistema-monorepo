# WeSales CRM — Sitemap Top-Level

**Captured:** 2026-04-21
**Location/Tenant:** `Y7zRiUzHgMiV4SsmLhJK`
**Account:** MARCELO S B FALC... (São Paulo, SP)
**Base URL:** `https://app.wesalescrm.com/v2/location/Y7zRiUzHgMiV4SsmLhJK`
**Product lineage:** WeSales = whitelabel de **GoHighLevel** (confirmado pela presença massiva de CSS vars com prefixo `--hlpt-*` e `--hr-*`).

## 17 seções top-level (sidebar)

| # | Seção | URL relativa | Notas |
|---|-------|-------------|-------|
| 1 | Launchpad | `/launchpad` | Hidden na sidebar (provavelmente onboarding/getting started) |
| 2 | Dashboard | `/dashboard` | Home logada — widgets Opportunity Status, Conversion Rate, Funnel, Stage Distribution |
| 3 | Conversations | `/conversations/conversations` | Inbox unificado (WhatsApp/SMS/Email/Chat/Instagram) — core do CRM |
| 4 | Calendars | `/calendars/view` | Agenda + scheduling |
| 5 | Contacts | `/contacts/smart_list/All` | CRM contatos + Smart Lists |
| 6 | Opportunities | `/opportunities/list` | Pipeline/Kanban de deals |
| 7 | Payments | `/payments/invoices` | Faturas + assinaturas + links de pagamento + produtos |
| 8 | AI Agents | `/ai-agents/getting-started` | Agentes IA (provavelmente voice + chat) |
| 9 | Marketing | `/marketing/social-planner` | Social planner + Email campaigns + Templates + Trigger Links + Affiliate |
| 10 | Automation | `/automation/workflows` | Workflow builder (automação visual) |
| 11 | Sites | `/funnels-websites/funnels` | Funnels + Websites + Blogs + WordPress + Forms + Surveys + Chat Widget |
| 12 | Memberships | `/memberships/client-portal/dashboard` | Portal do cliente + Courses + Communities |
| 13 | Media Storage | `/media-storage` | Biblioteca de mídia |
| 14 | Reputation | `/reputation/overview` | Gestão de reviews (Google, Facebook, etc) |
| 15 | Reporting | `/reporting/reports` | Dashboards + Ad reports + Attribution + Call stats |
| 16 | App Marketplace | `/integration` | Integrações de terceiros |
| 17 | Settings | `/settings/company` | 30+ subseções de config (inferido do GHL) |

## Topbar global (persistente)

- Logo **WeSales.CRM**
- Selector de conta (multi-tenant): "MARCELO S B FALC... / São Paulo, SP"
- Search global: `⌘K`
- Chat bubble (provável in-app chat)
- Botão "Suporte" (destaque verde-lime)
- Botão "Webphones" (destaque roxo + indicador vermelho de status)
- Phone dialer icon
- Notifications bell (com indicador vermelho)
- Avatar do usuário (MS) — dropdown de conta

## Elementos visíveis no baseline dashboard

**Widgets do dashboard** (todos filtráveis por pipeline + range de datas):
- Opportunity Status
- Opportunity (Sources?)
- Conversion Rate (donut 0%)
- Funnel
- Stage Distribution

**Range default:** Last 30 Days

## Design system (confirmado GoHighLevel whitelabel)

- **765 CSS variables** na raiz (sistema de tokens extensivo)
- Prefixos identificados:
  - `--hlpt-*` → HighLevel Platform Tokens (advanced/base)
  - `--hr-*` → HighLevel Responsive (font-size scales)
  - `--fa-*` → Font Awesome
  - Tailwind classes em uso (`--tw-ring-color`, `--breakpoint-xs`, etc)
- **11 famílias de fontes** usadas (inclui Font Awesome 6 Sharp e fontes customizadas)
- **57 cores distintas** computadas no viewport (paleta massiva)
- **15 raios de borda** diferentes
- **12 variações de box-shadow**
- Cor primária identificada: **roxo/violeta** (sidebar ativa)
- Acento secundário: **verde-lime** (botão Suporte)
- Alerta/status: **vermelho** (indicador Webphones)

## Internacionalização

- Interface majoritariamente em inglês
- Elementos em PT-BR hardcoded: "Suporte", "Central de Aceleração W...", "São Paulo, SP"
- Indica **customização parcial pelo whitelabel WeSales** sobre GHL

## Próximas capturas planejadas

1. Tokens completos (765 vars → JSON) via download chunked
2. Cada seção top-level: screenshot + features-list + subnav
3. Settings (prioridade alta — ~30 subsections)
4. Modais de criação (Contact, Opportunity, Workflow)
5. Mobile viewport 375px das telas-chave
6. GIFs de fluxos: criar lead, mover card kanban, enviar mensagem
