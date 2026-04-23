# Pendências — Sprint S5 Atendimento (Templates WABA + Agendamentos)

> Criado 2026-04-20 · Sessão S089 paralela · PR feature/atnd-s5-templates

---

## 🔴 Bloqueador externo (Marcelo)

- [ ] **WABA template piloto** — criar `fic_boas_vindas_matricula` no Meta Business Manager (categoria UTILITY, body com `{{1}}` nome e `{{2}}` curso) e aguardar 24–48h de aprovação. Sem isso, entrega F (envio ativo) não pode ser validada com número real.

---

## 🟠 Config manual antes de ativar em produção

1. [ ] **Aplicar migrations em Supabase branch → prod** — aplicar na ordem:
   - `20260421_atendimento_s5_templates_expand.sql` (base S5)
   - `20260502_atendimento_etapa1_fk_calendar_deal.sql` (Etapa 1-D)
   - `20260503_atendimento_etapa1_vault_refs.sql` (Etapa 1-D)
   - `20260504_atendimento_etapa2b_ms_graph.sql` (**Etapa 2-B — troca Google por Microsoft Graph**)
   A migration 20260504 renomeia `google_event_id` → `provider_event_id` e dropa a tabela `atendimento_google_tokens` (obsoleta no fluxo app-only MS Graph).

2. [ ] **Env vars Vercel (projeto erp-educacional):**
   - `CRON_SECRET` — segredo para autenticar os cron handlers (`/api/cron/sync-meta-templates`, `/api/cron/dispatch-scheduled-messages`). Gerar com `openssl rand -hex 32`.
   - **Credenciais Microsoft Graph** — uma das duas opções:
     - **(A) via vault SC-29 (preferida):** setar `CREDENTIAL_GATEWAY_URL` + `CREDENTIAL_GATEWAY_TOKEN`. As credenciais `OFFICE365_FIC_{TENANT_ID,CLIENT_ID,CLIENT_SECRET}` já estão cadastradas no vault ECOSYSTEM (ADR-018, app `ecossistema-agentes-fic`).
     - **(B) direto em env vars:** `MS_GRAPH_TENANT_ID` (default FIC = `c157f62b-4c1f-450e-96e5-3110bed2ecb6`) + `MS_GRAPH_CLIENT_ID` + `MS_GRAPH_CLIENT_SECRET`.

3. [ ] **Microsoft Entra (tenant FIC) — SEM AÇÃO se usar app existente:**
   - O app `ecossistema-agentes-fic` já tem `Calendars.ReadWrite` (Application) com admin consent.
   - **P-163:** confirmar que `auth.users.email` do Supabase ERP bate com o UPN do atendente no tenant FIC (e-mail FIC tipo `nome@fic.edu.br`). Se não bater, adicionar coluna `users.ms_upn TEXT` + UI para mapear.
   - Se o secret estiver expirado, renovar no portal Azure e atualizar o vault.

4. [ ] **provider_config do inbox WhatsApp FIC** — garantir que contém `waba_id`, `phone_number_id` e `access_token` (ou `access_token_vault_ref` apontando para o vault — Etapa 1-D).

5. [ ] **Primeiro sync manual** — após config, abrir `/atendimento/templates` e clicar **Sincronizar Meta** para popular a tabela com templates já existentes no WABA Manager.

---

## 🟡 Débitos técnicos herdados da S5

- **DT-S5-01 — ~~Vault ECOSYSTEM para refresh_token Google~~ RESOLVIDO (Etapa 2-B, 2026-04-22):** fluxo Google OAuth removido e substituído por Microsoft Graph app-only. Sem refresh_token per-user — MSAL cacheia token do app em memória. Tabela `atendimento_google_tokens` dropada na migration 20260504. Credenciais do app (`OFFICE365_FIC_*`) no vault SC-29 via `resolveOffice365Credentials`.
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
- [ ] Smoke calendar (**MS Graph, Etapa 2-B**): logar como atendente com e-mail FIC → `POST /api/atendimento/calendar-events` → verificar evento no Outlook/OWA do atendente + `join_url` do Teams gerado quando `create_meet=true`.
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
