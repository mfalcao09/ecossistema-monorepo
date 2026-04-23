# BRIEFING — Atendimento S7 · Dashboards + Relatórios + Widgets

> **Worktree:** `../eco-atnd-s7` · **Branch:** `feature/atnd-s7-dashboards`
> **Duração:** 4-5 dias · **Dependências:** S4 mergeado (deals/pipelines existem)
> **Prioridade:** P1

---

## Missão

Transformar a página raiz `/atendimento` em dashboard operacional com 6 widgets (Canais/CRM/Conversas/Atividades/Agentes IA/Widget-config) + implementar `/atendimento/relatorios` com 6 tipos de relatório (Vendas/Atividades/Conversas/Ligações/SDR/Closer), 3 abas de Indicadores (Resultados/Usuários/Geral) e exportação de origem de leads. Diretoria FIC abre o ERP e em 5s sabe o pulso da operação.

## Por que importa

Hoje `/atendimento` e `/atendimento/relatorios` são esqueletos vazios. Sem métricas, a FIC não valida ROI da reformulação. S7 é a primeira entrega que **mostra valor tangível** (tempo médio de resposta, taxa de resolução, ranking de atendentes, origem de leads).

## Leituras obrigatórias

1. `CLAUDE.md` · `apps/erp-educacional/docs/PLANO-REFORMULACAO-ATENDIMENTO-FIC.md` Parte 4 Sprint S7 + Parte 2.3 seção N
2. `docs/adr/016-protocolo-sessoes-paralelas.md`
3. **Benchmark visual:**
   - `docs/research/nexvy-whitelabel/dNaKezWr_LY/` — Relatórios gerais (10 frames)
   - `docs/research/nexvy-whitelabel/0_0i72W2s68/` — Aba Resultados (9 frames)
   - `docs/research/nexvy-whitelabel/t2bF8-5uui8/` — Aba Usuários (23 frames)
   - `docs/research/nexvy-whitelabel/olMQTujz724/` — Aba Geral (39 frames)
   - `docs/research/nexvy-whitelabel/iTuVYvn347I/` — Panorama (15 frames)
   - `docs/research/nexvy-whitelabel/B8E5ab6SATs/` — Exportação origem leads (31 frames)
4. Tabelas já existentes: `conversations`, `messages`, `deals`, `deal_activities`, `agents`, `queues`

## Escopo preciso

### Pode mexer
- `apps/erp-educacional/src/app/(erp)/atendimento/page.tsx` — reforma do home (hoje skeleton)
- `apps/erp-educacional/src/app/(erp)/atendimento/relatorios/**`
- `apps/erp-educacional/src/components/atendimento/dashboard/**` — novos widgets
- `apps/erp-educacional/src/components/atendimento/reports/**`
- `apps/erp-educacional/src/app/api/atendimento/metrics/**`
- `apps/erp-educacional/src/app/api/atendimento/reports/**`
- `apps/erp-educacional/src/app/api/atendimento/widgets/**`
- `apps/erp-educacional/src/app/api/cron/aggregate-metrics-daily/route.ts` (cron 02:00 BRT)
- `infra/supabase/migrations/20260425_atendimento_s7_metrics.sql`
- `apps/erp-educacional/docs/PENDENCIAS-S7.md`

### NÃO mexer
- `tailwind.config.ts`, `layout.tsx` atendimento · `/conversas/*` · `/crm/*` · `/contatos/*` · `/templates/*` · `/agendamentos/*` · `/configuracoes/*`

## Entregas obrigatórias

### A. Migration SQL
- [ ] `CREATE TABLE metrics_snapshots (id, account_id, metric_key, scope, scope_id, value_numeric, value_json, period_start, period_end, created_at)` — snapshots diários/semanais/mensais por agente/fila/global
- [ ] `CREATE TABLE widgets (id, account_id, title, url_template, icon, sort_order, visible_to_role_ids[], created_by, created_at)` — widgets iframe externos
- [ ] `CREATE TABLE report_definitions (id, account_id, name, type, chart_config JSONB, filters JSONB, created_by, created_at)` — gráficos custom salvos
- [ ] Índices: `metrics_snapshots(metric_key, period_start DESC)`, `metrics_snapshots(scope, scope_id)`

### B. Worker diário `aggregate-metrics-daily` (cron 02:00 BRT)
- [ ] Função RPC SQL `compute_daily_metrics(day DATE)` agrega 20+ métricas:
  - **Conversas:** abertas/dia · resolvidas/dia · tempo médio de resposta · tempo médio resolução · NPS score (se tiver campo)
  - **Mensagens:** total in/out · por canal · por agente
  - **Deals:** criados · movidos de etapa · ganhos · perdidos · ticket médio
  - **Agentes:** tempo online · conversas atribuídas · resolvidas · tempo pausado
  - **Filas:** volume · tempo médio de espera · backlog
- [ ] Upsert em `metrics_snapshots` (idempotente — rerun safe)
- [ ] Worker via `/api/cron/aggregate-metrics-daily` + cron no `vercel.json`

### C. Dashboard Home (`/atendimento`)
- [ ] **Widget Canais** — cards por inbox (logo + nome + status + contagem conversas 7d)
- [ ] **Widget CRM** — barra percentual por etapa do pipeline mais ativo + valor total pipeline
- [ ] **Widget Conversas** — 3 números grandes (abertas/aguardando/resolvidas hoje) + mini-chart 7d
- [ ] **Widget Atividades** — 3 contadores (próximas/hoje/atrasadas) + botão "Criar atividade"
- [ ] **Widget Agentes IA** — placeholder para S10 ("N agentes ativos · M erros") — mostrar "Em breve" agora
- [ ] **Widget personalizado** — card com nome do usuário + saudação + atalhos

### D. Relatórios (`/atendimento/relatorios`)
- [ ] **Topbar com 6 tipos:** Vendas · Atividades · Conversas · Ligações (placeholder) · SDR · Closer
- [ ] **3 abas Indicadores:** Resultados · Usuários · Geral
- [ ] **Aba Resultados:** taxa fechamento · ticket médio · total vendas (ApexCharts OU Tremor)
- [ ] **Aba Usuários:** ranking agentes (tabela ordenável: atendimentos/resolvidos/tempo médio/taxa)
- [ ] **Aba Geral:** visão consolidada multi-métrica
- [ ] **Filtros:** Data range · Usuário/agente · Fila · Tipo
- [ ] **Adicionar Gráfico:** modal com nome + tipo (barras/linhas/pie) + métrica → salva em `report_definitions`
- [ ] **Export CSV** por relatório (header `Content-Disposition: attachment`)

### E. Exportação origem leads (destaque do benchmark B8E5ab6SATs)
- [ ] `/atendimento/relatorios/origem-leads` — tabela com `contacts.source` agrupado + countagem + % + export CSV

### F. Widgets externos configuráveis
- [ ] `/atendimento/configuracoes/widgets` — CRUD de URLs externas com suporte a placeholders `{{user.email}}`, `{{user.id}}`, `{{account_id}}`
- [ ] Na TopBar do atendimento, widgets aparecem como abas extras (ex: "Metabase FIC", "Power BI")
- [ ] Modo **Nova Aba** (abre em blank) OU **Incorporado** (iframe com X-Frame-Options liberado)
- [ ] Token JWT curto (expiração 5min) no iframe via `/api/atendimento/widgets/[id]/token`

### G. Testes
- [ ] Unit: `compute_daily_metrics(DATE '2026-04-20')` retorna shape esperado
- [ ] Integration: cron aggregate + query `metrics_snapshots WHERE period_start = yesterday`
- [ ] E2E: criar 3 conversas → rodar cron → widget Conversas mostra 3

### H. PR
- [ ] Branch `feature/atnd-s7-dashboards` → PR
- [ ] Feature flag `ATENDIMENTO_DASHBOARDS_ENABLED=true`

## Stack técnica recomendada

- **Charts:** Tremor (https://tremor.so — React + Tailwind, feito pra dashboards) OU Recharts
- **Datas:** `date-fns` + `date-fns-tz` (fuso `America/Campo_Grande`)
- **Agregação:** SQL RPC no Postgres (mais rápido que aplicação) + materialized views se N linhas > 100k
- **Cron:** `vercel.json` crons (ver [docs](https://vercel.com/docs/cron-jobs))

## Regras de paralelismo

1. Worktree `../eco-atnd-s7`, branch `feature/atnd-s7-dashboards`
2. Slot migração: dia pós-S4-merge (nova migration não colide com S5/S6)
3. Compartilhado: apenas `page.tsx` raiz (reforma total, sem edição aditiva — você dono total daqui)
4. Memory: `project_atnd_s7.md`
5. Paralelo com S8a/S8b/S9 — coordenação via `PENDENCIAS.md` append-only

## Ações do dia 1

```bash
cd /Users/marcelosilva/Projects/GitHub/ecossistema-monorepo
git worktree add ../eco-atnd-s7 feature/atnd-s7-dashboards
cd ../eco-atnd-s7
pnpm install
claude --permission-mode bypassPermissions

# Dentro: ler este briefing + Parte 4 S7 do plano + seção N
# 1. Migration metrics_snapshots/widgets/report_definitions
# 2. RPC compute_daily_metrics com casos básicos
# 3. Instalar: @tremor/react
# 4. 6 widgets do home (pode ser placeholder com dados fake primeiro)
```

---

*Briefing S089 · leva 2 paralela · Plano-mestre v1*
