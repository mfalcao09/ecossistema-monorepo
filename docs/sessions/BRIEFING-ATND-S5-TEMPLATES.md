# BRIEFING — Atendimento S5 · Templates WABA + Envio Ativo

> **Para copiar e colar no início da sua sessão Claude Code**
> **Worktree:** `../eco-atnd-s5-tpl` · **Branch:** `feature/atnd-s5-templates`
> **Duração estimada:** 4-5 dias úteis · **Dependências:** nenhuma hard (paralela a S4/S6)
> **Prioridade:** P1 · **Bloqueador externo:** 1º template WABA aprovado pela Meta (Marcelo cria em paralelo)

---

## Missão

Habilitar a FIC a **disparar mensagens ativas via WABA** (HSM templates Meta) dentro do ERP, com sincronização bidirecional da biblioteca de templates Meta, grid visual, editor 3-step e resolução do "banner de janela fechada" no chat. Após esta sessão, atendente clica em "enviar template" dentro de um chat em janela expirada e manda uma mensagem aprovada pela Meta.

## Por que é importante

WABA tem regra de **janela de 24h**: se o cliente não interagiu nas últimas 24h, só templates HSM pré-aprovados podem ser enviados. Hoje a FIC não consegue responder alunos fora da janela sem abrir conversa nova. S5 destrava isso + habilita campanhas ativas (base pra S7 Relatórios e S4 vincular deal a template via `campaigns.template_id`).

## Leituras obrigatórias

1. `CLAUDE.md` na raiz
2. `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` — **Parte 4 Sprint S5 inteira** + Parte 2.3 seção F (Templates WABA)
3. `docs/adr/017-nexvy-meta-business-partner.md` — contexto Meta MBP em andamento
4. `docs/runbooks/07-conectar-whatsapp-meta-cloud-api.md` se existir (senão, ignore)
5. **Benchmark visual:**
   - `docs/research/nexvy-whitelabel/Olr6prKExSo/` — Modelo de Mensagem na prática (51 frames)
   - `docs/research/nexvy-whitelabel/1lrBXAnV31I/` — contexto Modelo Mensagem (12 frames)
6. Código produção: `apps/erp-educacional/src/app/api/atendimento/webhook/route.ts` (para ver como Meta credenciais vivem)
7. Migration existente: `infra/supabase/migrations/20260412_atendimento_modulo_init.sql` — tabela `atendimento_whatsapp_templates` já existe com schema base

## Escopo preciso

### Pode mexer
- `apps/erp-educacional/src/app/(erp)/atendimento/templates/**` — nova rota
- `apps/erp-educacional/src/app/(erp)/atendimento/agendamentos/**` — nova rota
- `apps/erp-educacional/src/components/atendimento/templates/**` — novos
- `apps/erp-educacional/src/components/atendimento/agendamentos/**` — novos
- `apps/erp-educacional/src/components/atendimento/inbox/ClosedWindowBanner.tsx` — NOVO
- `apps/erp-educacional/src/components/atendimento/inbox/SelectTemplateModal.tsx` — NOVO
- `apps/erp-educacional/src/app/api/atendimento/templates/**`
- `apps/erp-educacional/src/app/api/atendimento/scheduled-messages/**`
- `apps/erp-educacional/src/app/api/atendimento/webhooks/google-calendar/**`
- `apps/erp-educacional/src/workers/sync-meta-templates.ts` — cron worker
- `apps/erp-educacional/src/workers/dispatch-scheduled-messages.ts` — cron worker
- `infra/supabase/migrations/20260421_atendimento_s5_templates_expand.sql` — SÓ ALTER TABLE + tabelas NOVAS (scheduled_messages, calendar_events)
- `apps/erp-educacional/docs/PENDENCIAS-S5.md`

### NÃO mexer
- `tailwind.config.ts` — congelado
- `apps/erp-educacional/src/app/(erp)/atendimento/conversas/**` — produção S3 (só o `ChatPanel.tsx` recebe 1 edição: import + uso de `<ClosedWindowBanner />` condicional)
- `apps/erp-educacional/src/app/(erp)/atendimento/crm/**` — S4
- `apps/erp-educacional/src/app/(erp)/atendimento/contatos/**` — S6
- Migrations da S4 (pipelines/deals) e da S6 (cargos) — seu SQL é independente

## Entregas obrigatórias

### A. Migration SQL
- [ ] `20260421_atendimento_s5_templates_expand.sql`:
  - `ALTER atendimento_whatsapp_templates ADD COLUMN meta_template_id VARCHAR, has_buttons BOOL, button_type VARCHAR, rejected_reason TEXT, language_code VARCHAR DEFAULT 'pt_BR', last_synced_at TIMESTAMPTZ`
  - `CREATE TABLE scheduled_messages (id, contact_id FK, inbox_id FK, template_id FK NULL, content TEXT, content_type VARCHAR, channel VARCHAR, scheduled_at TIMESTAMPTZ, recurrence_rule JSONB NULL, status VARCHAR DEFAULT 'pending', sent_message_id UUID NULL, error TEXT NULL, created_by UUID, created_at)`
  - `CREATE TABLE calendar_events (id, deal_id FK NULL, contact_id FK NULL, google_event_id VARCHAR UNIQUE, summary, start_at, end_at, meeting_url, created_by, created_at)`
  - Índices: `scheduled_messages(status, scheduled_at)` (worker filtra), `scheduled_messages(contact_id)`, `calendar_events(google_event_id)`
- [ ] Aplica em Supabase branch `atnd-s5` primeiro
- [ ] NÃO ocupa slot de migração do dia (S4 ocupa) — aplica em prod **um dia depois** de S4

### B. Sync Meta Templates
- [ ] `GET /api/atendimento/templates/sync` — chama Meta Graph `GET /{WABA_ID}/message_templates?access_token=...`
- [ ] Upsert em `atendimento_whatsapp_templates` por `meta_template_id`
- [ ] Worker cron a cada 30min: `apps/erp-educacional/src/workers/sync-meta-templates.ts` — via Vercel Queues OU Railway cron
- [ ] Botão "Sincronizar agora" na UI de templates

### C. UI Templates — rota `/atendimento/templates`
- [ ] Grid de cards (4 colunas, responsivo) — cada card:
  - Preview estilo WhatsApp (bubble com {{1}}, {{2}} resolvidos em exemplo)
  - Badge categoria (MARKETING/UTILITY/AUTHENTICATION) com cor
  - Badge status (APPROVED=verde, PENDING=amarelo, REJECTED=vermelho, DRAFT=cinza)
  - Ações: Editar · Duplicar · Deletar
- [ ] Filtros topo: Categoria + Status + Busca por nome
- [ ] Botão "+ Criar template" → modal 3-step:
  - Step 1: nome + categoria + language
  - Step 2: componentes (HEADER / BODY / FOOTER / BUTTONS) — variáveis `{{1}}`, `{{2}}`
  - Step 3: preview final + botão "Enviar para aprovação Meta"
- [ ] Botões exclusivos: Quick Reply OU CTA (não os dois, regra Meta)
- [ ] `TemplatePreview.tsx` reutilizável (mockup WhatsApp bubble)

### D. UI Agendamentos — rota `/atendimento/agendamentos`
- [ ] Calendário Mês / Semana / Dia / Lista (FullCalendar.js ou customizado com dnd-kit + date-fns)
- [ ] Filtros: Responsável · Tipo (mensagem / evento) · Status
- [ ] Modal "Agendar":
  - Tipo: Mensagem única / Mensagem recorrente / Evento Google Calendar
  - Contato (search)
  - Canal (dropdown inboxes)
  - Template (se mensagem) ou Conteúdo livre
  - Horário + fuso `America/Campo_Grande` default (FIC)
  - Recorrência (opcional): diário/semanal/mensal
- [ ] Worker `dispatch-scheduled-messages` (cron a cada 1min): lê `WHERE status='pending' AND scheduled_at <= now()`, dispara, atualiza status

### E. Banner "Janela WABA fechada" no chat
- [ ] `ClosedWindowBanner.tsx` — aparece sobre o input quando `conversation.window_expires_at < now()`
  - Texto: "Janela de 24h expirou — envie um template aprovado"
  - CTA: botão "Escolher template" → abre `SelectTemplateModal`
- [ ] `SelectTemplateModal.tsx` — lista templates APPROVED, click → preenche variáveis → envia
- [ ] Edição cirúrgica em `ChatPanel.tsx`: 1 condicional + 2 imports

### F. Envio ativo via template
- [ ] `POST /api/atendimento/templates/[id]/send` — payload `{ contact_id, variables: [...] }` → chama Meta `POST /{phone_id}/messages` com `type: template`
- [ ] Integra com `atendimento_messages` (status='sending' → 'sent' via webhook delivery)

### G. OAuth Google Calendar (básico)
- [ ] `GET /auth/google/connect` → redirect Google OAuth scopes `calendar.events`
- [ ] `GET /auth/google/callback` → salva refresh_token em `@ecossistema/credentials` (ECOSYSTEM vault)
- [ ] `POST /api/atendimento/calendar-events` → cria evento via Google Calendar API

### H. Testes mínimos
- [ ] Unit: sync-meta-templates converte payload Meta → schema atendimento_whatsapp_templates
- [ ] Integration: scheduled_messages pending é disparado pelo worker
- [ ] E2E: abrir chat com `window_expires_at` no passado → banner aparece → escolher template → envia

### I. PR
- [ ] Branch `feature/atnd-s5-templates` → PR
- [ ] Título: `feat(atendimento): S5 Templates WABA + Agendamentos + Google Calendar`
- [ ] Feature flag: `ATENDIMENTO_TEMPLATES_ENABLED=true`

## Dependência externa (Marcelo faz em paralelo)

- Meta Business Manager → WABA Manager → **criar 1º template**:
  - Nome: `fic_boas_vindas_matricula`
  - Categoria: UTILITY
  - Body: `Olá {{1}}, tudo bem? Sou da FIC, vi seu interesse em {{2}}. Posso ajudar?`
- Aguardar 24-48h de aprovação Meta → depois dessa sessão testar envio real
- Se rejeitado, Meta retorna motivo → ajustar e ressubmeter

## Regras de paralelismo

1. Worktree `../eco-atnd-s5-tpl`, branch `feature/atnd-s5-templates`
2. **Você NÃO tem slot de migração do dia** (S4 tem). Aplica em prod 1 dia depois.
3. Arquivos compartilhados: só `ChatPanel.tsx` com edição mínima (1 linha no render).
4. Memory: `project_atnd_s5.md`. Não mexer em `project_atnd_s4.md` nem `_s6.md`.
5. Ordem de merge: A(S4) → C(S6) → **B(S5 você)**. Rebase na main antes do merge.

## Referências técnicas

- Meta Graph API Templates: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
- Webhook categorias de mensagem Meta: MARKETING/UTILITY/AUTHENTICATION
- FullCalendar React: https://fullcalendar.io/docs/react (ou Tremor Calendar, mais leve)
- Google Calendar API: https://developers.google.com/calendar/api/quickstart/nodejs
- Cron workers Vercel (novo Vercel Queues public beta): https://vercel.com/docs/queues

## Ações do dia 1

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git worktree add ../eco-atnd-s5-tpl feature/atnd-s5-templates
cd ../eco-atnd-s5-tpl
pnpm install
claude --permission-mode bypassPermissions

# Dentro do Claude:
# 1. Ler este briefing + Parte 4 Sprint S5 do plano
# 2. ALTER TABLE em atendimento_whatsapp_templates + CREATE scheduled_messages + calendar_events
# 3. Scaffold das rotas /templates e /agendamentos
# 4. Instalar: @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid date-fns
# 5. Worker sync-meta-templates primeiro (mais crítico)
```

---

*Briefing criado em 2026-04-20 · Sessão S089 paralela · Plano-mestre v1*
