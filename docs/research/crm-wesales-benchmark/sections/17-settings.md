# 17 — Settings

**URL:** `/settings/company`
**Organização:** 3 grupos de navegação (My Business, Business Services, Other Settings)

## Estrutura completa do subnav

### 🏢 MY BUSINESS
- **Business Profile** — `/settings/company` (default)
- **My Profile** — `/settings/profile` (perfil do usuário)
- **Billing** — `/settings/company-billing/billing`
- **My Staff** — `/settings/staff/team` (gestão de usuários + permissões)
- **Opportunities & Pipelines** (config de stages/pipelines)

### 🛠 BUSINESS SERVICES
- **Calendars** — `/settings/calendars` (tipos de agenda: Round Robin, Class, Event...)
- **Email Services** — `/settings/smtp_service` (SMTP custom, domain reputation)
- **Phone System** — `/settings/phone_system` (Twilio, numbers, LC Phone)
- **WhatsApp** — `/settings/whatsapp` ⭐ (config de integração WABA + não-oficial)

### ⚙️ OTHER SETTINGS
- **Objects** — `/settings/objects` (entidades custom — escala tipo "Companies" mas customizáveis)
- **Custom Fields** — `/settings/fields`
- **Custom Values** — `/settings/custom_values` (variáveis globais reusáveis em templates)
- **Manage Scoring** — `/settings/scoring` (lead scoring)
- **Domains & URL Redirects** — `/settings/domain`
- **External Tracking** — `/settings/external-tracking` (GTM, FB Pixel, etc)
- **Integrations** — `/settings/lc-integrations` (OAuth apps)
- **Private Integrations** — `/settings/private-integrations` (API keys próprias)
- **Tags** — `/settings/tags`
- **Labs** (New) — `/settings/labs` (features beta)
- **Audit Logs** — `/settings/audit/logs`
- **Brand Boards** (New) — multi-brand (cross-ref com Marketing > Brand Boards)

## Features críticas

### Lead Scoring (`/settings/scoring`)
Não visto ainda em Pipedrive/Intentus BR. Permite regras: `+10 pts se abriu email`, `+20 se clicou CTA`, `+50 se agendou demo`, `-30 se unsubscribe`.

### Custom Objects
Beyond Contacts + Companies + Opportunities, WeSales permite criar **entidades customizadas** (ex: `Imóvel`, `Aluno`, `Turma`, `Processo jurídico`). Crítico pra verticalização.

### Custom Values (globais)
Variáveis reutilizáveis em templates — tipo `{{company.phone}}`, `{{campaign.cta_text}}`. Versus configurar em cada email/SMS individualmente.

### Private Integrations
API keys próprias + webhook endpoints custom. Parecido com "Apps" privados do Slack — permite dev interno sem publicar no marketplace.

### WhatsApp settings dedicado (`/settings/whatsapp`)
Config separada para integração. Merece drill próprio.

### Brand Boards (New)
Multi-brand num mesmo location? Ou templates de marca reutilizáveis. Cross-ref com Marketing > Brand Boards.

## Gaps visíveis (não apareceram no subnav capturado)

Features GHL-padrão que provavelmente existem mas não expostas nessa captura (requer drill):
- **API Keys & Webhooks** (provavelmente dentro de Private Integrations)
- **Permissions / Roles** (dentro de My Staff)
- **Conversation Providers** (em Phone System ou WhatsApp)
- **Email Templates system-level** (dentro de Email Services)
- **Conversation AI settings** (dentro de AI Agents ou Conversations > Settings)

## Observação

Settings de WeSales é **config enterprise-grade**. Um CRM imobiliário simples não tem Audit Logs, Custom Objects, Lead Scoring, Labs. Isso indica:
- Plataforma madura com longo roadmap
- Customers target incluem empresas com compliance rigoroso
- Developer ecosystem ativo (Private Integrations)

## Comparação

| Feature | WeSales | Pipedrive | HubSpot | Intentus |
|---------|---------|-----------|---------|----------|
| Custom Objects | ✅ | ❌ | ✅ (Enterprise) | ❌ |
| Lead Scoring | ✅ | ⚠️ | ✅ | ❌ |
| Custom Values globais | ✅ | ⚠️ | ✅ | ❌ |
| Private Integrations | ✅ | ✅ | ✅ | ⚠️ |
| Audit Logs | ✅ | ⚠️ | ✅ | ⚠️ (postgres) |
| Brand Boards | ✅ | ❌ | ❌ | ❌ |
| Labs (beta flags) | ✅ | ❌ | ⚠️ | ❌ |
