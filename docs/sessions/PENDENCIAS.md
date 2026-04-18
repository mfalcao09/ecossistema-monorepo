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
| P-017 | S08+S12 | config | med | Ativar `webhook_targets` (setar `is_active=true`, URLs Railway reais e secrets) para Inter, BRy, Stripe, Evolution conforme cada provider for integrado | uso de `webhook-hardening` em produção | 2026-04-18 |
| P-018 | S08 | refactor | low | `drain_dual_write_queue()` suporta apenas `insert` no ECOSYSTEM. Para upsert/update/delete ou mirrors cross-project (Intentus), criar `drain-mirror-queue` EF que usa `INTENTUS_SERVICE_ROLE_KEY` | resiliência total de mirror fails | 2026-04-18 |

## Resolvidas

| ID | Sessão | Ação | Resolvida em | Commit / PR |
|---|---|---|---|---|
| P-001 | S08 | OWNER_TOKEN_HASH setado via `supabase secrets set` | 2026-04-18 | próximo commit |
| P-002 | S08 | PII_HASH_SALT (64-char hex) setado via `supabase secrets set` | 2026-04-18 | próximo commit |
| P-003 | S08 | STAGE=prod setado via `supabase secrets set` | 2026-04-18 | próximo commit |
| P-004 | S08 | ACL populado — todas as 10 credenciais têm acl configurado (verificado via SQL) | 2026-04-18 | estava pronto (S12) |
| P-005 | S08 | webhook_targets: Inter, BRy, Stripe, Evolution seedados (is_active=false) via migration | 2026-04-18 | próximo commit |
| P-006 | S08 | dual-write-pipeline: suporte cross-project via `{PROJECT}_SERVICE_ROLE_KEY` env vars; INTENTUS_SERVICE_ROLE_KEY setado | 2026-04-18 | próximo commit |
| P-007 | S08 | `drain_dual_write_queue()` + pg_cron `* * * * *` criados via migration | 2026-04-18 | próximo commit |
| P-008 | S08 | smoke-test-efs.sh: 12/12 asserts passing em prod | 2026-04-18 | próximo commit |
| P-009 | S12 | VAULT_KEK_HEX setado no Supabase Dashboard → Functions → Secrets | 2026-04-18 | edd9b76 |
| P-010 | S12 | Deploy das 3 EFs (collect-secret, retrieve-secret, vault-create-token) via supabase CLI | 2026-04-18 | 4ae7307 |
| P-011 | S12 | Migration `vault_tokens` + colunas vault aplicada via SQL Editor ECOSYSTEM | 2026-04-18 | edd9b76 |
| P-012 | S12 | Seed: INTER_CLIENT_SECRET, INTER_CLIENT_ID, INTER_CERT_PEM inseridos em ecosystem_credentials (proxy_only=true) | 2026-04-18 | edd9b76 |
| P-013 | S12 | CSP + security headers em `/vault/*` e `/api/vault/*` em `apps/vault-ui/next.config.ts` | 2026-04-18 | próximo commit |
| P-014 | S12 | Rate limit 10 req/min por IP implementado em `collect-secret/index.ts` via `hitLimit()` | 2026-04-18 | 4ae7307 |
| P-015 | S12 | VAULT_BASE_URL setado no Supabase Dashboard → Functions → Secrets (placeholder Railway) | 2026-04-18 | edd9b76 |
| P-016 | S12 | `apps/vault-ui/` criado com Next.js (layout, rotas vault, API routes, railway.json) | 2026-04-18 | próximo commit |

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
