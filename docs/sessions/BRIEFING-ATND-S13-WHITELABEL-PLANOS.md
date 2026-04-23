# BRIEFING — Atendimento S13 · White-label + Planos + Onboarding SaaS

> **Worktree:** `../eco-atnd-s13` · **Branch:** `feature/atnd-s13-whitelabel`
> **Duração:** 6-8 dias · **Dependências:** **S12 obrigatoriamente mergeada** (multi-tenant é pré-requisito)
> **Prioridade:** P2 — completa a transformação para SaaS recurring revenue

---

## Missão

Fechar a **Fase 4 SaaS** do módulo Atendimento implementando: (1) **customização white-label por account** (logos, cores, domínio, textos de login), (2) **sistema de planos tiered com feature gating** (Basic/Pro/Enterprise), (3) **onboarding self-service** (criar conta + escolher plano + trial 14 dias + checkout), e (4) **painel financeiro do parceiro** com integração real ao Inter. Após S13, Marcelo pode vender Nexvy (ou Klésis ERP educacional) como SaaS público.

## Por que importa

Último passo para o módulo virar produto independente. Com S13:
- Cliente acessa `app.nexvy.com.br/signup` → cria conta → pega trial 14 dias → escolhe plano → paga via Inter → vira account self-service, sem intervenção do Marcelo
- Cada account tem seu logo, paleta de cores, domínio customizado (`{cliente}.nexvy.com.br`)
- Feature gating real: Basic libera só Inbox+Kanban, Pro adiciona DS Voice, Enterprise libera DS Agente+Bot+multi-tenant sub-contas

## Leituras obrigatórias

1. `CLAUDE.md`
2. `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` — Parte 2.3 seção T (Painel Parceiro — 12 features)
3. `docs/sessions/BRIEFING-ATND-S12-MULTI-TENANT.md` (pré-requisito) — especialmente Painel Parceiro placeholder
4. **Benchmark (11 vídeos "[Parceiros]" — REFERÊNCIA PRINCIPAL):**
   - `docs/research/nexvy-whitelabel/bvpz84EThEU/` — **Customização White Label** (33 frames — guia visual completo)
   - `docs/research/nexvy-whitelabel/qrRvyH0k6l8/` — **Planos e Funcionalidades** (55 frames — gabarito de tiered pricing)
   - `docs/research/nexvy-whitelabel/G0XsZWjQV8c/` — Início da cobrança (17 frames)
   - `docs/research/nexvy-whitelabel/db54n8_3_Sg/` — Relatórios de faturamento (16 frames)
   - `docs/research/nexvy-whitelabel/0I1UH-wIA2s/` — Config Conta Demo (30 frames)
   - `docs/research/nexvy-whitelabel/t1aj8gLs9cI/` — Criação de Conta (34 frames — onboarding)
   - `docs/research/nexvy-whitelabel/jbgM0hgvTPc/` — Ações e Menus Personalizados (29 frames)
   - `docs/research/nexvy-whitelabel/XdikJZkmY7Q/` — Gestão admin (30 frames)
   - `docs/research/nexvy-whitelabel/-X2jMXU_zos/` — Canal de demonstração (16 frames)
   - `docs/research/nexvy-whitelabel/-W1Gvw7_QzM/` — Criação página FB (26 frames)
   - `docs/research/nexvy-whitelabel/S1liAttRAtw/` — Panorama Perfil (16 frames)
5. **Packages**: `@ecossistema/billing` (Inter client) — usar para checkout e recurring billing

## Escopo preciso (EXCLUSIVO)

- `apps/erp-educacional/src/app/(saas)/**` — NOVA rota root para signup/login público (fora do `/atendimento`)
  - `/signup`, `/login`, `/forgot-password`
  - `/onboarding/**` — criar conta, escolher plano, config inicial
- `apps/erp-educacional/src/app/parceiro/**` — expande placeholder da S12
  - `/parceiro/customizacao` — logo, cores, domínio
  - `/parceiro/planos` — CRUD
  - `/parceiro/contas/[id]/faturamento` — drill-down por account
- `apps/erp-educacional/src/app/api/saas/**` — endpoints públicos (signup, trial, checkout)
- `apps/erp-educacional/src/app/api/parceiro/**`
- `apps/erp-educacional/src/lib/saas/feature-gating.ts` — `hasFeature(account, feature_key)` middleware
- `apps/erp-educacional/src/lib/saas/billing.ts` — integração Inter recurring
- `apps/erp-educacional/src/lib/saas/whitelabel-config.ts` — lê `accounts.branding_config JSONB`
- `infra/supabase/migrations/20260502_atendimento_s13_whitelabel.sql`

## NÃO MEXA

- Tabelas `atendimento_*` (não adicionar colunas)
- RLS da S12 (já aperta tudo)
- Rotas `/atendimento/**` (feature gating é via middleware HOC)

## Entregas obrigatórias

### A. Migration SQL
- [ ] `ALTER TABLE accounts ADD COLUMN`:
  - `branding_config JSONB DEFAULT '{}'` — `{logo_url, favicon_url, primary_color, secondary_color, login_title, login_subtitle, custom_domain, product_name}`
  - `plan_id UUID REFERENCES plans`
  - `is_partner BOOL DEFAULT false` — conta que pode criar sub-accounts (MBP)
  - `parent_account_id UUID REFERENCES accounts` — para hierarquia de parceiro
  - `trial_started_at`, `trial_ends_at`, `status VARCHAR` (active/trial/suspended/canceled)
- [ ] `CREATE TABLE plans` (id, name, slug, description, price_cents BIGINT, billing_interval VARCHAR='monthly'|'yearly', features JSONB, limits JSONB — `{max_agents, max_conversations_month, max_deals, max_inboxes, ...}`, visible BOOL, sort_order)
- [ ] `CREATE TABLE subscriptions` (id, account_id FK, plan_id FK, status, started_at, next_billing_at, canceled_at, canceled_reason, payment_method JSONB, created_at)
- [ ] `CREATE TABLE invoices` (id, subscription_id FK, amount_cents, status, inter_boleto_id, due_at, paid_at, url, created_at)
- [ ] `CREATE TABLE feature_entitlements` (account_id FK, feature_key VARCHAR, enabled BOOL, override_reason TEXT, PRIMARY KEY (account_id, feature_key)) — overrides manuais
- [ ] Seed de 3 planos: **Basic R$297/mês**, **Pro R$697/mês**, **Enterprise R$1997/mês**
- [ ] Seed features canônicas: `inbox_basic`, `crm_kanban`, `templates_waba`, `ds_voice`, `ds_agente`, `ds_bot`, `multi_tenant_subaccounts`, `priority_support`, `white_label_full`, `api_access`

### B. Feature gating middleware
- [ ] `lib/saas/feature-gating.ts`:
  - `getAccountFeatures(account_id)` — plano atual + overrides
  - `hasFeature(account_id, feature_key)` — boolean com cache
  - `requireFeature(feature_key)` HOC para Route Handlers (retorna 402 Payment Required se gated)
- [ ] Client hook `useFeature(feature_key)` para esconder UIs

### C. UI Customização White-label `/parceiro/customizacao`
- [ ] Upload de logos (3 variantes: menu, login, favicon) → Supabase Storage
- [ ] Color picker: primary + secondary
- [ ] Textos: nome do produto, título/subtítulo de login, documentação URLs, número suporte
- [ ] Preview ao vivo dos 3 placements (menu, login, email)
- [ ] Save em `accounts.branding_config`
- [ ] Middleware `whitelabel-config.ts` lê config e injeta em `<ThemeProvider>` + meta tags

### D. Domínio customizado
- [ ] Campo `accounts.custom_domain` — quando setado, app responde também em `{custom}.nexvy.com.br` (via Vercel wildcard domain)
- [ ] Instruções ao parceiro: setar CNAME → validação automática

### E. UI Planos `/parceiro/planos`
- [ ] CRUD de planos (apenas parceiro dono = Marcelo hoje)
- [ ] Form: nome, preço, features check-list (10+ toggles), limits numéricos
- [ ] Página pública `/planos` com comparativo lado-a-lado

### F. Onboarding self-service `/signup` + `/onboarding`
- [ ] `/signup` — form email+senha (Supabase Auth) → confirma email
- [ ] `/onboarding/conta` — wizard:
  1. Nome do negócio + slug (gera subdomain `{slug}.nexvy.com.br`)
  2. Ramo de atividade
  3. Tamanho equipe (1-5, 5-20, 20+)
  4. Escolha de plano (3 cards + trial 14 dias grátis)
- [ ] `/onboarding/checkout` — integração `@ecossistema/billing` Inter:
  - Trial grátis: pula checkout, agenda cobrança para `trial_ends_at`
  - Pagamento direto: boleto ou PIX, libera após `paid_at`
- [ ] Após conclusão: cria `accounts` + `account_members` (owner) + `subscriptions` + redirect para `/atendimento`

### G. Canal de demonstração (aprendizado de `-X2jMXU_zos`)
- [ ] Toggle em `accounts`: `demo_mode BOOL` → popula com dados fake (contatos/deals/conversations placeholder) na criação
- [ ] Tag "DEMO" visível na UI para diferenciar dos reais

### H. Painel financeiro parceiro `/parceiro/faturamento`
- [ ] Dashboard com: MRR total · churn rate · trial conversion · revenue por plano · top N accounts por receita
- [ ] Drill-down por account: histórico invoices + próxima cobrança + método de pagamento
- [ ] Export CSV + PDF da fatura

### I. Integração Inter billing recorrente
- [ ] `lib/saas/billing.ts`:
  - `createSubscription(account_id, plan_id)` — cria em DB + schedule cron
  - `chargeSubscription(subscription_id)` — gera boleto Inter (reusa `@ecossistema/billing`)
  - `handleInterWebhook(payload)` — recebe pagamento confirmado → marca `invoices.paid_at` + estende `subscriptions.next_billing_at`
  - Cron diário `/api/cron/charge-subscriptions` — processa `next_billing_at <= now()`

### J. Menus personalizados (aprendizado `jbgM0hgvTPc`)
- [ ] `accounts.custom_menu_items JSONB` — array `[{label, icon, url, roles}]`
- [ ] Renderizados no sidebar entre os itens padrão (placeholder dinâmico)

### K. Dashboard parceiro (Panorama Perfil — `S1liAttRAtw`)
- [ ] `/parceiro/dashboard` — visão consolidada: N accounts ativos/trial/suspenso, MRR, novos trials últimos 30d, churn últimos 30d, suporte tickets abertos

### L. Testes
- [ ] Unit: `hasFeature(account_enterprise, 'ds_agente')` → true; `hasFeature(account_basic, 'ds_agente')` → false
- [ ] Integration: signup → onboarding → trial → DB state correto
- [ ] E2E Playwright: full signup flow com trial ativa

### M. PR
- [ ] `feat(atendimento): S13 White-label + Planos + Onboarding SaaS`
- [ ] Feature flag `SAAS_PUBLIC_SIGNUP_ENABLED=false` default
- [ ] Checklist de ativação em prod (config domínio wildcard, custom hook auth, Inter account, etc)

## Pendências externas (registrar)

- **P-180** Wildcard domain Vercel (`*.nexvy.com.br` → app)
- **P-181** Inter contrato de recebedor para billing recorrente
- **P-182** Landing page `www.nexvy.com.br` com CTAs para `/signup`
- **P-183** Definir política de cancelamento/reembolso (LGPD + CDC)
- **P-184** Stripe como alternativa ao Inter (para clientes internacionais)
- **P-185** Custom hook Supabase Auth para `account_id` em JWT (comum com S12)

## Stack técnica

- Supabase Storage para logos
- Vercel wildcard domain para custom subdomains
- `@ecossistema/billing` (Inter) para boletos recorrentes
- Middleware Next 15 para injetar branding dinâmico (via cookie `atnd_account` + `accounts.branding_config`)

## Regras de paralelismo

1. **Pré-requisito absoluto**: S12 mergeada em main
2. Worktree `../eco-atnd-s13`
3. Não é paralelo com S12 (depende direto). Pode rodar paralelo com S10/S11 se já mergeados.
4. Memory: `project_atnd_s13.md`
5. P-IDs: P-180..P-189

## Ações do dia 1

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git checkout main && git pull
# VERIFICAR que S12 está mergeada:
git log --oneline origin/main | grep "S12 Multi-tenant"
# Se sim:
git worktree add ../eco-atnd-s13 -b feature/atnd-s13-whitelabel
cd ../eco-atnd-s13
pnpm install
claude --permission-mode bypassPermissions

# Primeiro prompt: "Leia o briefing docs/sessions/BRIEFING-ATND-S13-WHITELABEL-PLANOS.md e execute ponta-a-ponta. Verifique que S12 está em main antes."
```

---

*Briefing S089 · leva 3 · Plano-mestre v1 · **completa Fase 4 SaaS***
