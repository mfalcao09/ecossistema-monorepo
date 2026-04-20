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
| P-028 | ATND-S4 | deploy | high | Aplicar migration `infra/supabase/migrations/20260421000000_atendimento_s4_kanban.sql` no Supabase ECOSYSTEM (via `supabase db push` ou MCP `apply_migration`). Primeiro em branch `atnd-s4`, validar, depois em prod no slot do dia 21/04 | S4 Kanban não funciona sem isso; bloqueia S5 e S6 | 2026-04-21 |
| P-029 | ATND-S4 | config | high | Rodar `pnpm install` em `apps/erp-educacional/` para baixar `@dnd-kit/*`, `@tiptap/*` e `vitest` adicionados ao package.json | `/atendimento/crm` quebra em dev/build sem as deps | 2026-04-21 |
| P-030 | ATND-S4 | config | med | Regerar types: `pnpm supabase gen types typescript --project-id <branch-id> > apps/erp-educacional/src/types/supabase.atendimento.ts` após aplicar a migration | eliminar `any` casts nas rotas API | 2026-04-21 |
| P-031 | ATND-S4 | config | med | Setar `NEXT_PUBLIC_ATENDIMENTO_CRM_KANBAN_ENABLED=true` em Vercel preview para liberar a rota em prod | feature flag ativa a UI em staging | 2026-04-21 |
| P-032 | ATND-S4 | test | med | Escrever e rodar E2E Playwright: drag de card entre 2 colunas persiste no DB e gera `deal_history_events` | critério de aceite do PR | 2026-04-21 |
| P-033 | ATND-S4 | test | med | Rodar `E2E=1 pnpm test` contra Supabase branch `atnd-s4` para validar trigger `atnd_s4_log_deal_history` (teste `integration.deal-history.test.ts` já está no worktree, skipado sem `E2E=1`) | validação integração real | 2026-04-21 |
| P-034 | ATND-S4 | seed | high | Exportar CSV do Nexvy (`console.nexvy.tech → API → export`) das 171 deals reais, rodar `scripts/nexvy_import.ts --dry-run`, revisar, depois rodar sem dry-run | migração Nexvy → ERP | 2026-04-21 |
| P-035 | ATND-S4 | refactor | low | UI `PipelineSelector.onCreate` abre hoje um `alert()` — implementar modal completo com stage builder depois da janela S4 | criação de pipeline no cliente | 2026-04-21 |
| P-036 | ATND-S4 | refactor | low | `StageColumn` menu ⋮ ações (`Editar/Transferir/CSV/Automações`) são placeholder — fechar em S8 (Automações) | UX completa | 2026-04-21 |
| P-037 | ATND-S4 | refactor | low | Virtualizar listas de cards com `react-virtuoso` quando stage > 200 cards (risco citado no plano) | perf em stages muito longos | 2026-04-21 |
| P-038 | ATND-S4 | config | low | Assignee matching (`assignee_email` do CSV Nexvy → `atendimento_agents.user_id`) ficou fora do script — fechar após S6 Cargos | import completo com ownership | 2026-04-21 |

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
