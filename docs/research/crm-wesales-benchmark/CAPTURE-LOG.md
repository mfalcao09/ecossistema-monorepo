# Capture Log — o que foi feito em cada sessão

## Sessão 1 (2026-04-21 16:00-17:00 BRT) — Captura ampla

**Target:** 17 seções top-level + metadata geral
**Método:** Chrome MCP com sessão logada do Marcelo

### Entregue
- ✅ Sitemap.md (17 seções top-level)
- ✅ 17 sections/*.md (1 por seção)
- ✅ modal-add-contact.md
- ✅ tokens/design-tokens-summary.md (curado, 765 vars totais)
- ✅ README.md consolidado
- ✅ features-matrix.md (14 categorias × concorrentes)
- ✅ gaps-intentus.md (ICE-scored roadmap)

### Limitações
- Screenshots não persistem em disco (Chrome MCP in-memory only)
- HTML full (2.9MB/página) inviável por teto de response (~1.5KB)
- Full tokens dump (~38KB) bloqueado (doc não focado impede clipboard/download)

---

## Sessão 2 (2026-04-21 18:20-18:50 BRT) — Drill profundo

**Target:** Settings (WhatsApp + Custom Fields + Pipelines) + Automation builder + AI Agents sub-pages
**Método:** Chrome MCP com nova aba (sessão anterior reciclou)

### Entregue

#### `17-settings-whatsapp.md` ⭐
- **Paywall descoberto: $11/mês subscription** pra WhatsApp oficial via LeadConnector
- Marketing copy dos 3 slides do carousel
- Confirmação do vendor LeadConnector (whitelabel GHL)
- Dual-platform value prop (sync com WhatsApp Business App próprio)
- Comparação de pricing: WeSales $11 é o mais barato do mercado (Wati $49, Botmaker $199, Zenvia R$299, Take Blip R$499+)

#### `17-settings-custom-fields.md`
- **13 tipos de custom fields** (Single Line, Multi Line, Text Box List, Number, Phone, Monetary, Dropdown Single/Multiple, Radio, Checkbox, Date Picker, File Upload, Signature)
- **Template interpolation mustache** (`{{ contact.first_name }}`) como chave universal
- 25 default fields no seeding inicial
- Folders para organizar campos
- Live preview no modal de criação
- Signature field nativo (competidor de BRy embutido)

#### `10-automation-drill.md` ⭐⭐⭐
- **🔥 AI-first workflow creation (BETA)** — "Build workflows for free by chatting with AI"
- Natural language prompt: "After sending a proposal, wait 24 hours then send SMS follow-up..."
- **Voice input mic** no prompt (speech-to-workflow)
- Quick-start chips: Lead Nurturing / Form Automation / Email Campaigns
- Templates: Email Drip Sequence, Appointment Confirmation, Fast 5 Lite
- **Big bet pro Intentus:** feature nativa BR de "crie workflow falando português" seria diferencial massivo vs Pipedrive BR

#### `08-ai-agents-drill.md` ⭐⭐⭐
- **Agent Templates marketplace** com escala massiva:
  - Clara (Service AI Receptionist) — **78.2K installs**, Paid
  - Dental Appointment Booking — **50.3K installs**, Free, by LeadConnector
  - PropMate — **42.0K installs**
- Filtros: Categories, Use Cases, Business Niche, Pricing, Actions, Who can install
- **Marketplace separado do App Marketplace** (1306 apps em `/integration` vs agent templates em `/ai-agents/agent-templates`)
- Modelo: third-party vendors monetizam, LeadConnector publica free como loss-leader

### Bloqueios
- **Phone System** — bloqueado por 2FA via email do Marcelo (compliance telephony). Não invadi inbox.
- **Voice AI** — spinner infinito (>15s). Provável feature-gate: precisa subscription ativa ou phone number conectado.
- **Conversation AI** — mesmo problema, spinner persistente.
- **Agent Studio** — não tentado (assumido similar pattern de feature-gate).
- **Pipelines Settings** — vazio (conta sem pipelines configurados).

### Limitações persistentes
- Screenshots continuam não persistindo em disco
- Aba do Chrome MCP reciclou entre sessões (normal)
- Algumas heavy SPAs não renderizam sem setup prévio

---

## Entregáveis totais (ambas sessões)

```
docs/research/crm-wesales-benchmark/
├── README.md
├── CAPTURE-LOG.md                    ← este arquivo
├── features-matrix.md
├── gaps-intentus.md
├── sitemap.md
├── screenshots/
│   ├── README.md                     (instruções de upload manual)
│   ├── ai-agents-drill/
│   ├── automation-drill/
│   ├── desktop/
│   ├── flows/
│   ├── mobile/
│   ├── modals/
│   └── settings-drill/
├── sections/
│   ├── 01-dashboard.md
│   ├── 01-launchpad.md
│   ├── 03-conversations.md
│   ├── 04-calendars.md
│   ├── 05-contacts.md
│   ├── 06-opportunities.md
│   ├── 07-payments.md
│   ├── 08-ai-agents.md                ← landing
│   ├── 08-ai-agents-drill.md          ⭐ sessão 2 — Agent Templates marketplace
│   ├── 09-marketing.md
│   ├── 10-automation.md               ← high-level
│   ├── 10-automation-drill.md         ⭐⭐⭐ sessão 2 — AI-first workflow BETA
│   ├── 11-sites.md
│   ├── 12-memberships.md
│   ├── 13-media-storage.md
│   ├── 14-reputation.md
│   ├── 15-reporting.md
│   ├── 16-app-marketplace.md
│   ├── 17-settings.md                 ← high-level
│   ├── 17-settings-custom-fields.md   ⭐ sessão 2 — 13 tipos
│   ├── 17-settings-whatsapp.md        ⭐ sessão 2 — $11/mo paywall
│   └── modal-add-contact.md
└── tokens/
    └── design-tokens-summary.md
```

**Total: 26 arquivos** (sessão 1 = 23, +3 na sessão 2).

---

## O que ainda falta pra captura completa (sessão 3 sugerida)

### Alto valor
1. **AI Agents completo** — Voice AI + Conversation AI + Agent Studio + Knowledge Base + Content AI + Agent Logs (requer pré-setup)
2. **Automation workflow builder canvas** — abrir blank workflow, drill triggers (50+) + actions (80+)
3. **Settings > My Staff** — permissões, roles, team management
4. **Settings > Pipelines** — criar um pipeline teste pra ver schema de stages

### Médio valor
5. **Payments drill** — criar invoice/product teste
6. **Memberships > Courses** — criar course teste pra ver LMS UI
7. **Sites > Funnel builder** — abrir editor visual
8. **Marketing > Ad Manager** — ver config de campanhas FB/Google

### Baixo valor (skip a menos que haja intenção)
9. Mobile responsive (375px) — visual cosmético
10. Hover states, loading states — já descritos em textos
11. GIF flows — custoso em tool calls, valor marginal

### Precisa ação do Marcelo
- **Screenshots manuais** seguindo `screenshots/README.md`
- **Setup pré-requisitos** se quiser drill AI Agents (phone number + subscription)
- **Ativar subscription WhatsApp** ($11/mo) se quiser drill WhatsApp settings completo

---

## Cross-reference com MEMORY

Updates sugeridos no `MEMORY.md` (não feitos ainda):

1. Reescrever entry `project_crm_benchmark.md` mencionando wesales + pipedrive como duas fontes complementares
2. Criar `project_wesales_benchmark.md` apontando pra `docs/research/crm-wesales-benchmark/`
3. Adicionar finding crítico em `project_whatsapp_stack.md`: WeSales valida stack dual (Baileys não-oficial grátis + WABA oficial paywall)
4. Adicionar em `project_atnd_s8a.md` a nova prioridade: "AI prompt-to-workflow" baseado em WeSales BETA
