# Checklist Operacional — Pós-Leva 1 Atendimento FIC

> Criado 2026-04-21 · Sessão S089
> Ordem sugerida de execução para destravar S4/S5/S6 em produção, sem bloquear a leva 2.

**Status das entregas (após PR #52):**
- ✅ PR #44 S4 Kanban CRM em `main` (`e7328d6`)
- ✅ PR #45 S6 Cargos em `main` (`f783907`)
- ✅ PR #46 S5 Templates em `main` (`1a2a02e`)
- ✅ PR #52 Fix Next 15 bugs em `main` (`543d20d`) — destrava build Vercel
- ❌ PR #49 fechado (superseded por #52)

---

## 🔴 Bloqueadores externos (Marcelo, fora do código)

Estas pendências não são resolvidas por nenhuma sessão Claude — dependem de ação do Marcelo fora do repo. Podem ser executadas em paralelo com as técnicas.

### 1. WABA template piloto na Meta (~10min + 24-48h aprovação) — **P-040/P-065**
- [ ] Abrir Meta Business Manager → WhatsApp Manager → Templates → Novo
- [ ] Nome: `fic_boas_vindas_matricula`
- [ ] Categoria: **UTILITY**
- [ ] Idioma: Portuguese (BR)
- [ ] Body: `Olá {{1}}, tudo bem? Sou da FIC, vi seu interesse em {{2}}. Posso te ajudar com informações sobre a matrícula?`
- [ ] Submeter para aprovação
- [ ] Aguardar e-mail de aprovação (24-48h)

### 2. Google Cloud Console (~20min) — **P-062**
- [ ] Criar projeto **FIC Atendimento** (ou reusar existente)
- [ ] Habilitar **Google Calendar API** e **People API**
- [ ] OAuth consent screen → External → adicionar escopos `.../auth/calendar.events` + `userinfo.email`
- [ ] Credentials → Create OAuth Client ID → Web application:
  - Authorized redirect URIs:
    - `https://gestao.ficcassilandia.com.br/api/auth/google/callback` (prod)
    - `https://erp-educacional-*.vercel.app/api/auth/google/callback` (preview)
    - `http://localhost:3000/api/auth/google/callback` (dev)
- [ ] Anotar `Client ID` e `Client Secret` para P-061

### 3. Exportar dados do Nexvy (~10min) — **P-034/P-042**
- [ ] Acessar `console.nexvy.tech` → Configurações → API → gerar `api-key` (se ainda não tem)
- [ ] Exportar CSV de Contatos (245 linhas)
- [ ] Exportar CSV de Negócios (171 linhas)
- [ ] Salvar em `~/Downloads/nexvy-contatos-YYYY-MM-DD.csv` e `nexvy-deals-YYYY-MM-DD.csv`

### 4. Credenciais Inter sandbox (pendente renovação até 20/05) — **P-015**
- [ ] Portal Inter → integração "TESTE BOLETO API FIC 3"
- [ ] Baixar novo cert + key
- [ ] Atualizar vault: `inter-sandbox-cert-fic3`, `inter-sandbox-key-fic3`

---

## 🟠 Deploy em Supabase (serializado — 3 migrations distintas)

**Regra:** aplicar em branch Supabase primeiro, validar, depois prod. **Um slot por dia** (ADR-016 Regra 5).

### Dia 1 — S4 Kanban CRM — **P-028**
```bash
cd apps/erp-educacional
supabase db push --include-all --file supabase/migrations/20260421000000_atendimento_s4_kanban.sql
# OU via MCP: apply_migration com o conteúdo do arquivo
```
- [ ] Aplicar em branch `atnd-s4`
- [ ] Validar: `SELECT count(*) FROM pipelines; SELECT count(*) FROM pipeline_stages;` (esperado: 2 pipelines, 11 stages)
- [ ] Validar trigger: INSERT em `deals` com `stage_id` → gera linha em `deal_history_events`
- [ ] Merge branch → prod
- [ ] `pnpm supabase gen types typescript --project-id gqckbunsfjgerbuiyzvn > apps/erp-educacional/src/types/supabase.atendimento.ts` — **P-030**

### Dia 2 — S6 Cargos + Permissões — **P-050/P-051**
```bash
supabase db push --include-all --file apps/erp-educacional/supabase/migrations/20260421_atendimento_s6_cargos.sql
python apps/erp-educacional/scripts/seed_atendimento_permissions.py | psql "$SUPABASE_DB_URL"
```
- [ ] Aplicar em branch `atnd-s6`
- [ ] Rodar seed (165 INSERTs idempotentes)
- [ ] Validar: `SELECT role_id, count(*) FROM role_permissions WHERE granted=true GROUP BY role_id;`
  - Esperado: Admin tem todas, Atendente ~40, Atendente restrito ~15
- [ ] Merge branch → prod

### Dia 3 — S5 Templates + Agendamentos — **P-060**
```bash
supabase db push --include-all --file apps/erp-educacional/supabase/migrations/20260421_atendimento_s5_templates_expand.sql
```
- [ ] Aplicar em branch `atnd-s5`
- [ ] Validar: `SELECT column_name FROM information_schema.columns WHERE table_name='atendimento_whatsapp_templates';` (esperar `meta_template_id`, `has_buttons`, etc)
- [ ] Validar: tabelas `atendimento_scheduled_messages` + `atendimento_calendar_events` + `atendimento_google_tokens` existem
- [ ] Merge branch → prod

---

## 🟡 Configuração Vercel

### Env vars novas (projeto `erp-educacional` / `diploma-digital`)

**S4 (1 var):**
- [ ] `NEXT_PUBLIC_ATENDIMENTO_CRM_KANBAN_ENABLED=true` (Preview + Production) — **P-031**

**S5 (4 vars):** — **P-061**
- [ ] `CRON_SECRET` = gerar com `openssl rand -hex 32` (Production only)
- [ ] `GOOGLE_CLIENT_ID` = do Google Cloud Console (P-062)
- [ ] `GOOGLE_CLIENT_SECRET` = idem (encrypted)
- [ ] `GOOGLE_OAUTH_REDIRECT_URI` = `https://gestao.ficcassilandia.com.br/api/auth/google/callback`

**S6 (2 vars):** — **P-052** (ativar **depois** de validar em staging)
- [ ] `ATENDIMENTO_RBAC_ENABLED=true` (server, Preview primeiro → Production)
- [ ] `NEXT_PUBLIC_ATENDIMENTO_RBAC_ENABLED=true` (client, mesma ordem)

### Verificar build do `diploma-digital`

- [ ] Após merge PR #52, ver se a Vercel retriga o deploy e fica verde
- [ ] Se ainda falhar: `npx vercel inspect <dpl-id> --logs`
- [ ] Marcar **P-080** como resolvida quando build estiver verde

---

## 🟢 Dados de inbox (WhatsApp FIC) — **P-063**

Garantir que `atendimento_inboxes` do inbox WABA da FIC tem `provider_config` completo:

```sql
UPDATE atendimento_inboxes
SET provider_config = jsonb_build_object(
  'waba_id', '1833772130511929',
  'phone_number_id', '938274582707248',
  'access_token', '<WHATSAPP_TOKEN>'
)
WHERE name ILIKE '%FIC%' AND channel_type='whatsapp';
```

- [ ] Executar SQL (usar valor real do token do env Vercel)
- [ ] Primeiro sync manual: abrir `/atendimento/templates` → botão "Sincronizar Meta" — **P-064**
- [ ] Conferir: `SELECT count(*) FROM atendimento_whatsapp_templates WHERE status IS NOT NULL;`

---

## 🔵 Validações E2E manuais (pós-configurações)

### S4 Kanban
- [ ] Abrir `/atendimento/crm`
- [ ] Criar deal fake → arrastar entre 2 colunas → refresh → persistiu — **P-032**
- [ ] Verificar `deal_history_events` tem linha com `event_type='stage_transfer'` — **P-033**
- [ ] Rodar `scripts/nexvy_import.ts --dry-run` → revisar → rodar sem dry-run — **P-034**

### S5 Envio ativo (depende de template aprovado Meta)
- [ ] Conversa de teste: `UPDATE atendimento_conversations SET window_expires_at = now() - interval '1h' WHERE id=<id-teste>;`
- [ ] Abrir chat → banner "Janela fechada" aparece → clicar "Escolher template"
- [ ] Selecionar `fic_boas_vindas_matricula` → preencher vars → enviar
- [ ] Validar: mensagem chega no WhatsApp real — **P-065**

### S5 Agendamentos
- [ ] Criar agendamento via UI para `now() + 2min` com template
- [ ] Aguardar cron `/api/cron/dispatch-scheduled-messages` (vercel cron a cada 1min)
- [ ] Validar: mensagem enviada + registro em `atendimento_messages`

### S5 Google Calendar
- [ ] Abrir `/api/auth/google/connect` (logado no ERP)
- [ ] Autorizar Google → redirect volta com token salvo
- [ ] Criar evento via UI → verificar no Google Calendar real
- [ ] Confirmar `hangoutLink` gerado

### S6 RBAC
- [ ] Com `ATENDIMENTO_RBAC_ENABLED=false`: todas as rotas passam — confirmar
- [ ] Com `ATENDIMENTO_RBAC_ENABLED=true`: agente com cargo "Atendente restrito" tenta DELETE em `/api/atendimento/pipelines/[id]` → 403
- [ ] Admin consegue tudo
- [ ] Fluxo de convite: POST `/api/atendimento/invites` → copiar `accept_url` → abrir em aba anônima → aceitar → agent criado — **P-056**

### Design tokens (QA visual)
- [ ] Abrir `/dev/tokens` em staging → conferir paridade com `console.nexvy.tech` — **P-041**

---

## 📋 Ordem de execução recomendada (resumida)

| Quando | O que | Quem |
|---|---|---|
| **Agora** | Submeter template Meta + Google Cloud Console + exportar CSV Nexvy | Marcelo (paralelo) |
| **Hoje** | Aplicar migration S4 + regerar types + env `CRM_KANBAN_ENABLED` | Claude/Marcelo |
| **Hoje+1** | Aplicar migration S6 + seed permissions | Claude/Marcelo |
| **Hoje+2** | Aplicar migration S5 + env vars Vercel (Google + CRON_SECRET) | Claude/Marcelo |
| **24-48h** | Template Meta aprova → validações E2E S5 com WhatsApp real | Marcelo |
| **Pós-ok staging** | Ativar flag `RBAC_ENABLED=true` em prod | Marcelo |
| **Leva 2** | Kickoff S7/S8a/S8b/S9 em paralelo | Claude × 4 sessões |

---

## Referências canônicas

- `docs/sessions/PENDENCIAS.md` — fonte única de pendências (P-NNN)
- `docs/sessions/BRIEFING-ATND-S4-KANBAN.md` / `S5-TEMPLATES` / `S6-CARGOS` — briefings da leva 1
- `docs/sessions/BRIEFING-ATND-S7-DASHBOARDS.md` / `S8A-AUTOMACOES` / `S8B-CHAT-INTERNO` / `S9-DS-VOICE` — briefings leva 2
- `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` — plano-mestre
- `docs/adr/016-protocolo-sessoes-paralelas.md` — regras de paralelismo

*Marcar itens como resolvidos em `PENDENCIAS.md` → Resolvidas conforme forem fechados.*
