# 03.x — Conversations sub-pages

## 03.1 — Manual Actions (`/conversations/manual_actions`)

**Descrição oficial:** "Manual Actions are tasks that require you to manually place calls or send SMS m..."

### URL com filtros
`?type=workflow&workflow=&campaign=&assignee=`

### Filtros disponíveis
- **type** (workflow ou campaign)
- **workflow** (ID específico)
- **campaign** (ID específico)
- **assignee** (user ID — filtrar por responsável)

### Estado visual
CTA: `Let's Start` (onboarding — conta sem manual actions ainda)

### Interpretação
Essencialmente uma **fila de tarefas SDR**: quando um workflow ou campaign tem uma action "Manual Call" ou "Manual SMS", cria-se um item nessa fila para o SDR/rep executar. Similar ao "Cadence Tasks" do Outreach/Salesloft.

---

## 03.2 — Snippets (`/conversations/templates`)

**Descrição:** "Create snippets to quickly insert predefined content into messages for faster, consistent communication."

### CTAs
- `New Folder` — organização
- `New Snippet` — criar novo

### Tabs
- All Snippets
- Folders

### Tabela
Colunas: **Name, Body, Folder, Type, Date Updated**
Paginação: 20 rows/page

### Interpretação
Snippets são **micro-templates de texto** (tipo "/saudacao", "/assinatura") injetáveis em qualquer canal. Folders pra organizar por time/campanha. **Type** sugere snippets podem ser SMS/Email/WhatsApp/Voice-script específicos.

---

## 03.3 — Trigger Links (`/conversations/trigger-links`)

**Descrição oficial:**
> Trigger links allow you to put links inside SMS messages and emails, which allow you to track specific customer actions and trigger events based on when the link is clicked.

### CTAs
- `Add Link` — criar link rastreável
- `Analyze` — view de analytics

### Tabela
Colunas: **Name, Link URL, Link Key, Date Added**

### Interpretação
**Short-links rastreáveis** que disparam workflows ao serem clicados. Padrão:
1. Criar "Promo Black Friday" link → gera short URL + Link Key
2. Incluir em email/SMS: "confira aqui: {link_key}"
3. Quando clicado → dispara workflow (ex: "lead clicou promo BF, mover pra stage Quente + notificar SDR")

Similar ao **Branch.io** ou **Rebrandly** embutido no CRM.

---

## 03.4 — Settings (`/conversations/settings`)

### SLA Settings ⭐
**Descrição:**
> Define how quickly your team should respond to customer messages.
>
> SLAs help you define response time targets so your team never leaves a contact waiting.

### Estado
"No SLA are set" — CTA `Set SLA`

### Interpretação
Permite definir SLAs como:
- Primeira resposta em Team Inbox: ≤5min
- Tempo de resolução de ticket: ≤24h
- Por canal (WhatsApp mais rápido que Email)
- Por prioridade

Dispara alertas/escalation quando SLA quebra. **Feature enterprise** — diferencia de CRMs SMB.

### Gap Intentus
Intentus atnd-s7 (Dashboards) não tem SLA tracking. Gap médio-alto pra adicionar.
