# 03 — Conversations (Inbox)

**URL:** `/conversations/conversations/?category=team-inbox&tab=unread`
**Default view:** Team Inbox > Unread

## Layout (3 painéis + rails)

```
┌────────────┬──┬──────────┬─────────────────────┬──┐
│  Sidebar   │L │  Inbox   │  Conversation view  │R │
│  (global)  │R │  list    │  (message thread)   │R │
│            │  │          │                     │  │
└────────────┴──┴──────────┴─────────────────────┴──┘
```
- **LR** = Left Rail (tipo de inbox)
- **RR** = Right Rail (contexto do contato/deal)

## Subnav top (tabs da seção Conversations)

1. **Conversations** (active)
2. **Manual Actions**
3. **Snippets** — atalhos de texto/templates curtos
4. **Trigger Links** — links rastreáveis que disparam workflows
5. **Settings**

## Left Rail — Tipos de inbox (icons-only, expansível)

1. 💬 **Team Inbox** (active) — inbox compartilhada do time
2. 🔍 Search
3. 👤 My Inbox (individual)
4. 👥 Team view (2º ícone de pessoas)
5. ⚗ **WhatsApp API Não Oficial** ⭐ — integração WhatsApp não-oficial (Baileys-style)
6. 👁 **Central de Aceleração We Sales** — help/resource hub brandado

## Inner filter tabs (dentro de Team Inbox)

- **Unread** (active) — conversas não lidas
- **All** — todas
- **Recents** — recentes
- **Starred** — marcadas

Ações no header: filter (funil) + sort

## Main area (conversation view)

- Empty state: **"All Caught Up!"** + CTA **"View All Team Inbox Conversations"** (botão primary azul)
- Sub-título: "You don't have any unread Team Inbox conversations right now."

## Right Rail — Context panel (icons-only)

1. 👤 Contact info
2. 🕐 History / Recent activity
3. 🌳 Workflow (branching)
4. ⚗ Automation
5. ✅ Tasks
6. ✍ Notes
7. 📅 Calendar (appointments)
8. 📄 Documents
9. $ Payments

Empty state: "No conversation selected / Select a conversation from the list to view contact details."

## CTAs e botões detectados

- **Add conversation** — criar nova conversa manualmente
- **Expand Inbox Panel** — toggle painel
- **View all conversations**
- **View Notifications**
- **Open Profile Menu**

## Features observadas

- [x] **Team Inbox + Individual Inbox** separados (shared inbox pattern)
- [x] Filter + Sort no header
- [x] 4 filter tabs (Unread/All/Recents/Starred)
- [x] Select all (bulk actions)
- [x] Right rail com **9 contextos** do contato (contato, workflow, tasks, notes, calendar, payments)
- [x] **WhatsApp API Não Oficial** integrado (critical — diferencia de Pipedrive)
- [x] **Central de Aceleração** brandada (help center)
- [x] **Snippets** — templates/shortcuts
- [x] **Trigger Links** — links rastreáveis com automação
- [x] **Manual Actions** — queue de ações manuais (provável fluxo SDR)
- [x] **Add conversation** manual
- [ ] IA no inbox — não detectado direto aqui, pode estar em AI Agents

## WhatsApp Não Oficial — crítico pro benchmark

WeSales admite/expõe explicitamente que usa **API não oficial** do WhatsApp (provável Baileys/WPPConnect). Isso:
- Valida a escolha do Jarvis stack (Baileys nível 2 + Meta Cloud API oficial)
- Mostra que concorrentes do mercado BR já operam com stack não-oficial
- Implica que WeSales tem risco de bloqueio (Meta não autoriza)
- Indica targeting de SMBs BR que não podem/querem WABA oficial

## Comparação rápida

| Feature | WeSales | Pipedrive | Intentus |
|---------|---------|-----------|----------|
| Unified inbox multi-canal | ✅ | ⚠️ (limitado) | ❌ |
| Team + Individual inbox | ✅ | ✅ | ❌ |
| WhatsApp não-oficial | ✅ | ❌ | ⚠️ (em construção via Baileys) |
| WhatsApp oficial (WABA) | provável | marketplace | ⚠️ (roadmap) |
| Snippets/shortcuts | ✅ | ✅ | ❌ |
| Trigger links | ✅ | ⚠️ | ❌ |
| Manual Actions queue | ✅ | ❌ | ❌ |
| Right rail com 9 contextos | ✅ | ⚠️ | ❌ |
