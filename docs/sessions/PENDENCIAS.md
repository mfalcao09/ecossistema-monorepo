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
| P-009 | S16/S19 | config | high | Provisionar credenciais Inter sandbox CFO-FIC. **⚠️ Sandbox Inter: seg–sex 8h–20h Brasília apenas** (indisponível fins de semana). Próxima janela: 2026-04-21 (seg). Precisa de: client_id, client_secret, certificado.crt, certificado.key (baixar zip da aplicação em developers.inter.co/sandbox). **Atenção:** banner no portal indica análise em andamento para liberação de certificados (ver changelog Inter). | run real do CFO-FIC — boletos | 2026-04-17 |
| P-010 | S19 | config | high | Setar `META_PHONE_NUMBER_ID=938274582707248` como env var no runtime do agente CFO-FIC. Token já está no Vault (`meta-whatsapp-token-fic-sandbox`). Sem esse env var o URL de envio fica vazio e o proxy falha. | envio real de WhatsApp via Meta API | 2026-04-18 |

| P-104 | S8a-atnd | deploy | high | Aplicar migration `infra/supabase/migrations/20260426_atendimento_s8a_automations.sql` em branch Supabase e depois em prod após QA | ativação do PR S8a | 2026-04-21 |
| P-105 | S8a-atnd | config | high | Setar flag `ATENDIMENTO_AUTOMATIONS_ENABLED=true` em dev → staging → prod. Default é `false`: nem webhook Meta nem inbound customizado dispara motor sem a flag | webhook processor invocar regras | 2026-04-21 |
| P-106 | S8a-atnd | config | high | Marcelo precisa cadastrar em `/atendimento/integracoes/n8n` a URL real do n8n ID 2967 "N8N – AF EDUCACIONAL" + token (hoje vive no Nexvy). Form pronto, aguardando credencial | piloto real FIC do n8n 2967 | 2026-04-21 |
| P-107 | S8a-atnd | config | med | Setar `ADMIN_SECRET` (ou `CRON_SECRET`) no Vercel. Sem isso, `/api/atendimento/webhooks/worker` retorna 500. Agendar cron 1min apontando para `POST /api/atendimento/webhooks/worker` com header `x-cron-secret` | retry exponencial de webhook outbound | 2026-04-21 |
| P-108 | S8a-atnd | refactor | med | Enviar mensagens criadas por `send_message` (action do engine) via Meta API. Hoje o motor insere row em `atendimento_messages` com `status=pending` — precisa de worker/trigger para chamar `POST /conversas/[id]/messages` e marcar `sent` | automações que respondem ao cliente efetivamente enviarem msg | 2026-04-21 |
| P-109 | S8a-atnd | security | med | Rate limiting em `/api/public/v1/**`. Hoje sem limite — em prod plugar Upstash Redis ou contador in-memory por api-key | evitar abuso / DoS na API pública | 2026-04-21 |
| P-110 | S8a-atnd | test | med | Rodar teste integração end-to-end: criar regra "msg recebida 'matrícula' → criar deal em pipeline Matrículas", enviar POST webhook fake com HMAC válido, confirmar deal aparece no Kanban | QA real S8a | 2026-04-21 |
| P-111 | S8a-atnd | refactor | low | Expor endpoints `/api/public/v1/dashboard/{conversations-open,resolved-today,...}` separados (hoje é 1 endpoint único consolidando 10 KPIs). Escolhido consolidado por simplicidade — dividir se consumer precisar | granularidade igual Nexvy | 2026-04-21 |
| P-112 | S8a-atnd | security | low | RLS fina em `api_keys` / `webhook_inbound_endpoints` / `webhook_outbound_urls` filtrando por `account_id` quando Fase 2 SaaS. Hoje `auth_only_*` (authenticated) | Fase 2 multi-tenant | 2026-04-21 |
| P-113 | PR#33 | refactor | med | Estender `packages/c-suite-templates/src/instantiator.ts` para copiar subdirs opcionais do squad pattern (`masters/`, `tasks/`, `workflows/`, `checklists/` — ADR-019) de `templates/c-suite/{ROLE}-IA/` para `apps/{business}/agents/{role}/` na instanciação. Atualmente só copia chief + variants + evolved-config-seed | S16 piloto CFO-FIC consumir os novos artefatos via instanciação automática (hoje precisa copiar manual) | 2026-04-20 |
| P-114 | PR#33 | doc | low | Plano B arquivado: criar package `@ecossistema/squads` genérico (schema estilo aiox — `squad.yaml` + `config.yaml` + `agents/*.md`) quando aparecer o primeiro squad **não-mapeável em 1 C-level** (ex: squad compliance-LGPD cross-business, squad onboarding-aluno). Gatilho: 3º squad não-C-Suite identificado. Referência ADR-019 § Revisão | expansão não-C-Suite | 2026-04-20 |

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
