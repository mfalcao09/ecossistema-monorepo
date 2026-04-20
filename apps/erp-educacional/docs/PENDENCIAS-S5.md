# Pendências — Sprint S5 Atendimento (Templates WABA + Agendamentos)

> Criado 2026-04-20 · Sessão S089 paralela · PR feature/atnd-s5-templates

---

## 🔴 Bloqueador externo (Marcelo)

- [ ] **WABA template piloto** — criar `fic_boas_vindas_matricula` no Meta Business Manager (categoria UTILITY, body com `{{1}}` nome e `{{2}}` curso) e aguardar 24–48h de aprovação. Sem isso, entrega F (envio ativo) não pode ser validada com número real.

---

## 🟠 Config manual antes de ativar em produção

1. [ ] **Aplicar migration em Supabase branch `atnd-s5` → prod** — aplicar `20260421_atendimento_s5_templates_expand.sql` em prod **1 dia depois** de S4 (slot de migração do dia é da S4). Valida `window_expires_at`, `atendimento_scheduled_messages`, `atendimento_calendar_events`, `atendimento_google_tokens` e os triggers.

2. [ ] **Env vars Vercel (projeto erp-educacional):**
   - `CRON_SECRET` — segredo para autenticar os cron handlers (`/api/cron/sync-meta-templates`, `/api/cron/dispatch-scheduled-messages`). Gerar com `openssl rand -hex 32`.
   - `GOOGLE_CLIENT_ID` — OAuth client do Google Cloud Project.
   - `GOOGLE_CLIENT_SECRET` — idem.
   - `GOOGLE_OAUTH_REDIRECT_URI` — `https://<domínio>/api/auth/google/callback` (adicionar também a URL de preview e local dev).

3. [ ] **Google Cloud Console:**
   - Criar projeto "FIC Atendimento" (ou reusar existente).
   - Habilitar **Google Calendar API** e **People API**.
   - OAuth consent screen: External, escopo `.../auth/calendar.events` + `userinfo.email`.
   - Criar OAuth Client ID (Web application) com redirect URIs: produção + `http://localhost:3000/api/auth/google/callback`.

4. [ ] **provider_config do inbox WhatsApp FIC** — garantir que contém `waba_id`, `phone_number_id` e `access_token`. Sem `waba_id`, sync de templates falha.

5. [ ] **Primeiro sync manual** — após config, abrir `/atendimento/templates` e clicar **Sincronizar Meta** para popular a tabela com templates já existentes no WABA Manager.

---

## 🟡 Débitos técnicos herdados da S5

- **DT-S5-01 — Vault ECOSYSTEM para refresh_token Google.** Hoje armazenado em `atendimento_google_tokens` em texto. Migrar para `@ecossistema/credentials` (SC-29) quando o gateway suportar escrita (Modo A). Dono: orquestrador.
- **DT-S5-02 — Criptografar `access_token` WABA do inbox.** `provider_config->>'access_token'` está em texto. Migrar para vault com a mesma convenção.
- **DT-S5-03 — Webhook Meta para status de template.** Hoje sync é pull (cron 30min). Quando a Meta enviar `message_template_status_update` no webhook, processar incrementalmente em `webhook/route.ts`.
- **DT-S5-04 — FK `atendimento_calendar_events.deal_id`** — migration deixou como UUID solto aguardando S4 criar `atendimento_deals`. Adicionar `REFERENCES public.atendimento_deals(id) ON DELETE SET NULL` após o merge da S4.
- **DT-S5-05 — FullCalendar.** A view de agendamentos usa grid custom (mês + lista). Se surgir demanda de DnD / Semana / Dia granular, considerar FullCalendar. Hoje cobre 80% dos casos FIC sem 500kB de bundle.
- **DT-S5-06 — Retry com backoff exponencial no worker dispatch.** Hoje recontamos `attempts` até MAX_ATTEMPTS=5 mas sem backoff. Pode virar `scheduled_at = now() + 2^attempts min` em reattempt.
- **DT-S5-07 — Webhook Meta status updates atualiza `atendimento_scheduled_messages.sent_message_id` → `atendimento_messages.status`** está OK, mas falta propagar `failed` do Meta (ex: 24h expirou, número inválido) para `scheduled_messages.status='failed'` retroativamente.
- **DT-S5-08 — Cancelar série inteira de recorrente.** `DELETE /api/atendimento/scheduled-messages/[id]` cancela só a instância; novas geradas por `recurrence_rule` continuam. Adicionar `?series=true` para cancelar todas as futuras com mesmo contact+template.

---

## 🟢 Testes a rodar / validar

- [ ] `pnpm install` no worktree → `pnpm --filter diploma-digital test` — 3 arquivos unit (`tests/atendimento/meta-templates.test.ts`, `scheduled-recurrence.test.ts`, `date-utils.test.ts`).
- [ ] E2E manual após piloto: `fic_boas_vindas_matricula` APPROVED + número real de aluno + abrir chat com `window_expires_at` forçado no passado → banner aparece → selecionar template → enviar → mensagem chega no WhatsApp real.
- [ ] Smoke scheduled: criar agendamento para `now() + 2min` → aguardar cron → mensagem aparece no chat.
- [ ] Smoke calendar: conectar Google → criar evento → verificar no Google Calendar real + hangoutLink gerado.
- [ ] **Integration/E2E testes automatizados** — ainda não instrumentados no app. Reutilizar setup de `tests/e2e-fase0/` em uma sessão futura.

---

## 📋 Não escopo S5 (para sprints seguintes)

- Kanban de agendamentos vinculando a `deals` (S4).
- UI bulk-schedule (disparar para lista de contatos filtrada) → S7 campanhas.
- Webhook de entrada Meta para atualização incremental de status de template (DT-S5-03).
- Apagar template no Meta (DELETE Graph API) — hoje só marca `DISABLED` local.

---

## ✅ Resolvidas nesta sessão

- Todas as 9 entregas obrigatórias A–I do briefing `BRIEFING-ATND-S5-TEMPLATES.md`.
