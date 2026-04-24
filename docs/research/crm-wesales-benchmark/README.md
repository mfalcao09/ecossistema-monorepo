# WeSales CRM — Benchmark completo

> ## ⚠️ NOTA CRÍTICA DE ATRIBUIÇÃO
>
> **WeSales NÃO é um produto próprio — é uma revenda whitelabel (agência) da plataforma GoHighLevel (GHL)**.
>
> - **Plataforma-mãe:** [GoHighLevel](https://www.gohighlevel.com) (alguns lugares: HighLevel / LeadConnector)
> - **Vendor técnico:** LeadConnector (confirmado no marketplace de apps e setup WhatsApp)
> - **Operador whitelabel BR:** Gestleads (`growth@gestleads.com` — descoberto no fluxo 2FA do Phone System)
> - **Rebranding WeSales:** logo + labels PT-BR ("Suporte", "Central de Aceleração We Sales", "WhatsApp Api Não Oficial") + domínio `app.wesalescrm.com`
> - **Confirmação técnica:** 765 CSS vars com prefixo `--hlpt-*` (HighLevel Platform Tokens) + `--hr-*` + vendor oficial "LeadConnector" visível no App Marketplace
>
> **Consequência pra benchmark:** tudo que aparece aqui é, na prática, feature do **GoHighLevel**. Um benchmark direto do GHL (sem intermediário whitelabel) deve ser feito em sessão paralela para comparar:
> - Pricing oficial GHL vs WeSales (provável markup do whitelabel)
> - Features liberadas em tier pago no GHL oficial mas escondidas no WeSales
> - Roadmap público do GHL vs "Labs" do WeSales
> - Documentação oficial vs material da Gestleads

> Captura estrutural, funcional e competitiva da plataforma **WeSales** (whitelabel de GoHighLevel), conduzida em **3 sessões em 2026-04-21** via Chrome MCP na conta logada do Marcelo (`MARCELO S B FALCAO's Account / São Paulo, SP`, location `Y7zRiUzHgMiV4SsmLhJK`).
>
> **Ver `CAPTURE-LOG.md`** para histórico detalhado das sessões e bloqueios encontrados.

## TL;DR

- WeSales = **GoHighLevel (GHL) whitelabel** operado pela **Gestleads** (`growth@gestleads.com` — contato descoberto no fluxo 2FA). Vendor técnico: **LeadConnector**. 765 CSS vars com prefixo `--hlpt-*` confirmam lineage GHL.
- **17 seções top-level** + **5 drills profundos** (Settings > WhatsApp, Settings > Custom Fields, Automation Workflow Builder, AI Agents landing, Agent Templates marketplace) + **modal Add Contact**.
- **Plataforma all-in-one agressiva**: CRM + Inbox + Calendar + Pipeline + E-commerce + LMS + Community + Ads Manager + Social Planner + AI Agents + Affiliate Manager + Client Portal + Branded Mobile App + 1306 apps no Marketplace.
- **Concorrência direta** com Pipedrive, HubSpot (em features), Kajabi/Hotmart (em LMS), Shopify Light (em e-commerce), ClickFunnels (em sales funnels), BirdEye (em reputation).

## 🔥 Findings mais críticos dos drills (sessão 2)

### 1. WhatsApp oficial é **paywalled a $11/mês** (per location)
Conta Marcelo mostra "PAY $11 & SUBSCRIBE" em `/settings/whatsapp`. É o **mais barato do mercado** (Wati $49, Botmaker $199, Zenvia R$299, Take Blip R$499+). Explica porque WeSales/GHL expõe publicamente "WhatsApp Api Não Oficial" como alternativa grátis — exatamente o playbook dual que o Jarvis está construindo (Baileys grátis + WABA pago).

### 2. AI-first workflow creation **em BETA** (diferencial competitivo enorme)
`/automation/workflows` traz um prompt input com badge BETA: *"Build workflows for free by chatting with AI"*. Usuário escreve em linguagem natural ("After sending a proposal, wait 24 hours then send SMS follow-up...") → AI gera o workflow. **Voice input mic** no prompt (speech-to-workflow). Pipedrive/HubSpot BR não têm isso. Big bet possível pro Intentus: ser primeiro CRM BR com "crie seu fluxo falando português".

### 3. Agent Templates marketplace com escala massiva
`/ai-agents/agent-templates` tem marketplace separado do App Marketplace. Templates top:
- **Clara** (Service AI Receptionist): **78.2K installs**, Paid
- **Dental Appointment Booking**: **50.3K installs**, Free, by LeadConnector
- **PropMate**: **42.0K installs**

Modelo: third-party vendors monetizam, LeadConnector publica free como loss-leader. Valida "agent as product" como padrão de monetização.

### 4. Custom Fields = 13 tipos + template interpolation universal
Modal "+ Add Field" em `/settings/fields` expõe **13 tipos**: Single Line, Multi Line, Text Box List, Number, Phone, Monetary, Dropdown Single/Multiple, Radio, Checkbox, Date Picker, File Upload, **Signature** (competidor BRy embutido). Todos geram unique key `{{ contact.x }}` — mustache/Handlebars interpolation nativa.

### 5. Gestleads como operador whitelabel
Contato de suporte `growth@gestleads.com` vazio no fluxo de 2FA do Phone System → confirma **Gestleads é a agência BR que opera este whitelabel WeSales**. Relevante pra mapear competição local.

## Estrutura deste benchmark

```
docs/research/crm-wesales-benchmark/
├── README.md                       ← este arquivo
├── sitemap.md                      ← mapa top-level + URLs
├── features-matrix.md              ← comparação matrix vs Pipedrive/HubSpot/Intentus
├── gaps-intentus.md                ← o que Intentus/Jarvis deveria adotar
├── sections/
│   ├── 01-launchpad.md
│   ├── 01-dashboard.md
│   ├── 03-conversations.md
│   ├── 04-calendars.md
│   ├── 05-contacts.md
│   ├── 06-opportunities.md
│   ├── 07-payments.md
│   ├── 08-ai-agents.md                ← landing
│   ├── 08-ai-agents-drill.md          ⭐⭐⭐ sessão 2 — Agent Templates marketplace (78K+ installs)
│   ├── 09-marketing.md
│   ├── 10-automation.md               ← high-level
│   ├── 10-automation-drill.md         ⭐⭐⭐ sessão 2 — AI-first workflow BETA + voice input
│   ├── 11-sites.md
│   ├── 12-memberships.md              ⭐ prioridade pra FIC/Klésis
│   ├── 13-media-storage.md
│   ├── 14-reputation.md
│   ├── 15-reporting.md
│   ├── 16-app-marketplace.md
│   ├── 17-settings.md                 ← high-level
│   ├── 17-settings-whatsapp.md        ⭐ sessão 2 — paywall $11/mo
│   ├── 17-settings-custom-fields.md   ⭐ sessão 2 — 13 tipos + interpolation
│   └── modal-add-contact.md
├── tokens/
│   └── design-tokens-summary.md    ← 765 vars + paleta curada
├── screenshots/                    ← vazio (Chrome MCP não persiste imgs)
└── html/                           ← vazio (HTML SPA muito grande pro pipeline)
```

## Metodologia

### Pipeline
1. `aidesigner MCP` considerado → **descartado** (Puppeteer server-side, sem sessão logada)
2. `Chrome MCP` → operado no Chrome local com sessão Marcelo ativa
3. Para cada seção: navigate + wait 5-7s + screenshot + JS extract (subnav, CTAs, labels, features)
4. Escrita de 1 `.md` estruturado por seção + comparação competitiva
5. Consolidação em README + features-matrix + gaps-intentus

### Limitações encontradas
- **Screenshots não persistem em disco** (Chrome MCP mantém in-memory; análise feita inline)
- **outerHTML gigante** (2.9MB no dashboard) → não fomos full-HTML dump; ficamos em extração estrutural via JS
- **CSS vars completas** (765) → response limit ~1.5KB por JS call forçou abordagem curada em vez de dump total
- **Browser download blocked** (tab não-focada bloqueia `a.download` e `clipboard.writeText`)
- **GIF recording skipado** (budget de tool calls consumido pela largura de cobertura)

### Alternativas descartadas
- html2canvas injection → complexo + CORS issues
- Console log chunks → Chrome MCP captura só logs do page context, não do tool-injected JS
- Download via blob.click → blocked (doc não focado)

## Resumo do que foi descoberto

### 🎯 Categorias de feature (17 seções)

| # | Seção | Destaque |
|---|-------|----------|
| 02 | **Dashboard** | Multi-dashboard + filtro pipeline global + phone dialer inline |
| 03 | **Conversations** | Unified inbox multi-canal + Team/My inbox + right-rail com 9 contextos |
| 04 | **Calendars** | Calendar view + Appointment list + booking pages (GHL pattern) |
| 05 | **Contacts** | Smart Lists + Bulk Actions (10+) + Companies + Tasks + Custom Fields |
| 06 | **Opportunities** | Multi-pipeline + List/Kanban toggle |
| 07 | **Payments** | **E-commerce completo**: Invoices + Products + Orders + Subscriptions + Gift Cards + Coupons + Abandoned checkouts |
| 08 | **AI Agents** ⭐ | Voice AI + Conversation AI + Agent Studio + Knowledge Base + Content AI + Agent Logs |
| 09 | **Marketing** | Social planner (10 redes) + Email + Affiliate Manager + Ad Manager |
| 10 | **Automation** ⭐ | Workflow builder visual (GHL canonical) + Global settings |
| 11 | **Sites** | Funnels + Websites + Stores + Webinars + Client Portal + **Branded Mobile App** |
| 12 | **Memberships** ⭐ | LMS + Community + Certificates + Branded app + Gokollab marketplace |
| 13 | **Media Storage** | Canva + Drive + stock images |
| 14 | **Reputation** | Review requests + Video testimonials + Widgets + Listings |
| 15 | **Reporting** | Custom reports + Google/Facebook Ads + Attribution + Call/Agent/Appointment |
| 16 | **App Marketplace** | **1306 apps** + AI Agents category + niche filtering |
| 17 | **Settings** ⭐ | Custom Objects + Lead Scoring + Custom Values + Private Integrations + Audit Logs + Brand Boards |
| 01 | Launchpad | Onboarding checklist (hidden após setup) |

### 🎨 Design system
- 765 CSS variables na raiz (maduro enterprise)
- Prefixos `--hlpt-*` (HighLevel Platform Tokens) confirmam lineage GHL
- Paleta: azul-primary, verde-success, âmbar-warning, vermelho-danger (escala 50-900 por cor)
- 11 famílias de fonte incluindo Font Awesome 6 Sharp
- 15 radii distintos, 12 box-shadows, 3 gradients
- Componente de botão: radius 5px (conservador)

### 🌎 Internacionalização
- Interface base: **inglês**
- Customizações PT-BR da WeSales: "Suporte", "Central de Aceleração We Sales", "WhatsApp Api Não Oficial"
- Localização BR: moeda R$, flag 🇧🇷 default em phone picker, timezone São Paulo

### 🧩 Pontos arquiteturais relevantes
1. **Multi-tenant por location** — cada cliente da WeSales é um `location/XXXX`
2. **Custom Objects** (não só Contact/Company/Deal) — suporta verticalização
3. **Private Integrations** (API keys próprias + webhooks out) — plataforma-friendly pra dev
4. **Custom Values globais** — variáveis reutilizáveis em templates
5. **Lead Scoring nativo** — settings/scoring
6. **Labs (beta flags)** — feature toggles usuário-facing
7. **Brand Boards multi-brand** — mesma conta com N marcas
8. **Gokollab Marketplace** — marketplace de cursos/conteúdo dentro do LMS

## Como consumir este benchmark

### Para revisão rápida
1. Leia `README.md` + `sitemap.md` (~10 min)
2. Leia `features-matrix.md` pra decisão comparativa
3. Leia `gaps-intentus.md` pra priorização de roadmap

### Para drill profundo
1. Leia cada `sections/<seção>.md` conforme interesse
2. Priorize: **08-ai-agents**, **10-automation**, **12-memberships**, **17-settings**
3. Para revisar UX: **modal-add-contact.md**

### Para comparação visual (futuro)
- Precisa gerar screenshots persistentes (html2canvas ou puppeteer com cookies)
- Path: converter essa conta logada em CDP session pra full-page screenshots

## Cross-references no ecosystem

- **`project_crm_benchmark.md`** (memory) — benchmark Pipedrive/cursos funil, complementar
- **`project_nexvy_whitelabel_research.md`** (memory) — pipeline similar (Nexvy/DKW) com 58 vídeos + 1726 frames
- **`project_atnd_s8a.md`** (memory) — Atendimento Automações/Webhooks no Intentus (paralelo)
- **`project_whatsapp_stack.md`** (memory) — stack Jarvis WhatsApp — WeSales confirma demanda BR por "não-oficial"
- **`project_modulo_assinaturas_erp_educacional.md`** (memory) — assinaturas/contratos (Payments > Documents & Contracts)
- **`project_diploma_digital_fase0.md`** (memory) — Certificates competidor WeSales (Memberships)

## Próximos passos recomendados

1. **Drill profundo Settings > WhatsApp** — capturar UI de setup de WABA + não-oficial (sessão separada, 30 min)
2. **Drill Automation > Workflow Builder** — criar um workflow teste pra capturar triggers + actions disponíveis (1-2h)
3. **Drill AI Agents > Agent Studio** — construtor visual (referência canônica pro Jarvis)
4. **Popular conta com dados teste** — criar 3 contatos + 1 pipeline + 1 workflow, gravar GIFs de criação (30 min)
5. **Benchmark mobile** — capturar responsive em 375px (flag no follow-up)
6. **Vídeos públicos WeSales/GHL** — complementar com youtube-learn pipeline (tipo Nexvy): procurar "WeSales tutorial", "GoHighLevel walkthrough"
