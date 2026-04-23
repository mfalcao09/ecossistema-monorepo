# ADR-020: Dashboards personalizados no módulo Atendimento

- **Status:** aceito
- **Data:** 2026-04-22
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** ADR-019 (squad pattern), S7 dashboards (commit 588fdf1), S6 cargos/permissões, S8 realtime canais

## Contexto e problema

O módulo Atendimento da FIC (ERP Educacional) tem hoje dois caminhos de home:

1. `LegacyHome` — 4 cards estáticos e atalhos, ativado em produção. Marcelo qualificou como "pobre".
2. `DashboardHome` (S7) — atrás de flag `ATENDIMENTO_DASHBOARDS_ENABLED`, exibe 4 KPIs + line chart + pie chart, com range 7/30/90d. Não é personalizável: a lista de widgets é global, todo usuário vê o mesmo.

O benchmark de concorrentes (Nexvy/HelenaCRM — 58 vídeos em `docs/research/nexvy-whitelabel/`; WeSales — screenshot do CEO) mostra dois padrões canônicos do segmento:

- **Home rica** — saudação personalizada, primeiros-passos/onboarding, status dos canais, atividades/eventos do dia, KPIs, gráficos e widgets de agentes IA. Dá sensação de "cockpit" em vez de tela vazia.
- **Múltiplas dashboards por usuário** — cada operador cria suas próprias dashboards, renomeia, fixa favoritas e compartilha. Filtro global de período. Widgets arrastáveis e redimensionáveis.

A base S7 é sólida (tabelas `dashboard_widgets`, `metrics_snapshots`, `report_definitions`, RPC `compute_daily_metrics` com 20+ métricas), mas falta:

- conceito de **dashboard** como agrupador de widgets,
- **catálogo extensível** de tipos de widget (para adicionar widgets novos descobertos via benchmark sem migration),
- UI com drag/resize e switcher multi-dashboard,
- remoção do flag legado.

## Opções consideradas

- **Opção 1: Evoluir S7 in-place** — adicionar tabela `atendimento_dashboards`, FK em `dashboard_widgets`, catálogo, CRUD, UI com `react-grid-layout`. Reusa RPC e métricas existentes.
- **Opção 2: Reescrever dashboards do zero** — descartar S7 e criar módulo novo com schema diferente. Unificaria código, mas joga fora a RPC `compute_daily_metrics` e widgets já funcionais.
- **Opção 3: Configuração por JSON em settings (sem schema dedicado)** — salvar o layout inteiro em uma única linha JSONB por usuário. Mais simples, mas inviabiliza compartilhamento e RBAC granular.

## Critérios de decisão

- **Aproveitamento do S7** — RPC e tabela de widgets já estão em produção com 20+ métricas.
- **Extensibilidade** — adicionar widgets novos (pós-benchmark Whaticket/Digisac/Zaapy/Chatwoot/PressTicket) sem migration.
- **Alinhamento com S6 (RBAC)** — permitir compartilhamento readonly por cargo.
- **Curva de implementação** — a decisão de hoje precisa ser entregue em ≤ 2 semanas.
- **UX paritária ao segmento** — switcher multi-dashboard + drag/resize é baseline em Nexvy/WeSales.

## Decisão

**Escolhemos Opção 1.**

Evoluímos o schema S7 com (a) nova tabela `atendimento_dashboards`, (b) FK `dashboard_id` em `dashboard_widgets`, (c) tabela `atendimento_widget_catalog` como enum vivo, e (d) UI com `react-grid-layout`. O flag `ATENDIMENTO_DASHBOARDS_ENABLED` e a `LegacyHome` são removidos. O catálogo permite plug-in de widgets novos no PR B (pós-benchmark) sem nova migration.

## Consequências

### Positivas

- Zero desperdício de S7 — `compute_daily_metrics` + `metrics_snapshots` continuam sendo fonte única da verdade.
- Catálogo extensível reduz custo marginal de adicionar widget novo (só código + seed INSERT).
- UX paritária com Nexvy/HelenaCRM/WeSales; fecha gap citado pelo CEO.
- Compartilhamento de dashboard via `is_shared` + RBAC S6 (`atendimento.dashboards.write`).
- PR B (widgets do benchmark) fica pequeno e desacoplado.

### Negativas

- `react-grid-layout` adiciona ~35 kB gzipped no bundle da home de atendimento (aceitável; carrega só nessa rota).
- Migração dos 6 seeds S7 para dashboard default exige backfill com `ON CONFLICT DO NOTHING` — precisa ser idempotente.
- RBAC refinado para `atendimento.dashboards.*` depende de S6 já em produção (✅).

### Neutras / riscos

- Carga inicial pode ter "shift" visual enquanto o grid calcula posições. Mitigação: SSR com layout salvo.
- Compartilhamento por cargo pode gerar conflito se vários admins editarem o mesmo dashboard compartilhado. Mitigação: compartilhados são readonly; edição só pelo owner (ou "salvar como cópia").

## Evidência / pesquisa

- `docs/research/nexvy-whitelabel/INDEX.md` — 58 vídeos HelenaCRM; especialmente `olMQTujz724` (Aba Geral), `t2bF8-5uui8` (Aba Usuários), `0_0i72W2s68` (Aba Resultados).
- Screenshot WeSales (enviado pelo CEO em 2026-04-22) — dropdown multi-dashboard com Shared With Me + Add Dashboard + pin + filtro Last 30 Days + menu ⋯.
- `infra/supabase/migrations/20260425_atendimento_s7_metrics.sql` — base schema a ser estendida.
- `react-grid-layout` — biblioteca de referência no segmento (padrão Grafana-like); MIT, ativa, ~11k ★.

## Ação de implementação

**PR A (esta sessão):**

- Migration `20260428_atendimento_dashboards_personalizados.sql`: `atendimento_dashboards` + `dashboard_id` FK + `atendimento_widget_catalog` + backfill dos seeds S7.
- API `/api/atendimento/dashboards` (CRUD) + `/catalog` (GET).
- Adaptar `/api/atendimento/widgets` para filtrar por `dashboard_id`.
- UI: `DashboardSwitcher`, `DashboardGrid` (react-grid-layout), cabeçalho Nexvy-style.
- Widgets Helena-confirmados (10): onboarding, status canais, atividades, eventos, capacidade, tempo espera, qualidade usuário, qualidade equipe, agentes IA, origem leads.
- Remover `LegacyHome` + flag `ATENDIMENTO_DASHBOARDS_ENABLED`.
- RBAC S6: `atendimento.dashboards.write` para edição.

**PR B (após benchmark Whaticket/Digisac/Zaapy/Chatwoot/PressTicket):**

- Novos widgets no catálogo (sem migration).
- Ajustes UX descobertos no benchmark adicional.

## Revisão

Revisar em: 2026-05-15 (após 3 semanas em produção) ou quando o catálogo ultrapassar 25 tipos de widget (gatilho para reavaliar se vira plugin system).
