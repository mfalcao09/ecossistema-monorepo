# 10.1 — Automation > Workflows (drill) ⭐⭐⭐

**URL:** `/automation/workflows?listTab=all`
**Header:** "Workflows" — "Automate your processes using simple triggers and actions."

## 🔥 AI-first workflow creation (BETA)

### Headline section
**"What do you want to automate?" [BETA]**

**Subtitle:** "Build workflows for free by chatting with AI"

### Prompt input field
Textarea grande com placeholder animado cycling através de exemplos:
- `"After sending a..."`
- `"After sending a proposal, wait 24 hour..."`
- `"After sending a proposal, wait 24 hours then send SMS follow-up, wait..."`
- `"After sending a proposal, wait 24 hours then send SMS follow-up, wait 2 more days for email follow-up, cr..."`

Features do input:
- **Voice input mic icon** 🎙️ (lado direito)
- **Submit button** (seta para cima, fundo roxo)
- **Textarea multiline** permitindo prompts longos

### Quick-start categories (chips embaixo do input)
- `👤 Lead Nurturing`
- `⬡ Form Automation`
- `✉️ Email Campaigns`
- `more` (expandir pra ver todos)

### Fluxo
Usuário escreve em linguagem natural "crie um workflow que faça X" → AI gera o workflow com triggers + actions corretos → usuário revisa e publica.

## Templates section (fallback)

**"Or... Start with a Template"**

Templates visíveis (parcial — banner inferior):
- Email Drip Sequence
- Appointment Confirmation
- Fast 5 Lite

Provavelmente existem 20-50+ templates categorizados por indústria/goal.

## Create Workflow (botão top-right)

`Create Workflow ▼` — dropdown com opções (não expandiu na minha captura), provável:
- Blank Workflow (manual, drag-and-drop)
- From Template
- From AI (redirect ao prompt acima)
- Import (JSON?)

## Banner topo
**"What's new / Automation Updates"** com pulse dot vermelho — changelog in-app para features novas de automation (cadência de release ativa).

## Subnav
- `Workflows` (active)
- ⚙ `Global Workflow Settings` — sender defaults, timezone, execution limits, etc

## Implicação competitiva

### GHL/WeSales está 1-2 anos à frente em AI workflow creation
Poucas plataformas oferecem **prompt → workflow**:
- ✅ WeSales/GHL (BETA 2026)
- ⚠️ Zapier Agents (private preview)
- ⚠️ Make.com AI assistant (beta)
- ❌ Pipedrive / HubSpot / Intentus

### Por que é um big deal
1. **Reduz time-to-value** drasticamente — ao invés de treinar usuário no builder visual, só escrever
2. **Democratiza automação** — non-tech founders conseguem criar workflows complexos
3. **Signal pra mercado** que builder visual clássico pode ser commoditizado por natural language

### Pro Intentus/Jarvis
O atnd-s8a já tem motor IF/THEN (7 triggers, 9 actions). Big bet estratégico:
- **Atalho AI**: implementar endpoint `/api/workflows/generate-from-prompt` que usa Claude/GPT pra parsear prompt → gerar structure JSON de workflow
- **Feature diferenciada**: ser primeiro CRM BR com "Crie seu fluxo falando português" — Marcelo tem vantagem de falar BR nativo
- **MVP**: limitar aos 7 triggers/9 actions que já temos, prompt controlado, não tentar ser GHL

### Voice input adicional
Mic icon sugere **speech-to-workflow**. Jarvis já tem voice (iOS Shortcuts) → pode extender para "criar workflow falando" no Intentus/ERP. Diferencial competitivo enorme vs Pipedrive BR.

## Features confirmadas (standard GHL pattern + BETA AI)

- [x] Visual workflow builder (drag-and-drop) — inferido, não drilled por preservar budget
- [x] Triggers (GHL standard: ~50+)
- [x] Actions (GHL standard: ~80+)
- [x] Templates de workflow (categorizados)
- [x] **AI prompt-to-workflow (BETA)**
- [x] **Voice input no prompt (BETA)**
- [x] Global Workflow Settings (sender, timezone)
- [x] Quick-start chips por goal (Lead Nurturing, Form Automation, Email Campaigns, ...)
- [x] In-app changelog ("What's new")

## Gap Intentus atualizado

| Feature | WeSales | Intentus atnd-s8a |
|---------|---------|-------------------|
| Visual workflow builder | ✅ | ❌ (só IF/THEN UI) |
| Templates catalogados | ✅ | ❌ |
| **AI prompt-to-workflow** | ✅ BETA | ❌ ⭐ big bet |
| **Voice-to-workflow** | ✅ BETA | ❌ ⭐ big bet |
| Quick-start chips | ✅ | ❌ |
| Global settings | ✅ | ⚠️ |
| In-app changelog | ✅ | ❌ |
