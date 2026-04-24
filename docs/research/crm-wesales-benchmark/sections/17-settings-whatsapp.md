# 17.1 — Settings > WhatsApp ⭐

**URL:** `/settings/whatsapp`

## Paywall descoberto

**WhatsApp oficial (via LeadConnector) é pago à parte:**
- **Preço:** `$11/mês` por location
- **CTA:** "PAY $11 & SUBSCRIBE"
- **Provider:** LeadConnector (não Twilio nem Dialog360)

## Marketing copy (3 slides do carousel)

### Slide 1 — Sync
> **Sync your WhatsApp Business App** to manage chats in real time while leveraging Automations, Bulk Messaging, and Marketing Templates.

### Slide 2 — Automate
> **Automate WhatsApp replies with Conversation AI!** Instantly respond, handle inquiries 24/7, and engage smarter with AI-powered messaging.

### Slide 3 — Transform
> **Transform customer engagement with WhatsApp!** Automate, personalize, and manage all conversations in one place to boost conversions effortlessly.

### Descritor de valor
> Connect your existing WhatsApp Business App to sync chats and contacts in real time. Enjoy **dual-platform management**, continue using your WhatsApp Business App while taking full advantage of **LeadConnector's advanced features**, including **Automations, Bulk Messaging, and WhatsApp Marketing Templates**.

## Findings críticos

### 1. WhatsApp é pago mas a opção "não oficial" é grátis
No sidebar global da conta aparece **"WhatsApp Api Não Oficial"** (capturado antes) como feature ativa, enquanto WhatsApp oficial via LeadConnector está paywalled em $11/mo.

**Interpretação:** WeSales/GHL oferece um path de entrada **grátis** (provavelmente Baileys-style) para fisgar SMBs que não podem pagar, e monetiza o **upgrade para WABA oficial** que tem templates aprovados pela Meta, bulk messaging e compliance.

Isso é **exatamente o playbook que o Jarvis está construindo**:
- Nível 1: Meta Cloud API oficial (pagante, B2B enterprise) ← project_whatsapp_stack
- Nível 2: Baileys (grátis, SMB) ← apps/whatsapp-gateway

### 2. "Dual-platform management" como differentiator
O usuário continua usando o WhatsApp Business App normal no celular, E o WeSales também sincroniza. Não é substituto, é paralelo. Esse é o value prop.

### 3. Conversation AI é bundled
"Automate WhatsApp replies with Conversation AI!" — o AI agent que responde automaticamente já está embutido (cross-ref com seção AI Agents > Conversation AI).

### 4. WhatsApp Marketing Templates
Feature específica destacada — templates aprovados pela Meta WABA pra bulk/promotional sends (versus templates de conversação que são mais flexíveis).

### 5. Vendor = LeadConnector
Confirma mais uma vez que WeSales é whitelabel de GHL. LeadConnector é a entidade Meta Business Partner que vende WABA access.

## Pricing tiers inferidos (speculation)

WeSales/GHL segue tipicamente estrutura:
| Feature | Custo |
|---------|-------|
| Platform base | $97-297/mo location (agência) |
| **WhatsApp oficial LeadConnector** | **$11/mo adicional por location** |
| Twilio phone numbers | ~$1-5/mês por número |
| Twilio SMS | pay-per-use ($0.0075 BR) |
| Mailgun email | pay-per-use |
| AI Agents (Voice/Conversation) | créditos (~$0.03/min voz, $0.02/msg) |

## Implicação pro Jarvis/Intentus

### Decisão de pricing futura
Se Intentus virar produto SaaS standalone vendido ao mercado:
- **Base** — CRM + Pipeline + Inbox: incluso no plano
- **WhatsApp Baileys (não-oficial)** — free tier ou incluso básico
- **WhatsApp WABA oficial** — addon pago (~R$59-99/mês por número)
- **Conversation AI** — créditos/uso
- Este modelo é validado pelo WeSales/GHL

### Tecnicamente
O Jarvis-gateway que está sendo construído (Baileys) pode virar **feature anchor free** enquanto monetiza-se WABA+ + AI Agents.

## Comparação pricing WhatsApp no mercado

| Vendor | Plano mínimo | Provider |
|--------|--------------|----------|
| **WeSales (GHL)** | **$11/mo** | LeadConnector |
| Wati | $49/mo | WABA direct |
| Botmaker | $199/mo | WABA + bot builder |
| Zenvia | R$ 299/mo | WABA BR |
| Take Blip | R$ 499+/mo | WABA BR enterprise |
| Twilio | pay-per-use | WABA direct |
| Meta Cloud API direct | $0 setup | oficial |

WeSales/GHL com $11/mo é **o mais barato do mercado** — isso é subsídio agressivo pra manter clientes no ecossistema.
