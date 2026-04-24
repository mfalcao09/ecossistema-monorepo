# 10 — Automation (Workflows)

**URL:** `/automation/workflows?listTab=all`

## Subnav
- **Workflows** (active) — `/automation/workflows`
- **Global Workflow Settings** — `/automation/workflows/settings`

## Observação
Extração DOM retornou pouco conteúdo — página pode estar atrás de SPA heavy lazy-load ou requer drill pra construtor. Filter tab `?listTab=all` indica que há outros tabs (ativos/pausados/drafts).

## Features inferidas (padrão GHL)

### Workflow Builder (canonical no GHL)
- **Triggers** (50+ tipos padrão):
  - Form Submitted
  - Contact Created / Updated
  - Tag Added / Removed
  - Appointment Booked / Status Changed
  - Opportunity Stage Changed
  - Invoice Paid / Failed
  - Membership Joined
  - Email Event (open, click, bounce)
  - Call Event (missed, completed)
  - Inbound Webhook
  - Trigger Link Clicked
  - Note Added
  - Manual
  - etc

- **Actions** (80+ tipos):
  - Send Email / SMS / WhatsApp / Voicemail
  - Wait (delay ou waitUntil)
  - If/Else condition
  - Create Task / Appointment / Opportunity / Contact
  - Update Contact Field / Tag / Pipeline
  - Add to Workflow / Remove from Workflow
  - HTTP Request (webhook out)
  - Google Sheets / Slack notification
  - AI Generate (content)
  - Math operation
  - Internal Notification
  - etc

### Outros
- [x] Visual flowchart builder (drag-and-drop de nodes)
- [x] Templates de workflow
- [x] Enrollment history (quem entrou quando)
- [x] Execution logs (eventos por execution)
- [x] Global Settings (sender defaults, timezone, etc)
- [x] Folders para organizar workflows

## Prioridade
**Segunda sessão de drill profunda aqui é obrigatória.** Automation é o core do GHL/WeSales — competidor direto do que Intentus precisa construir (ver `project_atnd_s8a` no memory — já tem motor IF/THEN).

## Comparação

| Feature | WeSales | Pipedrive | Intentus atnd-s8a |
|---------|---------|-----------|-------------------|
| Visual workflow builder | ✅ | ⚠️ (Workflow Automation) | ❌ (IF/THEN motor) |
| Triggers (qty) | 50+ | ~20 | 7 |
| Actions (qty) | 80+ | ~30 | 9 |
| HTTP webhook out | ✅ | ✅ | ✅ |
| Enrollment history | ✅ | ❌ | ⚠️ |
| AI Action embutida | ✅ (Content AI) | ❌ | ❌ |
