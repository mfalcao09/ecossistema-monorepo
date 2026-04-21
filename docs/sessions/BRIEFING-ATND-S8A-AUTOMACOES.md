# BRIEFING — Atendimento S8a · Automações + Webhooks + API Pública + n8n

> **Worktree:** `../eco-atnd-s8a` · **Branch:** `feature/atnd-s8a-automacoes`
> **Duração:** 5-6 dias · **Dependências:** S4 mergeado (deals/conversations) + S6 mergeado (permissions)
> **Prioridade:** P0 (destrava FIC plugar o n8n ID 2967 que já opera no Nexvy)

---

## Missão

Implementar o **motor de automações** do módulo Atendimento + **webhooks bidirecionais** + **API REST pública** + **integração n8n**, plugando a automação real da FIC (n8n ID 2967 já ativo) dentro do ERP. Ao final, uma regra "ao receber mensagem com palavra 'matrícula' → criar deal no pipeline Alunos → etapa Interesse → atribuir à fila Matrículas" roda sozinha, sem humano.

## Por que importa

**n8n ID 2967 "N8N – AF EDUCACIONAL"** já opera no Nexvy. Quando essa sessão terminar, o mesmo workflow n8n apontando pro ERP roda em produção via webhook, e o Marcelo pode mover toda a automação do Nexvy para o ERP sem refazer n8n flows. Também destrava API pública (integradores externos) e webhooks de saída (ex: sync Deal → HubSpot se algum dia precisar).

## Leituras obrigatórias

1. `CLAUDE.md` · Plano mestre Parte 4 Sprint S8 + seções G/H (Automações e Webhooks)
2. `docs/research/nexvy-whitelabel/SHTF1dwAtuc/` — etiquetar via chatbot (24 frames)
3. `docs/research/nexvy-whitelabel/-W1Gvw7_QzM/` — Criação de Página no Facebook (contexto integração)
4. Arquivos existentes: `atendimento_automation_rules` (schema base S1) + `atendimento_webhook` (S2 inbound Meta)
5. ADR-016 (paralelismo)
6. **Acesso n8n ID 2967:** Marcelo precisa fornecer URL base + token de autenticação

## Escopo preciso

### Pode mexer
- `apps/erp-educacional/src/app/(erp)/atendimento/automacoes/**` — reforma (skeleton hoje)
- `apps/erp-educacional/src/app/(erp)/atendimento/webhooks/**` — nova
- `apps/erp-educacional/src/app/(erp)/atendimento/api-keys/**` — nova
- `apps/erp-educacional/src/app/(erp)/atendimento/integracoes/**` — nova (página "Apps")
- `apps/erp-educacional/src/components/atendimento/automations/**` — builder visual
- `apps/erp-educacional/src/app/api/atendimento/automation-rules/**`
- `apps/erp-educacional/src/app/api/atendimento/webhooks/**`
- `apps/erp-educacional/src/app/api/atendimento/api-keys/**`
- `apps/erp-educacional/src/app/api/public/v1/**` — API REST pública
- `apps/erp-educacional/src/lib/atendimento/automation-engine.ts` — motor reusável
- `apps/erp-educacional/src/lib/atendimento/webhook-dispatcher.ts`
- `infra/supabase/migrations/20260426_atendimento_s8a_automations.sql`

### NÃO mexer
- `tailwind.config.ts`, `/conversas/*`, `/crm/*`, `/contatos/*`, `/templates/*`, `/agendamentos/*`, `/configuracoes/*`
- `/atendimento/chat-interno` é do S8b (outra sessão)
- `/atendimento/links-redirecionamento` é do S8b

## Entregas obrigatórias

### A. Migration SQL
- [ ] Expandir `atendimento_automation_rules`:
  ```sql
  ALTER TABLE atendimento_automation_rules
    ADD COLUMN conditions_logic VARCHAR DEFAULT 'AND',  -- AND | OR
    ADD COLUMN scope VARCHAR DEFAULT 'global',  -- global | pipeline | stage
    ADD COLUMN scope_id UUID NULL,
    ADD COLUMN last_executed_at TIMESTAMPTZ,
    ADD COLUMN execution_count INT DEFAULT 0;
  ```
- [ ] `CREATE TABLE automation_executions (id, rule_id, triggered_by_event VARCHAR, payload JSONB, actions_run JSONB, status VARCHAR, error TEXT, executed_at TIMESTAMPTZ)`
- [ ] `CREATE TABLE webhook_inbound_endpoints (id, account_id, name, slug UNIQUE, secret VARCHAR, tags_auto VARCHAR[], last_call_at, created_at)`
- [ ] `CREATE TABLE webhook_outbound_urls (id, account_id, name, url, secret, events VARCHAR[], retry_policy JSONB DEFAULT '{"max":5,"backoff_s":[5,15,30,60,120]}', active BOOL DEFAULT true)`
- [ ] `CREATE TABLE webhook_attempts (id, outbound_id FK, event_type, payload JSONB, status_code INT, response_body TEXT, attempt INT, next_retry_at TIMESTAMPTZ, created_at)`
- [ ] `CREATE TABLE api_keys (id, account_id, name, key_hash VARCHAR UNIQUE, scopes VARCHAR[], last_used_at, rotated_at, active BOOL DEFAULT true, created_by, created_at)`
- [ ] Índices: `automation_rules(active, event_name)`, `webhook_attempts(status_code, next_retry_at)`, `api_keys(key_hash)`

### B. Motor de automação (`automation-engine.ts`)
- [ ] Função `runAutomations(event: AutomationEvent)`:
  - Busca `automation_rules WHERE active=true AND event_name=event.type`
  - Avalia `conditions` (JSONB array com field/op/value) respeitando `conditions_logic`
  - Executa `actions` em sequência (JSONB array), loga em `automation_executions`
- [ ] **Gatilhos suportados:** `message_received` · `conversation_created` · `conversation_status_changed` · `tag_added` · `deal_stage_changed` · `scheduled_message_sent` · `time_elapsed`
- [ ] **Condições (operators):** `equals` · `contains` · `regex_match` · `gt` · `lt` · `in` · `has_tag` · `queue_is` · `time_since > Xmin`
- [ ] **Ações disponíveis (9):** `assign_agent(agent_id|round_robin)` · `set_queue(queue_id)` · `add_tag(label_id)` · `remove_tag(label_id)` · `create_deal(pipeline_id,stage_id)` · `move_deal_stage(new_stage_id)` · `send_message(template_id,vars)` · `trigger_n8n(integration_id,payload)` · `call_webhook(url,payload)`
- [ ] Integração no webhook processor: após INSERT em `messages` → `await runAutomations({type:'message_received',message,conversation})`

### C. UI Builder visual `/atendimento/automacoes`
- [ ] Lista de regras (cards) + toggle ativo/inativo + execution_count
- [ ] "+ Nova automação" → wizard 3 steps:
  - Step 1: Gatilho (dropdown evento)
  - Step 2: Condições (chain builder com AND/OR) — componente `ConditionChain`
  - Step 3: Ações (chain builder drag-drop) — componente `ActionChain`
- [ ] Teste dry-run: botão "Testar" → injeta payload fake + mostra o que seria feito
- [ ] Log de execuções: drawer lateral com `automation_executions` das últimas 50

### D. Webhooks de entrada `/atendimento/webhooks/entrada`
- [ ] CRUD de endpoints com slug único (ex: `/api/atendimento/webhooks/inbound/<slug>`)
- [ ] Campo `tags_auto` (array de label_ids) — auto-adiciona ao contato no hit
- [ ] Campo `secret` — HMAC header obrigatório
- [ ] Lista de hits recentes (`webhook_attempts WHERE endpoint_id=X`)
- [ ] Botão "Testar com cURL" — gera snippet com signature

### E. Webhooks de saída `/atendimento/webhooks/saida`
- [ ] CRUD de URLs com eventos subscritos
- [ ] Eventos do domínio: `message.received` · `message.sent` · `conversation.assigned` · `conversation.resolved` · `deal.created` · `deal.stage_changed` · `deal.won` · `deal.lost` · `contact.created`
- [ ] Dispatcher com retry exponencial (worker cron 1min lê `webhook_attempts WHERE status_code NOT IN (2xx) AND next_retry_at <= now()`)
- [ ] Log de últimas 100 tentativas por URL

### F. API REST pública `/api/public/v1/**`
- [ ] Auth: header `Authorization: Bearer <api-key>` OU `api-key: <key>` + `Connection-Token: <token>` (por canal)
- [ ] Hash check via SHA-256 em `api_keys.key_hash` (não armazenar plaintext)
- [ ] **Endpoints Messages:** `POST /messages` (enviar via template ou texto simples se janela aberta)
- [ ] **Endpoints Dashboard:** `GET /dashboard/{conversations-open,resolved-today,avg-response-time,...}` (10 endpoints)
- [ ] **Endpoints CRM:** `POST/GET/PATCH /contacts` · `POST/GET/PATCH /deals` · `POST /activities`
- [ ] Rate limit via Upstash Redis (ou contador em-memória no início)
- [ ] OpenAPI spec auto-gerada em `/api/public/v1/openapi.json`

### G. Integração n8n `/atendimento/integracoes/n8n`
- [ ] Config: URL base do n8n + token webhook
- [ ] Vínculo n8n_integration_id em `queues` + `deals` (campo já existe em `queues`)
- [ ] Ação automation `trigger_n8n(integration_id, payload)` POST pra URL n8n
- [ ] **Piloto real:** Marcelo plugar n8n ID 2967 via form (URL `https://n8n-af-educacional.xxx/webhook/2967` + token)

### H. Página "Apps" `/atendimento/integracoes`
- [ ] Grid de apps habilitáveis (n8n, Google Calendar — já em S5, Transcrição áudio IA — S9)
- [ ] Cada app: toggle habilitar/desabilitar + config JSON
- [ ] Schema: `CREATE TABLE app_installations (id, app_key, config JSONB, enabled BOOL, installed_at)`

### I. Testes
- [ ] Unit: `evaluateCondition({field:'message.content', op:'contains', value:'matrícula'}, payload)` → true
- [ ] Unit: `runAutomations` dispara chain de 3 ações com uma regra casada
- [ ] Integration: POST webhook inbound com HMAC válido → contato criado + tag adicionada + automation disparada
- [ ] E2E: configurar regra "msg recebida 'matricula' → criar deal" → enviar msg test → deal aparece no kanban

### J. PR
- [ ] `feat(atendimento): S8a Automações + Webhooks + API Pública + n8n`
- [ ] Feature flag `ATENDIMENTO_AUTOMATIONS_ENABLED=true`

## Pendência externa
- Marcelo fornecer URL base + token do n8n 2967 (hoje vive no Nexvy)

## Regras de paralelismo

1. Worktree `../eco-atnd-s8a`, branch `feature/atnd-s8a-automacoes`
2. Migração independente (arquivo próprio S8a)
3. Compartilhado: zero — todas rotas novas
4. Paralelo com S7/S8b/S9
5. Memory: `project_atnd_s8a.md`

## Ações do dia 1

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git worktree add ../eco-atnd-s8a feature/atnd-s8a-automacoes
cd ../eco-atnd-s8a
pnpm install
claude --permission-mode bypassPermissions

# 1. Migration S8a + expansão automation_rules
# 2. automation-engine.ts com 3 gatilhos + 5 ações core
# 3. Plugar runAutomations no webhook processor (edição cirúrgica)
# 4. API pública /messages + 1 dashboard endpoint primeiro (smoke)
```

---

*Briefing S089 · leva 2 paralela · Plano-mestre v1*
