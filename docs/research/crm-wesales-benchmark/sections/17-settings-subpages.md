# 17.x — Settings sub-pages (drill completo)

## 17.x.1 — Business Profile (`/settings/company`)

### Headline
"Business Profile Settings / Manage your business profile information & settings"

### Layout em 2 colunas

#### General Information
- **Location ID** `Y7zRiUzHgMiV4SsmLhJK` (mostrado, copiável)
- **Business Logo** — upload 350×180px, max 2.5MB
- **Friendly Business Name** (editável): "MARCELO S B FALCAO's Account"
- **Legal Business Name** — "Enter the exact legal business name, as registered with the EIN"

#### Business Physical Address
- Street Address: "Av. Mal Mario Guedes 2 2"
- City: São Paulo / Postal/Zip: 05348-010
- State/Prov/Region: SP / Country: Brazil

### Observação
**EIN** (Employer Identification Number) — campo US. No Brasil equivale ao CNPJ. Sistema não adapta nomenclatura ao país da localization — friction UX pra mercado BR.

---

## 17.x.2 — My Staff ⭐ (`/settings/staff/team`)

### Filtros
- **User Role** dropdown
- Search: name, email, phone, ids

### CTA
`+ Add User`

### Tabela
Colunas: **Name, Email, Phone, User Type, Action** (edit/delete/revoke)

### Usuário visível (Marcelo)
- Nome: MARCELO S B FALCAO
- Email: `marcelolsf@outlook.com.br`
- User ID: `8UfAeRtHl6cqRaDmc79L`
- **User Type: ACCOUNT-ADMIN**

### Tiers inferidos
GHL standard: Admin / User / (custom roles via RBAC). User Role dropdown permite filtrar. Add User provavelmente abre modal com invite flow + role assignment + permission config.

---

## 17.x.3 — Objects ⭐ (`/settings/objects`)

### Descrição
"Manage and access all standard and custom objects. Create, edit, and update your objects easily"

### CTA
`+ Add custom object`

### Standard objects (built-in, 3)

| Object | Descrição |
|--------|-----------|
| **Opportunities** | Contains list of all deals, their stages, statuses and pipeline progress. |
| **Contacts** | Contains list of all leads, their details, and specifications |
| **Companies** | Contains list of all businesses, their details, and contact information. |

### Custom objects
User-defined pra verticalização. Ex: "Imóvel", "Aluno", "Matrícula", "Processo Jurídico".

### Gap crítico
Custom Objects é **feature enterprise** — Pipedrive não tem (só HubSpot Enterprise). Essencial pra Intentus Real Estate / ERP-Educacional FIC modelarem entidades nativas.

---

## 17.x.4 — Custom Values ⭐ (`/settings/custom_values`)

### Descrição
"Add, edit and delete your custom values."

### CTAs
`+ Add folder` / `+ Add custom value`

### Tabs
- **All values**
- **Folders**

### Colunas
Name / Folder / **Key** / Value

### Uso
Variáveis globais reutilizáveis em templates. Ex:
- Key `{{ company.phone }}` → Value `(11) 99999-9999`
- Key `{{ campaign.promo_name }}` → Value `Black Friday 2026`

Quando editado, todos os emails/SMS/WhatsApp templates que referenciam `{{ company.phone }}` atualizam automaticamente. **Source of truth único** pra strings reutilizáveis.

---

## 17.x.5 — Manage Scoring ⭐ (`/settings/scoring`)

### Descrição
"Use the score builder to add/subtract scores in a profile and publish it to make it live."

### CTA
`+ Add new rule`

### Engagement Score (modelo default)
Rules visíveis:
1. if an email is - **Opened** → Add Points: **1**
2. if an appointment Status is - **Confirmed** → Add Points: **1**

(2 regras default seedadas no onboarding)

### Colunas
Action / Calculation

### Arquitetura inferida
- **N regras por modelo** (pode criar Fatality Score, Churn Risk Score, etc)
- Each rule: {trigger, action (add/subtract), points}
- Profile tem score acumulado — usado em workflows ("if Engagement Score > 50 → mover pra pipeline Quente")

---

## 17.x.6 — Integrations (OAuth apps) ⭐ (`/settings/lc-integrations`)

### Descrição
"Integrations / All Integrations / Search Integrations"

### OAuth integrations oficiais (seed visível)

| Integration | Features |
|-------------|----------|
| **Google Calendar** | "moved to My Profile or Calendar Settings > Connections" |
| **Google** | Drive, Sheets, Gmail, Analytics, AdWords |
| **Facebook** | Auto-sync ad leads, DMs, reviews/comments on Pages + Instagram |
| **LinkedIn** | (Connect) |
| **Slack** | Channel notifications |
| **Clio** | Legal practice management (legal vertical) |
| **Canva** | Design |
| **WooCommerce** | E-com customer/order sync |
| **Shopify** | E-com customer/order sync |
| **Printful** | Print-on-demand dropshipping |
| **Printify** | POD variant |
| **Shippo** | Shipping rates |
| **Shipstation** | Fulfillment |
| **ClickUp** | Project management tasks |
| **Notion** | Workspace sync |
| **Google Contacts** | Contact sync |

*(lista completa via scroll tem ~30-50 integrations oficiais além dos 1306 do Marketplace)*

---

## 17.x.7 — Private Integrations (`/settings/private-integrations`)

### Descrição
"API v2.0 / Start by creating a private integration / Private integrations are a simple yet secure way to integrate your account with third-party apps."

### CTA
`Create new integration`

### Interpretação
Permite gerar **API keys próprias** + configurar **OAuth apps custom** do próprio usuário sem publicar no Marketplace. Pattern similar a Slack Custom Apps ou Notion Internal Integrations.

Relevante pra Intentus construir integração WeSales → Intentus API privada.

---

## 17.x.8 — Labs ⭐ (beta flags) (`/settings/labs`)

### Headline
"Labs / Test out the new features before everyone else"

### Copy
"Welcome to our Beta Program / Experiment with our latest and greatest features before they're available to everyone. These features are in early access and may change as we develop them. Your feedback will help shape what they become."

### Features beta observadas
| Feature | Descrição | Live em |
|---------|-----------|:---:|
| Funnels in Courses | Include Funnels as Course Lessons | 29 days |
| Adaptive Timezone feature In CDT | Timezone-Aware Countdown Timers | 13 days |
| Knowledge Base Google Sheets Integration | Connect Google Sheet as dynamic data source for KB | 9 days |

### Pattern
Cada feature beta tem:
- Toggle para ativar
- `Activate now - Live in X days` (countdown)
- `Submit Feedback` button

### Observação
Pipeline de product-led development transparente. Usuário vê o que vem (expectativa), testa antes, feedback loop direto. Excelente UX.

---

## 17.x.9 — Audit Logs ⭐ (`/settings/audit/logs`)

### Descrição
"Track and monitor all system activities, user actions, and data changes across your account"

### Filtros
- Search by Document ID
- Select users
- **Module** - All
- **Action** - All

### Colunas
Name / **Module** / **Action** / **Done By** / **Date & Time**

### Log entry observado
- Name: MARCELO S B FALCAO (`g8vr0KyCLYMcLTiouYg5`)
- Module: **Contacts**
- Action: **Created**
- Done By: Y7 (location ID start)
- Context: `Y7zRiUzHgMiV4SsmLhJK / Clientportal`
- Date: Apr 21, 2026 at 7:26 PM -03

### Compliance
Audit Logs permite exportar para **SOC2 / LGPD compliance** — quem fez o quê quando. Feature crítica pra enterprise/regulated.

---

## 17.x.10 — Tags (`/settings/tags`)

### Descrição
"Create and manage labels for contacts that help you organize data and run automations"

### CTA
`+ New tag`

### Colunas
Tag name / Created on / Updated on

### Pattern
Tags são usadas como atributo many-to-many em Contact/Opportunity. Referenciáveis em workflows (trigger: "tag added: hot-lead") e filters (smart lists).

---

## Sub-pages não drilled (com motivo)

| Sub-page | Motivo |
|----------|--------|
| My Profile | Config pessoal do user, low info content |
| Billing | Info financeira sensível — não invadir |
| Opportunities & Pipelines | Já vazio na sessão anterior |
| Calendars settings | Requer calendar configurado |
| Email Services | Requer SMTP setup (risco) |
| Phone System | Bloqueado por 2FA (sessão anterior) |
| WhatsApp | Já drilled em `17-settings-whatsapp.md` |
| Custom Fields | Já drilled em `17-settings-custom-fields.md` |
| Domains & URL Redirects | Requer DNS config |
| External Tracking | Requer GTM/Pixel setup |
| Brand Boards (settings) | Drilled em `09-marketing-subpages.md` |

---

## Gap summary Settings (vs Intentus)

| Feature | WeSales | Intentus atnd-s6 |
|---------|:---:|:---:|
| Multi-tenant (Locations) | ✅ | ⚠️ |
| Business Profile + Logo | ✅ | ⚠️ |
| User Roles (ACCOUNT-ADMIN + User) | ✅ | ⚠️ (15×5 PermissionMatrix) |
| Add User + invite flow | ✅ | ⚠️ |
| **Custom Objects** ⭐ | ✅ | ❌ |
| Custom Fields (13 tipos) | ✅ | ⚠️ |
| **Custom Values globais** ⭐ | ✅ | ❌ |
| **Lead Scoring (rules engine)** ⭐ | ✅ | ❌ |
| 30+ OAuth Integrations | ✅ | ❌ |
| Private Integrations (API v2.0) | ✅ | ⚠️ |
| **Beta Labs flags** ⭐ | ✅ | ❌ |
| **Audit Logs (SOC2/LGPD ready)** ⭐ | ✅ | ⚠️ (postgres trigger basic) |
| Tags | ✅ | ⚠️ |
| EIN/CNPJ localization | ❌ (não adapta) | ⚠️ |
