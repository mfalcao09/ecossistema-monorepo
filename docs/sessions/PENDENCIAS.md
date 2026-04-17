# Pendências das sessões — registro canônico

> **Uso:** toda sessão que identificar pendência (config manual, task não-bloqueante, débito técnico, verificação futura) deve registrar aqui antes de encerrar. Uma pendência = uma linha na tabela de "Abertas". Quando for resolvida, mover para "Resolvidas" com a data e o commit/PR que fechou.

## Convenção

| Campo | Regras |
|---|---|
| **ID** | `P-NNN` sequencial, nunca reusar |
| **Sessão** | `S01`…`S18` ou `Outro` |
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
| P-009 | S12 | config | crit | Gerar VAULT_KEK_HEX (32 bytes aleatórios) e setar em Supabase Dashboard → Functions → Secrets. Sem isso, `wrap/unwrapDEK` falham e nenhum magic link funciona | todo o vault S12 + S13 + S16 | 2026-04-17 |
| P-010 | S12 | deploy | high | Deploy das 2 EFs do vault: `supabase functions deploy collect-secret` + `supabase functions deploy retrieve-secret` (source em `packages/magic-link-vault/server/edge-function/`) | magic link form + SC-29 Modo B | 2026-04-17 |
| P-011 | S12 | deploy | high | Aplicar migration `20260417090000_vault_tokens.sql` em ECOSYSTEM via `supabase db push` | vault_tokens table + colunas vault em ecosystem_credentials | 2026-04-17 |
| P-012 | S12 | seed | high | Criar linha em `ecosystem_credentials` para cada credencial que usará vault (ex: `INTER_CLIENT_SECRET` project=`fic`). Linha deve existir antes do collect-secret tentar fazer UPDATE | S16 CFO-FIC piloto | 2026-04-17 |
| P-013 | S12 | security | high | Configurar CSP no Next.js bloqueando scripts externos em `/vault/*`. Adicionar header `Content-Security-Policy: default-src 'self'; script-src 'self'` na rota do form | defense-in-depth do vault | 2026-04-17 |
| P-014 | S12 | config | med | Configurar rate limit em `/api/vault/submit` no Supabase Dashboard (prevenir brute force de tokens). Recomendado: 10 req/min por IP | segurança do magic link | 2026-04-17 |
| P-015 | S12 | config | med | Setar URL base do vault (`VAULT_BASE_URL`) como env var para `collect-secret-tool.ts` (`VaultToolContext.vault_base_url`). Produção: Railway domain ou custom domain | MCP tool gerar URL correta | 2026-04-17 |
| P-016 | S12 | deploy | med | Integrar `server/webapp/` em app existente (orchestrator Railway ou app dedicado). Copiar routes `/vault/*` e `/api/vault/*` para o Next.js app que servir como vault UI | UI acessível pelo Marcelo | 2026-04-17 |

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
