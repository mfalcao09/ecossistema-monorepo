# 08.x — AI Agents sub-pages (drill completo sessão 3)

## 08.x.1 — Agent Studio ✅ (`/ai-agents/agent-studio`)

### Headline
**"Agent Studio"** / "Create and manage AI Agents for your Business"

### Important banner
> Welcome to the new Agent Builder experience! You can now create **multiple agents for the same location, folder in the agent builder canvas & manage different versions of your agents.**

Implicações arquiteturais:
- **Multi-agent por location** (tenant pode ter N agents)
- **Folders** pra organizar agents
- **Canvas builder** (visual flow, não só prompt text)
- **Version management** — promover/rollback de versões do agent

### Layout da lista
- CTAs: `New Folder` / `+ Create Agent` (dropdown)
- Sort + Search
- Colunas: **Name, Status, Last Updated, Created On**, Actions
- Paginação: Rows per page 10
- Empty state: "No agents in this folder yet / Get started by creating a new agent in this folder."

### Dropdown "+ Create Agent" (opções)
1. **Create from scratch** — builder vazio
2. **Browse templates** — marketplace (cross-ref `/ai-agents/agent-templates`)

### Modal "Create Agent" (step 1)
Campos:
- **Name*** (default: "New Untitled Agent")
- **Description** (default: "A custom agent built from scratch")
- Botões: Back / Create Agent

Simplicidade inicial — após salvar, leva pro **canvas builder** com provavelmente: trigger config, knowledge bases linkadas, prompt template, tools (ações que o agent pode executar), voice config (pra Voice AI), handoff rules.

---

## 08.x.2 — Voice AI ❌ BLOQUEADO (`/ai-agents/voice-ai`)

Spinner infinito em duas sessões diferentes. Provável feature-gate (subscription ativa ou phone number conectado). Requer ação do Marcelo pra drill.

---

## 08.x.3 — Conversation AI ❌ BLOQUEADO (`/ai-agents/conversation-ai`)

Mesma condição — spinner infinito. Feature-gate.

---

## 08.x.4 — Knowledge Base ✅ (`/ai-agents/knowledge-base`)

### Headline
**"Knowledge Base"** / "Create And Manage **Multiple Knowledge Bases** For Your Business"

Link: "Checkout this quick guide" → docs externos

### Layout
- CTA: `+ Create a Knowledge Base`
- Sort + Search
- Colunas: **Name, Last updated, Created at**, (icon)
- Empty: "No knowledge base found / Add your first knowledge base now to start adding to bot"

### Arquitetura inferida
- **N KBs por location** (não é 1-para-1 com agent — mesma KB pode servir vários agents)
- **Multi-source ingestion provável**: URL crawler, PDF upload, FAQ manual, Notion/Google Drive sync
- **RAG backend gerenciado** pelo GHL/LeadConnector (usuário não mexe em embeddings/chunking)

Cross-ref com **ecosystem_memory** do Marcelo: pattern similar (multi-KB RAG).

---

## 08.x.5 — Agent Templates ✅ (drill já feito em sessão 2 — ver `08-ai-agents-drill.md`)

Marketplace com Clara (78.2K installs), Dental (50.3K Free), PropMate (42K), etc. **Filtros por Categories / Use Cases / Business Niche / Pricing / Actions / Agent Contains / Who can install**.

---

## 08.x.6 — Content AI ✅ (`/ai-agents/content-ai`)

### Headline
**"Content AI"** / "Manage your AI generated content"

### Upsell revelador
> ✨ **Upgrade to unlimited AI Employee plan** →

**AI Employee plan** = nome do tier premium. Metered pricing por palavra implícito.

### Tabs de modalidade
- **Text** (active)
- **Image** (image generation embutida!)

### Dashboard cards (Text mode)
| Métrica | Valor default |
|---------|:---:|
| Total words generated | 0 |
| **Cost** | 0 |
| Words/day | 0 |

### Filter tabs por tipo de conteúdo (7 tipos)
- All (default)
- **Social Planner** (posts de redes sociais)
- **Blog** (artigos longos)
- **Funnel** (copy de landing page)
- **Website** (copy genérico de site)
- **Email** (marketing e transacional)
- **Conversation** (respostas de chat)

### Colunas do log
Content, Date, **Variation Count** (quantas versões geradas por prompt), Transaction ID, **Total Words Count**, Type, Action

### Arquitetura inferida
- **Metered billing** por palavra gerada (Transaction ID + Total Words Count)
- **Type-specific prompts** — templates internos otimizados por contexto
- **Image generation** paralela ao Text (provável DALL-E / SD / FLUX integração)
- **Variation Count** — gera N alternativas por prompt pra usuário escolher

---

## 08.x.7 — Agent Logs ✅ (`/ai-agents/agent-logs`)

### Headline
**"Agent Logs"** / "View and manage agent activity logs."

### Tabs
- **Sessions** (active) — entries atômicas por execução
- **Metrics** — agregados (volume, sucesso, cost)

### Filtros
- **Timestamp** (sort controls)
- **Timestamp 3 months** (default range)
- `+ Add Filter` (extensível)
- Toggle **Auto-refresh: Off** (pode ligar pra live monitoring)
- **6/7 Columns** (configurável)

### Colunas (7 disponíveis, 6 visíveis default)
**Agent name, Contact name, AI Product, Channel, Timestamp, Status**, Action

### Observações
- `AI Product` = Voice AI / Conversation AI / Content AI (determina qual sistema gerou)
- `Channel` = phone / WhatsApp / email / SMS / web chat / etc
- `Status` = success / failed / partial / escalated (human handoff)
- Filtros ricos permitem auditoria tipo SOC2 (quem respondeu qual contato, quando, com qual resultado)

### Empty state
"No logs yet / Agent logs will appear here when activity occurs."

---

## Summary — arquitetura AI completa (inferida)

```
┌─ AI Agents (módulo) ──────────────────────────────────────┐
│                                                            │
│  ┌─ Agent Studio ─────────────────────────────────────┐   │
│  │  multi-agent / folders / canvas builder / versions │   │
│  │  ├─ Create from scratch                            │   │
│  │  └─ Browse templates → marketplace                 │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ Voice AI ─┐  ┌─ Conversation AI ─┐                   │
│  │ phone agent│  │ chat agent        │  (paywalled)      │
│  └────────────┘  └───────────────────┘                    │
│                                                            │
│  ┌─ Knowledge Base ──┐    ┌─ Content AI ──┐              │
│  │ multi-KB RAG      │    │ Text + Image  │              │
│  └───────────────────┘    │ 7 content types│             │
│                           │ metered billing│              │
│                           └────────────────┘              │
│                                                            │
│  ┌─ Agent Templates (marketplace) ───────────────────┐    │
│  │ third-party + official, paid + free               │    │
│  │ filter by niche, use case, pricing, permissions   │    │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ Agent Logs ──────────────────────────────────────┐   │
│  │ Sessions (atomic) + Metrics (aggregate)           │   │
│  │ filter by agent, contact, product, channel, time   │   │
│  │ configurable columns, auto-refresh, audit-ready    │   │
│  └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

## Branding: "AI Employee"

Cross-ref crítico: GHL/WeSales está posicionando todo o módulo como **"AI Employee"** (tier pago). Não apenas "bot" ou "chatbot" — o framing é de um **funcionário virtual** que atende calls, responde chats, gera conteúdo, aprende com KB.

## Gap final vs Jarvis V1

| Feature | WeSales | Jarvis |
|---------|:---:|:---:|
| Multi-agent por tenant | ✅ | ❌ (1 agent pessoal Marcelo) |
| Canvas builder visual | ✅ | ❌ |
| Version management | ✅ | ❌ |
| Folders organização | ✅ | ❌ |
| Multi-KB RAG | ✅ | ⚠️ (ecosystem_memory linear) |
| Content AI (7 types) | ✅ | ❌ |
| Image generation | ✅ | ❌ |
| Metered billing por palavra/minuto | ✅ | ❌ |
| Agent Logs (sessions + metrics) | ✅ | ⚠️ (ecosystem_memory) |
| Agent marketplace (publish) | ✅ | ❌ |
| "AI Employee" branding | ✅ | ❌ (Jarvis = assistente pessoal) |
