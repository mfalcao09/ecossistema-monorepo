# 08.1 — AI Agents (drill) ⭐⭐⭐

**Capturado em 2 sessões** (2026-04-21 sessão 1 = landing Getting Started; sessão 2 = Agent Templates + tentativas Voice AI / Conversation AI).

## Subnav completo confirmado

| # | Sub-tab | URL |
|---|---------|-----|
| 1 | Getting Started | `/ai-agents/getting-started` |
| 2 | Agent Studio | `/ai-agents/agent-studio` |
| 3 | Voice AI | `/ai-agents/voice-ai` |
| 4 | Conversation AI | `/ai-agents/conversation-ai` |
| 5 | Knowledge Base | `/ai-agents/knowledge-base` |
| 6 | Agent Templates | `/ai-agents/agent-templates?type=voice-ai` |
| 7 | Content AI | `/ai-agents/content-ai` |
| 8 | Agent Logs | `/ai-agents/agent-logs` |

## Páginas bloqueadas (loading permanente)

**Voice AI** e **Conversation AI** ficaram em spinner infinito (>15s cada, `readyState: complete` mas main content vazia). Hipóteses:
1. Feature-gated atrás de subscription (como WhatsApp $11/mo)
2. Requer setup prévio (connectar Twilio/phone number primeiro)
3. Lazy-load heavy module que exige focus da janela
4. Provisioning assíncrono do agent no backend antes do UI render

Para drill completo dessas duas, Marcelo precisaria:
- Ativar subscription/trial do módulo (se paywalled)
- OU conectar prerrequisitos (phone number + domain SMTP)
- OU tentar novamente com aba em foco ativo no Chrome

## 🎯 Agent Templates — marketplace de agentes IA

**URL:** `/ai-agents/agent-templates?type=voice-ai`

### Estrutura de filtros (sidebar esquerda)
- **AI Agents** (master toggle)
- **Categories** (expansível)
- **Use Cases** (expansível)
- **Business Niche** (expansível — filtro por vertical)
- **Pricing** (Free / Paid / Freemium)
- **Actions** (o que o agent faz)
- **Agent Contains** (features dentro do agent)
- **Who can install the app?** (permission gating)

### Search box
"Search for agents..." — fuzzy search no catalog

### Templates observados (parciais — os primeiros da lista)

| Nome | Installs | Vendor | Descritor | Reviews | Pricing |
|------|---------:|--------|-----------|:-------:|:-------:|
| **Clara** | 78.2K | GenZAutomates | "Smart AI Receptionist for Any Service Business" | 5★ (3) | Paid |
| **Dental Appointment Booking** | 50.3K | LeadConnector | "Healthy Smiles. Simple Scheduling." | — | Free |
| **PropMate** (+3 more variations) | 42.0K | ... (truncado) | ... | ... | ... |

### Observações do marketplace

1. **Escala significativa** — templates top com **78K+ instalações**. Isso é comunidade ativa de devs criando agents.
2. **LeadConnector como vendor oficial** publica templates gratuitos (funil de aquisição — usuário instala free, upgrade pro paid do LC)
3. **Third-party vendors** (GenZAutomates etc) monetizam pelo marketplace — modelo similar a App Store
4. **Rating + reviews público** (5★ com contagem 3) — social proof driven
5. **Filtros por vertical** — Business Niche = targeting segmentação (dental, real estate, service, etc)

## Observações intencionais

### Padrão de marketplace
GHL tem **dois marketplaces distintos**:
- **App Marketplace** (`/integration`) — 1306 integrações (Canva, Drive, Slack, etc)
- **Agent Templates Marketplace** (`/ai-agents/agent-templates`) — templates de AI agent prontos

Separação faz sentido: apps são integrações passivas, agents são comportamento IA empacotado (persona + prompts + tools + KB).

### Modelo de monetização
- Platform (WeSales/GHL) cobra % dos sales de Paid Agents
- Agents Free são loss-leader pra adoção
- Vendor third-party ganha com Paid Agents e/ou custom development

### Implicação pro Jarvis/Intentus

Marcelo pode:
1. **Consumir** templates prontos (ex: "Smart AI Receptionist for Service Business" → adaptar pra FIC/Intentus)
2. **Desenvolver e publicar** agents próprios (ex: "Intentus Imobiliário — AI SDR" → revenue share com GHL)
3. **Construir marketplace interno** no ecossistema (long-term): agents para clientes FIC/Klésis/Intentus terem onde comprar

### Pattern validado
"Agent as product" é **padrão comprovado de monetização** — não é moda:
- 78K installs de Clara = revenue significante pro vendor
- 50K de Dental (grátis) = lead gen pro LeadConnector
- Validação forte de product-market fit

## Cross-ref com AI Agents Landing (Getting Started)

Já documentado em `08-ai-agents.md`:
- Claim: "$200k rescued in no-show revenue"
- Social proof: 14.7M+ Calls handled / 860K+ Booked / 18.7M+ Messages
- 8 sub-surfaces de IA

## Gap Jarvis/Intentus vs AI Agents WeSales (atualizado)

| Feature | WeSales | Jarvis V1 | Gap |
|---------|---------|-----------|-----|
| Voice AI agent | ✅ (feature-gated) | ⚠️ (iOS Shortcuts) | GRANDE |
| Conversation AI | ✅ (feature-gated) | ⚠️ (WhatsApp manual) | GRANDE |
| Agent Studio visual | ✅ | ❌ | ENORME |
| Knowledge Base/RAG | ✅ | ⚠️ (ecosystem_memory) | MÉDIO |
| **Agent Templates marketplace** | ✅ (78K+ installs) | ❌ | STRATEGIC |
| Content AI | ✅ | ❌ | MÉDIO (LLM APIs externos cobrem) |
| Agent Logs/audit | ✅ | ⚠️ (ecosystem_memory) | BAIXO |

## Próximos passos pra drill AI completo (sessão 3)

1. **Pré-requisitos**: conectar phone number (Twilio) + verificar subscription ativa
2. **Voice AI**: capturar config UI (voice persona, scripts, triggers, handoff rules)
3. **Conversation AI**: capturar config (canais suportados, knowledge sources, escalation)
4. **Agent Studio**: drill do builder visual (blocks? flowchart? prompt templates?)
5. **Knowledge Base**: drill de upload + chunking + retrieval UI
6. **Agent Logs**: capturar schema de log (call duration, outcome, tags)

Cada um deveria ter `.md` próprio, idealmente com screenshots manuais conforme instruções em `screenshots/README.md`.
