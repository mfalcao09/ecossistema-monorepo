# BRIEFING — Atendimento S12 · Multi-tenant (Fase 4 SaaS)

> **Worktree:** `../eco-atnd-s12` · **Branch:** `feature/atnd-s12-multi-tenant`
> **Duração:** 8-10 dias · **Dependências:** Leva 1 + Leva 2 + (idealmente S10/S11) mergeadas em main
> **Prioridade:** P2 — bloqueador para **Fase 4 SaaS Nexvy**. Não inicie sem aprovação explícita do Marcelo.

---

## Missão

Converter o módulo Atendimento de **single-tenant FIC** para **multi-tenant SaaS** (Klésis, Splendori, Nexvy whitelabel e terceiros). Cada tenant (account) tem seus próprios agentes, pipelines, deals, templates, bots, etc — totalmente isolados via RLS. Mantém compat com FIC sem quebrar nada em produção.

## Por que importa

Hoje `account_id` é `NULL` em todas as tabelas. Quando Marcelo quiser vender Nexvy whitelabel (ou onboard Klésis no ERP educacional), é impossível sem multi-tenant. S12 desbloqueia **linha de receita SaaS recorrente** — o maior vetor de crescimento do ecossistema.

## Por que é sensível

Refactor cross-cutting que toca **TODAS** as tabelas `atendimento_*` + RLS + middleware auth + componentes que leem dados. Um erro vaza dados entre tenants — **bug crítico de segurança**. Só inicie com:
- FIC em produção estável há pelo menos 2 semanas
- Staging separado com dataset sintético
- Aprovação escrita de Marcelo + ADR explícito

## Leituras obrigatórias

1. `CLAUDE.md` (raiz) — ações bloqueadas
2. `docs/adr/016-protocolo-sessoes-paralelas.md` — S12 é **SOZINHO** (não paralelo)
3. `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` — Parte 3.3 (Estratégia multi-tenancy) + Parte 4 Fase 4
4. `docs/sessions/PENDENCIAS.md` — P-055 (ATND-S6 pedindo apertar RLS) + P-067 (S7) + outros "security" → **resolvidos por S12**
5. **Benchmark visual do Painel Parceiro Nexvy** (11 vídeos):
   - `docs/research/nexvy-whitelabel/XdikJZkmY7Q/` — Gestão admin
   - `docs/research/nexvy-whitelabel/t1aj8gLs9cI/` — Criação de Conta
   - `docs/research/nexvy-whitelabel/0I1UH-wIA2s/` — Config conta demo
   - `docs/research/nexvy-whitelabel/G0XsZWjQV8c/` — Início cobrança
   - `docs/research/nexvy-whitelabel/S1liAttRAtw/` — Panorama Perfil

## Escopo preciso (EXCLUSIVO — refactor cross-cutting)

- **Schema migration única e grande**: `infra/supabase/migrations/20260501_atendimento_s12_multitenant.sql`
- **Todas as RLS das tabelas `atendimento_*`** — apertar para `account_id = (auth.jwt() ->> 'account_id')::uuid`
- **`apps/erp-educacional/src/middleware.ts`** — injetar `account_id` no JWT
- **Novas tabelas**: `accounts`, `account_members`, `account_invites`
- **Novos endpoints**: `/api/accounts/**`, `/api/accounts/[id]/switch` (multi-account para Marcelo)
- **Painel Parceiro**: `/parceiro/**` (dashboard cross-accounts)

## Entregas obrigatórias

### A. Migration SQL (massiva)
- [ ] `CREATE TABLE accounts (id UUID PK, name, slug UNIQUE, plan_id FK NULL, billing_email, created_at, trial_ends_at, status VARCHAR='active')`
- [ ] `CREATE TABLE account_members (account_id FK, user_id FK auth.users, role VARCHAR, -- owner|admin|member, PRIMARY KEY (account_id, user_id))`
- [ ] `CREATE TABLE account_invites (id, account_id FK, email, role, token UNIQUE, expires_at, created_at)`
- [ ] **Seed FIC como account**: `INSERT INTO accounts (id, name, slug) VALUES ('<fic-account-id>', 'FIC - Faculdades Integradas Cassilândia', 'fic')`
- [ ] **Backfill todas as `atendimento_*` tables**: `UPDATE ... SET account_id='<fic-account-id>' WHERE account_id IS NULL`
- [ ] **`ALTER ... SET NOT NULL`** em todas as colunas `account_id` após backfill
- [ ] **Novas RLS canônicas** (template abaixo):
  ```sql
  CREATE POLICY "tenant_isolation" ON atendimento_conversations
    FOR ALL TO authenticated
    USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
    WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);
  ```
  Aplicar a TODAS as tabelas `atendimento_*` (conversations, messages, contacts, inboxes, labels, queues, deals, activities, notes, history, protocols, campaigns, templates, etc — umas 30 tabelas)
- [ ] Função Postgres `current_account_id()` para uso em queries

### B. Middleware auth (`middleware.ts`)
- [ ] Ao setar session Supabase: buscar `account_members` do user, pegar primeiro account onde ele é member, injetar `account_id` no JWT custom claim
- [ ] Se user tem múltiplos accounts (Marcelo, por exemplo): armazenar `active_account_id` em cookie `atnd_account` + permitir switch via `/api/accounts/switch`
- [ ] Se sem account: redirect para `/onboarding` (criar primeiro account)

### C. Client Supabase ajustado
- [ ] Em `lib/supabase/server.ts` e `client.ts`: garantir que JWT tem `account_id` claim injetado por custom hook Supabase Auth (`auth.jwt_custom_claims`)
- [ ] Criar helper `getActiveAccountId()` server-side + client-side

### D. APIs accounts
- [ ] `POST /api/accounts` — criar novo account (owner = user atual)
- [ ] `GET /api/accounts/mine` — lista de accounts do user
- [ ] `POST /api/accounts/switch` — troca cookie `atnd_account`
- [ ] `POST /api/accounts/[id]/members` — convidar user (gera token)
- [ ] `POST /api/accounts/invites/accept?token=` — aceitar convite

### E. UI Account switcher
- [ ] Dropdown no header do ERP com accounts do user + "Criar novo account"
- [ ] Switch causa reload (reset JWT + refetch data)

### F. Painel Parceiro `/parceiro/**` (para Marcelo e futuros MBPs)
- [ ] Requer role `owner` em `accounts` marcada como `is_partner=true`
- [ ] `/parceiro/contas` — lista de accounts do parceiro + busca
- [ ] `/parceiro/faturamento` — revenue por account (integra com Inter)
- [ ] `/parceiro/planos` — CRUD de planos (placeholder, preenche em S13)
- [ ] `/parceiro/customizacao` — placeholder S13

### G. Migração de pendências abertas (fecha várias)
- [ ] Resolve P-055 (ATND-S6 RLS multi-tenant)
- [ ] Resolve P-067 (ATND-S7 RLS multi-tenant)
- [ ] Resolve outros "security/med" no PENDENCIAS com tag multi-tenant

### H. Testes críticos
- [ ] **Integration**: user A do account 1 faz SELECT em `atendimento_conversations` → só vê conversations do account 1
- [ ] **Integration**: user A tenta INSERT com `account_id=<account 2 id>` → 403 (RLS bloqueia)
- [ ] **Integration**: user B (member de 2 accounts) faz switch → vê dataset diferente
- [ ] **E2E**: owner cria account → convida user → user aceita → vê atendimento vazio (novo tenant)

### I. Documentação
- [ ] `docs/adr/020-atendimento-multi-tenant.md` — decisão canônica V9
- [ ] `apps/erp-educacional/docs/MULTI-TENANT-GUIDE.md` — guia para devs futuros (como adicionar nova tabela tenant-aware)

### J. PR (gigante — preparar bem)
- [ ] `feat(atendimento): S12 Multi-tenant — migração completa para SaaS`
- [ ] PR body com checklist de segurança + plano de rollback
- [ ] Feature flag `ATENDIMENTO_MULTI_TENANT_ENABLED=false` default
- [ ] **Plano de deploy em 3 fases**:
  1. Aplicar migration (backfill FIC account) — FIC continua funcionando
  2. Ativar middleware injection (mas RLS ainda permissiva) — observabilidade
  3. Apertar RLS definitivamente — ponto sem volta

## Pendências externas (registrar)

- **P-160** Marcelo decide política de plano default (trial 14 dias? free forever?)
- **P-161** Validar com um 2º account de teste (Klésis?) antes de cobrar
- **P-162** Setup de Supabase Auth custom hook para JWT claim
- **P-163** Migrar `ecosystem_credentials` para também ser tenant-aware (hoje tudo é FIC-scoped)

## Riscos + mitigação

| Risco | Mitigação |
|---|---|
| Vazamento de dados entre tenants | Teste exaustivo de RLS antes do deploy; feature flag gradual |
| JWT claim não injetar (custom hook quebra) | Fallback para `cookie.atnd_account` + log de erros Sentry |
| Tabelas órfãs (esquecer algum `account_id`) | Script auditor: `SELECT table_name FROM information_schema.columns WHERE column_name='account_id' AND ...` |
| Performance (RLS adiciona overhead em joins) | Índices em `(account_id, ...)` em TODAS as tabelas |

## Regras de paralelismo

**S12 RODA SOZINHO** — ADR-016 Regra 5 (slot de migração único). Não abra outras sessões paralelas nesse período.

## Pré-requisito para kickoff

Marcelo escreve no Slack/WhatsApp: "Autorizo S12 multi-tenant, ambiente seguro, commits podem aplicar migration destrutiva em staging."

## Ações do dia 1

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git checkout main && git pull
git worktree add ../eco-atnd-s12 -b feature/atnd-s12-multi-tenant
cd ../eco-atnd-s12
pnpm install
claude --permission-mode bypassPermissions

# Primeiro prompt: "Leia o briefing docs/sessions/BRIEFING-ATND-S12-MULTI-TENANT.md e execute ponta-a-ponta EM STAGING. Não toque em produção sem verificação explícita do Marcelo."
```

---

*Briefing S089 · leva 3 · Plano-mestre v1 · **refactor cross-cutting crítico***
