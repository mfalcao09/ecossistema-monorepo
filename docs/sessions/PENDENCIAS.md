# Pendências das sessões — registro canônico

> **Uso:** toda sessão que identificar pendência (config manual, task não-bloqueante, débito técnico, verificação futura) deve registrar aqui antes de encerrar. Uma pendência = uma linha na tabela de "Abertas". Quando for resolvida, mover para "Resolvidas" com a data e o commit/PR que fechou.

## Convenção

| Campo | Regras |
|---|---|
| **ID** | `P-NNN` sequencial, nunca reusar |
| **Sessão** | `S01`…`S18`, `ATND-S4/S5/S6/...`, `Diploma-0`, `F1-SNN` ou `Outro` |
| **Categoria** | `config` (env var, secret, cadastro), `acl` (permissão a popular), `deploy` (falta subir algo), `test` (falta validação), `doc` (falta documentar), `refactor` (débito técnico), `seed` (falta popular dado), `security` |
| **Ação** | Imperativa e concreta — _"Setar `OWNER_TOKEN_HASH` no dashboard Supabase"_, não _"configurar env"_ |
| **Bloqueia** | Lista de sessões ou funcionalidades que ficam travadas enquanto a pendência existe. `—` se não bloqueia nada. |
| **Severidade** | `crit` (prod quebra), `high` (feature não funciona), `med` (degradado), `low` (cosmético) |

---

## Abertas

| ID | Sessão | Categoria | Severidade | Ação | Bloqueia | Aberta em |
|---|---|---|---|---|---|---|
| P-001 | S08 | config | high | Setar `OWNER_TOKEN_HASH` (sha256 hex) em Supabase Dashboard → Project `gqckbunsfjgerbuiyzvn` → Functions → Secrets | uso de EFs por owner (todas rotas protegidas bloqueiam sem isso) | 2026-04-17 |
| P-002 | S08 | config | med | Setar `PII_HASH_SALT` nas Secrets da EF (string aleatória ≥ 32 bytes). Sem isso, usa default `ecosystem-v9` — funciona, mas hashes são previsíveis | correlação segura de PII em logs | 2026-04-17 |
| P-003 | S08 | config | med | Setar `STAGE=prod` nas Secrets. Sem isso, `credential-gateway-v2 /get` (Modo A) pode retornar plaintext em prod | segurança SC-29 | 2026-04-17 |
| P-004 | S08 | acl | high | Popular `ecosystem_credentials.acl` para as 7 credenciais existentes. Hoje todas têm `acl=null` → fail-closed pra qualquer agent não-owner | S11 C-Suite, S13 Clients, S16 Piloto CFO-FIC | 2026-04-17 |
| P-005 | S08 | seed | med | Cadastrar `webhook_targets` conforme providers forem integrados (Inter, BRy, Stripe, Evolution) | uso de `webhook-hardening` em produção | 2026-04-17 |
| P-006 | S08 | refactor | low | `dual-write-pipeline` hoje escreve primary e mirror com o mesmo service-role client (ECOSYSTEM). Para escrever em outros projetos (ex: ERP-FIC, Intentus), expandir para carregar clients adicionais via `ecosystem_credentials.SUPABASE_SERVICE_ROLE_KEY_*` | dual-write real cross-project | 2026-04-17 |
| P-007 | S08 | refactor | low | `dual_write_queue` tem linhas para retry mas nenhum worker drena. Criar pg_cron job ou EF que processa `status='pending' AND next_attempt_at <= now()` | resiliência de mirror fails | 2026-04-17 |
| P-008 | S08 | test | med | Rodar `scripts/smoke-test-efs.sh` contra prod após P-001 estar feito. Script testa 5 EFs (12 asserts) | validação E2E completa | 2026-04-17 |
| P-009 | F1-S01 | config | high | Setar 4 env vars no Railway Orchestrator: `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WEBHOOK_VERIFY_TOKEN=ecossistema-whatsapp-verify`, `MARCELO_WHATSAPP_NUMBER=55...` | HITL outbound WA não funciona sem token | 2026-04-19 |
| P-010 | F1-S01 | config | high | Registrar webhook no Meta WABA Dashboard: URL `https://<railway-url>/webhooks/whatsapp` + verify token `ecossistema-whatsapp-verify` + subscribe `messages` | HITL inbound WA não funciona | 2026-04-19 |
| P-014 | F1-S02 | config | med | Setar `contaCorrente` da FIC nas opções do `InterClient` em produção (necessário para X-Conta-Corrente header nos endpoints de cobrança) | emissão de boletos em prod | 2026-04-20 |
| P-015 | F1-S02 | config | med | Renovar certificado mTLS Inter sandbox antes de 20/05/2026 — acessar portal Inter, integração "TESTE BOLETO API FIC 3", baixar novo par cert+key e atualizar vault (inter-sandbox-cert-fic3, inter-sandbox-key-fic3) | testes e2e sandbox | 2026-04-20 |
| P-017 | S08+S12 | config | med | Ativar `webhook_targets` (setar `is_active=true`, URLs Railway reais e secrets) para Inter, BRy, Stripe, Evolution conforme cada provider for integrado | uso de `webhook-hardening` em produção | 2026-04-18 |
| P-018 | S08 | refactor | low | `drain_dual_write_queue()` suporta apenas `insert` no ECOSYSTEM. Para upsert/update/delete ou mirrors cross-project (Intentus), criar `drain-mirror-queue` EF que usa `INTENTUS_SERVICE_ROLE_KEY` | resiliência total de mirror fails | 2026-04-18 |
| P-019 | Diploma-0 | seed | crit | Fornecer e-mails dos 4 assinantes FIC (LUCIMAR, ALECIANA, MARCELO, eCNPJ FIC) e cadastrá-los via `/diploma/assinantes` com email preenchido — BRy Easy Signer exige email para enviar link | fluxo de assinatura BRy inteiro | 2026-04-17 |
| P-020 | Diploma-0 | config | crit | Confirmar que `BRY_CLIENT_ID` e `BRY_CLIENT_SECRET` estão setadas na Vercel (projeto `diploma-digital`) para o ambiente de Produção — sem isso `bry_configurado` retorna false e nenhuma assinatura XML funciona | assinatura XAdES diplomas | 2026-04-17 |
| P-021 | Diploma-0 | seed | crit | Apagar diploma da Kauana (`5e197846-8d55-4105-94db-b15ce99bf69b`) do banco e reprocessar do zero — hoje está com status falso (`aguardando_envio_registradora`) mas XMLs nunca foram assinados | piloto real E2E | 2026-04-17 |
| P-022 | Diploma-0 | feature | high | Implementar geração real de PDFs: Histórico Escolar, Termo de Expedição, Termo de Registro. Marcelo tem layouts (um já no sistema em Configurações > visual de histórico). Discutir modelo antes de implementar | Fase 0.4 — bloqueia P-021 | 2026-04-17 |
| P-028 | ATND-S4 | deploy | high | Aplicar migration `infra/supabase/migrations/20260421000000_atendimento_s4_kanban.sql` no Supabase ECOSYSTEM (via `supabase db push` ou MCP `apply_migration`). Primeiro em branch `atnd-s4`, validar, depois em prod | S4 Kanban não funciona sem isso | 2026-04-21 |
| P-029 | ATND-S4 | config | high | Rodar `pnpm install` em `apps/erp-educacional/` para baixar `@dnd-kit/*`, `@tiptap/*` e `vitest` adicionados ao package.json | `/atendimento/crm` quebra em dev/build sem as deps | 2026-04-21 |
| P-030 | ATND-S4 | config | med | Regerar types: `pnpm supabase gen types typescript --project-id <branch-id> > apps/erp-educacional/src/types/supabase.atendimento.ts` após aplicar a migration | eliminar `any` casts nas rotas API | 2026-04-21 |
| P-031 | ATND-S4 | config | med | Setar `NEXT_PUBLIC_ATENDIMENTO_CRM_KANBAN_ENABLED=true` em Vercel preview para liberar a rota em prod | feature flag ativa a UI em staging | 2026-04-21 |
| P-032 | ATND-S4 | test | med | Escrever e rodar E2E Playwright: drag de card entre 2 colunas persiste no DB e gera `deal_history_events` | critério de aceite do PR | 2026-04-21 |
| P-033 | ATND-S4 | test | med | Rodar `E2E=1 pnpm test` contra Supabase branch `atnd-s4` para validar trigger `atnd_s4_log_deal_history` | validação integração real | 2026-04-21 |
| P-034 | ATND-S4 | seed | high | Exportar CSV do Nexvy (`console.nexvy.tech → API → export`) das 171 deals reais, rodar `scripts/nexvy_import.ts --dry-run`, revisar, depois rodar sem dry-run | migração Nexvy → ERP | 2026-04-21 |
| P-035 | ATND-S4 | refactor | low | UI `PipelineSelector.onCreate` abre hoje um `alert()` — implementar modal completo com stage builder depois da janela S4 | criação de pipeline no cliente | 2026-04-21 |
| P-036 | ATND-S4 | refactor | low | `StageColumn` menu ⋮ ações (`Editar/Transferir/CSV/Automações`) são placeholder — fechar em S8 | UX completa | 2026-04-21 |
| P-037 | ATND-S4 | refactor | low | Virtualizar listas de cards com `react-virtuoso` quando stage > 200 cards | perf em stages muito longos | 2026-04-21 |
| P-038 | ATND-S4 | config | low | Assignee matching (`assignee_email` do CSV Nexvy → `atendimento_agents.user_id`) ficou fora do script — fechar após S6 Cargos | import completo com ownership | 2026-04-21 |
| P-040 | ATND-S5 | config | high | Criar 1º template WABA na Meta Business Manager (`fic_boas_vindas_matricula` UTILITY) e aguardar aprovação 24-48h — destrava envio ativo e modal "janela fechada" | envio ativo WABA em prod | 2026-04-20 |
| P-041 | ATND-Setup | test | low | Abrir `/dev/tokens` em staging para QA visual dos design tokens Nexvy | paridade visual com Nexvy | 2026-04-20 |
| P-042 | ATND-S4 | seed | med | Exportar 245 contatos + 171 deals reais do Nexvy para alimentar `nexvy_import.ts` (duplica P-034, manter como lembrete setup) | migração 1:1 Nexvy → ERP | 2026-04-20 |
| P-050 | ATND-S6 | deploy | high | Aplicar migration `apps/erp-educacional/supabase/migrations/20260421_atendimento_s6_cargos.sql` em branch Supabase `atnd-s6` e depois em prod após QA | ativação RBAC do módulo Atendimento | 2026-04-21 |
| P-051 | ATND-S6 | seed | high | Rodar `python apps/erp-educacional/scripts/seed_atendimento_permissions.py \| psql "$SUPABASE_DB_URL"` após P-050 (165 INSERTs idempotentes) | presets Admin/Atendente/Atendente restrito ficarem funcionais | 2026-04-21 |
| P-052 | ATND-S6 | config | high | Ativar flag `ATENDIMENTO_RBAC_ENABLED=true` + `NEXT_PUBLIC_ATENDIMENTO_RBAC_ENABLED=true` em dev → staging → prod após treinar operadores FIC. Default é `false` | uso efetivo do RBAC em produção | 2026-04-21 |
| P-053 | ATND-S6 | refactor | med | Integrar envio de email de convite via Microsoft Graph API (app `ecossistema-agentes-fic`, tenant FIC, já no vault com `Mail.Send` granted). Fallback: `accept_url` retornado hoje | fluxo de convite self-service | 2026-04-21 |
| P-054 | ATND-S6 | refactor | low | Deprecar coluna legada `atendimento_agents.role` TEXT (agent/supervisor/admin). Hoje coexiste com `role_id` UUID. Fazer em Fase 2 SaaS após migração de dados | limpeza schema | 2026-04-21 |
| P-055 | ATND-S6 | security | med | Apertar RLS em `agent_roles`/`role_permissions`/`teams`/`team_members`/`agent_invites` para filtrar por `account_id` via JWT claim. Hoje política é permissiva — OK para FIC single-tenant, BLOQUEIA Fase 2 SaaS | multi-tenant Nexvy SaaS | 2026-04-21 |
| P-056 | ATND-S6 | test | med | Rodar testes integration com DB real (invite fluxo completo, 403 cargo custom em rota restrita) após deploy em staging | QA final do S6 | 2026-04-21 |
| P-057 | ATND-S6 | refactor | low | `agent_statuses` realtime via Supabase Realtime — hoje UI de Usuários lê snapshot de `availability_status`. Upgrade só após volume justificar | UX status ao vivo | 2026-04-21 |
| P-060 | ATND-S5 | deploy | high | Aplicar migration `apps/erp-educacional/supabase/migrations/20260421_atendimento_s5_templates_expand.sql` em prod (1 dia depois da S4). Valida `window_expires_at`, `atendimento_scheduled_messages`, `atendimento_calendar_events`, `atendimento_google_tokens` | templates/agendamentos/Calendar funcionarem em prod | 2026-04-21 |
| P-061 | ATND-S5 | config | high | Setar env vars Vercel (projeto erp-educacional): `CRON_SECRET` (openssl rand -hex 32), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI=https://<domínio>/api/auth/google/callback` | crons autenticados + OAuth Google | 2026-04-21 |
| P-062 | ATND-S5 | config | high | Google Cloud Console: criar projeto "FIC Atendimento", habilitar Google Calendar API + People API, OAuth consent External com escopos `calendar.events` + `userinfo.email`, criar OAuth Client Web com redirects prod+localhost | integração Google Calendar completa | 2026-04-21 |
| P-063 | ATND-S5 | config | high | Garantir que `atendimento_inboxes.provider_config` do inbox WhatsApp FIC contém `waba_id`, `phone_number_id`, `access_token`. Sem `waba_id`, sync de templates falha com 400 | sync de templates Meta → Supabase | 2026-04-21 |
| P-064 | ATND-S5 | test | med | Primeiro sync manual: abrir `/atendimento/templates` e clicar "Sincronizar Meta" para popular a tabela com templates já existentes no WABA Manager | baseline de templates | 2026-04-21 |
| P-065 | ATND-S5 | test | med | Smoke E2E real: forçar `window_expires_at` no passado em conversa de teste → banner aparece → seleciona template aprovado → envia → mensagem chega no WhatsApp real do aluno | validação entrega F do briefing | 2026-04-21 |
| P-066 | ATND-S5 | security | med | [DT-S5-01/02] Vault ECOSYSTEM (`@ecossistema/credentials` Modo A) para `refresh_token` Google (hoje em `atendimento_google_tokens` texto) e `access_token` WABA (hoje em `provider_config->>'access_token'` texto) | segurança de credenciais | 2026-04-21 |
| P-067 | ATND-S5 | refactor | low | [DT-S5-03] Webhook Meta `message_template_status_update` → processar incremental em `webhook/route.ts`. Hoje sync é pull (cron 30min) | atualização de status de template em tempo real | 2026-04-21 |
| P-068 | ATND-S5 | refactor | low | [DT-S5-04] FK `atendimento_calendar_events.deal_id` — adicionar `REFERENCES public.atendimento_deals(id) ON DELETE SET NULL` agora que S4 está em main | integridade referencial | 2026-04-21 |
| P-069 | ATND-S5 | refactor | med | [DT-S5-06] Backoff exponencial no worker dispatch (`scheduled_at = now() + 2^attempts min` em reattempt). Hoje só recontamos até MAX_ATTEMPTS=5 sem backoff | resiliência de retry | 2026-04-21 |
| P-070 | ATND-S5 | refactor | med | [DT-S5-07] Propagar `failed` do webhook Meta (24h expirou, número inválido) para `atendimento_scheduled_messages.status='failed'` retroativamente | visibilidade de falhas em agendamentos | 2026-04-21 |
| P-071 | ATND-S5 | refactor | low | [DT-S5-08] Cancelar série inteira de recorrente — `DELETE /api/atendimento/scheduled-messages/[id]?series=true` cancela todas as futuras com mesmo contact+template | UX cancelamento em bloco | 2026-04-21 |
| P-080 | Diploma-ATND | refactor | low | Build do `diploma-digital` (ERP educacional) quebrou após merge leva 1 por 6 bugs Next 15 (import server em client, exports não-canônicos em `route.ts`, type narrowing Supabase). Resolvido em PR #52 — verificar se deploy Vercel ficou verde pós-merge | deploys Vercel preview/prod | 2026-04-21 |
| P-090 | ATND-S7 | deploy   | high | Aplicar `infra/supabase/migrations/20260425_atendimento_s7_metrics.sql` em Supabase branch `atnd-s7`, validar `compute_daily_metrics(CURRENT_DATE-1)` retorna snapshot, depois promover a prod. Sessão não aplicou (requer MCP + cost confirm) | S7 Dashboards + Relatórios + Widgets externos | 2026-04-21 |
| P-091 | ATND-S7 | config   | high | Setar `ATENDIMENTO_WIDGET_JWT_SECRET` (secret forte, ≥ 32 bytes) em Vercel envs + Railway. Sem ela `signWidgetToken` cai no fallback `CRON_SECRET` e perde separação de escopo | geração de iframes externos com JWT | 2026-04-21 |
| P-092 | ATND-S7 | config   | med  | Ativar `ATENDIMENTO_DASHBOARDS_ENABLED=1` + `NEXT_PUBLIC_APP_URL` em preview → staging → prod após P-060. Default em prod é `false` — sem isso home volta pro LegacyHome | rollout dos dashboards na UI | 2026-04-21 |
| P-093 | ATND-S7 | seed     | med  | Rodar backfill manual: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/aggregate-metrics-daily?backfill=90` após P-060 para popular últimos 90 dias em `metrics_snapshots` | dashboards terem histórico imediato (sem precisar esperar 90 dias) | 2026-04-21 |
| P-094 | ATND-S7 | refactor | low  | `atendimento_conversations.updated_at` é usado como proxy de `resolved_at` no RPC. Ideal: adicionar coluna `resolved_at TIMESTAMPTZ` + backfill + ajustar RPC — pode distorcer SLA se o registro for editado depois de resolver | fidelidade de SLA de resolução | 2026-04-21 |
| P-095 | ATND-S7 | test     | med  | Escrever testes: (a) vitest para `dashboards.ts` (JWT round-trip, formatCentsBRL, normalizeRange); (b) integration contra Supabase branch atnd-s7 verificando que RPC devolve 20+ colunas preenchidas após 1 INSERT sintético | regressão em métricas e JWT | 2026-04-21 |
| P-096 | ATND-S7 | refactor | low  | Adicionar tab "Widgets" em `atendimento/configuracoes/layout.tsx` (arquivo fora do escopo S7). Hoje usuários chegam só pelo botão "Widgets" do dashboard home | descoberta nos menus de configurações | 2026-04-21 |
| P-097 | ATND-S7 | security | med  | Endurecer RLS em `dashboard_widgets`/`report_definitions`/`metrics_snapshots`/`widget_share_tokens` para filtrar por `account_id` via JWT claim quando multi-tenant chegar. Hoje permissiva (`authenticated USING (true)`) — OK FIC single-tenant | multi-tenant SaaS Nexvy | 2026-04-21 |
| P-098 | ATND-S8b | deploy | high | Aplicar migration `apps/erp-educacional/supabase/migrations/20260427_atendimento_s8b_chat_links.sql` em branch Supabase `atnd-s8b` e depois prod | ativação S8b | 2026-04-21 |
| P-099 | ATND-S8b | seed | high | Rerodar `python apps/erp-educacional/scripts/seed_atendimento_permissions.py \| psql "$SUPABASE_DB_URL"` após P-070 para inserir permissões dos 2 módulos novos (`team_chats`, `link_redirects`) nos 3 presets de cargo | RBAC S8b funcional | 2026-04-21 |
| P-100 | ATND-S8b | config | high | Ativar flags em Vercel: `ATENDIMENTO_CHAT_INTERNO_ENABLED=true`, `NEXT_PUBLIC_ATENDIMENTO_CHAT_INTERNO_ENABLED=true`, `ATENDIMENTO_LINKS_REDIRECT_ENABLED=true`, `NEXT_PUBLIC_ATENDIMENTO_LINKS_REDIRECT_ENABLED=true` (preview primeiro, prod depois de QA) | sidebar + rota `/l/[slug]` ficam operacionais | 2026-04-21 |
| P-101 | ATND-S8b | test | med | E2E Playwright: (a) criar DM entre 2 agents, mensagem aparece no outro tab via Realtime em ≤2s; (b) criar link `/l/atendimento` com 3 números + distribution=sequential, validar round-robin em 6 clicks; (c) mention @nome dispara badge de unread no menu | critério de aceite do PR | 2026-04-21 |
| P-102 | ATND-S8b | security | med | Apertar RLS em `team_chats`/`team_chat_members`/`team_messages` para permitir SELECT/INSERT apenas se o agent for membro do chat (hoje é `FOR ALL authenticated USING (true)` — OK para FIC single-tenant, BLOQUEIA Fase 2 SaaS) | isolamento multi-tenant | 2026-04-21 |
| P-103 | ATND-S8b | refactor | low | Implementar typing indicator persistente via Supabase Presence com debounce server-side + rate-limit, hoje o handleTyping faz track a cada tecla (OK para FIC, revisar em volume) | UX typing em escala | 2026-04-21 |

## Resolvidas

| ID | Sessão | Ação | Resolvida em | Commit / PR |
|---|---|---|---|---|
| _nenhuma ainda_ | | | | |

---

## Como adicionar uma pendência

1. Leia a lista de Abertas pra evitar duplicata
2. Pegue o próximo `P-NNN` livre
3. Acrescente linha na tabela de Abertas
4. Commit junto com o trabalho da sessão (mesmo PR)
5. Se a pendência bloqueia sessões, mencione ela no briefing da sessão afetada

## Como fechar uma pendência

1. Mover a linha de Abertas → Resolvidas
2. Preencher `Resolvida em` (data) e `Commit / PR` (hash curto ou URL do PR)
3. Commit da resolução deve mencionar `Closes P-NNN` no body
