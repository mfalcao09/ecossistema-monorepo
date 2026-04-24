# 09.x — Marketing sub-pages

## 09.1 — Emails (`/marketing/emails/statistics`)

### Título
"Email Marketing"

### Sub-tabs (3)
- **Statistics** (active) — analytics de engagement
- **Campaigns** — lista de campanhas
- **Templates** — biblioteca de templates

### Sample data banner
> You're viewing sample data. Create your own campaign to see real data.

CTAs: `Clear sample data` / `+ Create campaign`

### Filtros de analytics
- `All Campaigns` dropdown
- Date range picker (default: Apr 15 → Apr 21 = últimos 7d)

### Engagement Summary chart
Métricas: Delivered / Opens / Clicks / Conversions (chart de barras horizontal com cumulative %)

### Observação
Onboarding experiente: mostra dados de exemplo até o usuário criar campanha real. Pattern comum em SaaS pra demonstrar valor antes de exigir input.

---

## 09.2 — Countdown Timers (`/marketing/countdown-timer`)

### Descrição
"Create and manage your countdown timer templates"

### CTAs
`+ New` + `Filters` + Search

### Colunas
Name, Type, **End Date/Duration**, Created on

### Empty state
"Create your first countdown timer / Time's not ticking yet! Let's set your first countdown timer."

### Types inferidos
Provável 2 tipos:
- **Fixed end date** (ex: Black Friday 30/11 às 23:59)
- **Duration-based / Evergreen** (ex: 24h contagem reiniciada quando lead chega)

---

## 09.3 — Affiliate Manager (`/marketing/affiliate-manager`)

### Status atual
Redirecionou para um formulário **"Feedback / Talk to us!"** — feature não ativada na conta do Marcelo.

### Subnav completa (conhecida)
- Dashboard
- **Campaign** (programas)
- **Affiliate** (lista de afiliados)
- **Payout** (pagamentos)
- **Media** (materiais para afiliados)
- **Settings**

### Interpretação
Affiliate Manager é feature-gated (precisa ativação). Quando ativo, provavelmente oferece: programas por produto, taxa % de comissão, cookie de atribuição, portal do afiliado com tracking links + media kit + payout reports.

---

## 09.4 — Brand Boards ⭐ (`/marketing/brand-boards`)

### Descrição
"Personalize your texts, colors, and other brand essentials"

### Sub-tabs
- **Design Kit** (active) — identidade visual
- **Brand Voice** (!) — tom de voz ⭐

### Global settings button
Provável: default brand, colors fallback, type scale

### Design Kit
"Customize your brand's visual identity by managing **logos, colors, and design elements** for consistent communication across all platforms."

CTA: `Add Design Kit`
Colunas: Title, Updated on, Status

### Brand Voice (descoberta!) ⭐
Feature separada de **brand voice management** — tom de voz editorial. Likely integra com:
- **Content AI** (prompts respeitam brand voice)
- **Social Planner** (posts seguem o tom)
- **Emails** (copy aderente)

Pattern que valida o mesmo approach do **brand-voice plugin** que Marcelo já tem no Claude Code (memory: `project_nexvy_whitelabel_research`).

### Multi-brand
Lista de Design Kits sugere que uma mesma location pode ter N marcas (brand boards), e cada peça de conteúdo escolhe qual board usar.

---

## 09.5 — Ad Manager (`/marketing/ad-manager/home`)

### Headline
**"Welcome To Ad Manager"** / "One Platform. Unlimited Possibilities"

### Value props (copy nativo)
- 🚀 **Launch and Manage Ads across Facebook, Google & LinkedIn** all in one place.
- 📊 **Track Performance, Conversions, and ROI** with Detailed [Reports]

### Observação
**LinkedIn Ads** é o diferencial — Pipedrive/HubSpot têm Google+Meta mas poucos têm LinkedIn nativo. Relevante pra B2B (Intentus se vender pra imobiliárias enterprise).

---

## 09.6 — Social Planner, Snippets, Trigger Links

Já cobertos em `09-marketing.md` (sessão 1) — social planner com 10 redes (Facebook, Instagram, Threads, GBP, LinkedIn, TikTok, YouTube, Pinterest, Community, Bluesky), 5 tipos de post (Evergreen, Recurring, RSS, Schedule Now, Upload CSV).

---

## Gap summary Marketing

| Feature | WeSales | Intentus hoje | Gap |
|---------|:---:|:---:|:---:|
| Email campaigns + templates | ✅ | ❌ | ALTO |
| Sample data onboarding | ✅ | ❌ | MÉDIO |
| Countdown Timers (urgência) | ✅ | ❌ | BAIXO |
| Affiliate Manager | ✅ | ❌ | BAIXO |
| **Brand Voice management** ⭐ | ✅ | ⚠️ (plugin Claude) | MÉDIO-ALTO |
| Multi-brand Design Kits | ✅ | ❌ | MÉDIO |
| Ad Manager (FB+Google+**LinkedIn**) | ✅ | ❌ | ALTO para B2B |
| Social Planner (10 redes) | ✅ | ❌ | ALTO |
