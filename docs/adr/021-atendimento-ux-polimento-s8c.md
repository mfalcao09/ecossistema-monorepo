# ADR-021: Recomendações UX globais do módulo Atendimento (S8c)

- **Status:** proposto
- **Data:** 2026-04-23
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** ADR-020 (dashboards personalizados), S6 cargos, S7 métricas, S8 chat/automações

## Contexto e problema

A consolidação do benchmark de 5 concorrentes (Chatwoot, Digisac, Whaticket, Zaapy, PressTicket — `docs/research/nexvy-outrossaas/CONSOLIDADO-WIDGETS-BENCHMARK.md`) produziu **51 widgets candidatos** e **3 padrões UX globais** que não se encaixam como widgets individuais. O PR B do ADR-020 absorve os widgets; os padrões UX precisam de um espaço próprio porque:

- tocam o **chrome do módulo** (cabeçalho, sidebar, layout), não os cards do grid;
- exigem **persistência de preferências** por usuário (presets de filtro);
- alguns demandam **dados cross-widget** (ex: sumário "Agora" agrega fila + agente + sessão).

Entregar no mesmo PR inflaria o escopo, diluiria a revisão e atrasaria a expansão do catálogo. Ao mesmo tempo, adiar sem registro canônico faz perder o achado do benchmark.

## Opções consideradas

- **Opção 1: Incluir no PR B (ADR-020 escopo)** — rápido mas infla escopo do PR em ~60% e atrasa merge.
- **Opção 2: Sprint separada S8c (esta ADR)** — planejamento canônico, escopo coeso, tamanho ~1.5 PR.
- **Opção 3: Não fazer** — deixa gap permanente com Nexvy/WeSales em polimento do chrome.

## Critérios de decisão

- **Coerência de escopo** — o PR B só adiciona linhas em catálogo + componentes; UX global toca layout.
- **Dados cross-widget** — precisa de agregador backend próprio.
- **Persistência de preferências** — nova tabela/JSONB em user settings.
- **Risco visual** — mexer no cabeçalho do módulo requer mais validação.

## Decisão

**Escolhemos Opção 2.** Sprint dedicada **S8c — Polimento UX Atendimento**, pós-merge do PR B.

## Escopo da S8c

### 1. Filtros globais do dashboard (drawer único)

- Drawer lateral com: data (range/rápido), departamento/equipe, atendente, tag, canal.
- Presets salvos por usuário em `atendimento_dashboard_preferences` (JSONB por dashboard_id).
- Cada widget do grid recebe o filtro aplicado via contexto React (`DashboardFilterContext`).
- Fonte: Zaapy `EwfLh4stjC4@01:30`, Digisac `zC2vEv1DYQM@09:07`.

### 2. Status bar no topo do módulo

- Banner persistente no `(erp)/atendimento/layout.tsx` (não no dashboard — visível em todas as telas do módulo).
- Sumário ao-vivo: agentes online/pausa/offline · filas com espera · conversas sem atribuição.
- Clique abre modal detalhado (drill-down).
- Realtime via Supabase subscription em `atendimento_presence` + `atendimento_conversations`.
- Fonte: recomendação top do agente Whaticket + padrão Nexvy.

### 3. Abas contextuais "Agora" no cabeçalho do dashboard

- Logo abaixo do `DashboardHeader`: tabs "Geral · Em Atendimento · Por Departamento · Por Atendente".
- Não são dashboards novos — são **lentes de filtro** pré-configuradas aplicadas sobre o dashboard atual.
- Fonte: Digisac `zC2vEv1DYQM@21:04`.

### 4. Refinos menores

- Toast de confirmação padronizado (Whaticket pattern — já temos parcial).
- Breadcrumb de transferências aparece inline na tela de conversa (não no dashboard — é UX da S3).

## Consequências

### Positivas

- UX paritária com Nexvy/Digisac em polimento operacional.
- Filtros globais eliminam duplicidade de filtros por widget.
- Status bar dá sensação de cockpit ao vivo.

### Negativas

- Nova tabela `atendimento_dashboard_preferences`.
- Realtime da status bar adiciona 1 canal WebSocket persistente por usuário (custo baixo).
- Filtro global + filtro individual de widget pode gerar dupla fonte de verdade — escolher uma.

### Riscos

- Abas "Agora" podem ser confundidas com dashboards. Mitigação: usar estilo visual distinto (chips, não cards).
- Status bar realtime sob carga alta (FIC pode ter pico em matrícula). Mitigação: debounce 2s + fallback polling.

## Ação de implementação (S8c)

1. Migration: `atendimento_dashboard_preferences` (owner_user_id, dashboard_id, filters jsonb, tabs jsonb).
2. Endpoint: `/api/atendimento/dashboards/:id/preferences` (GET/PUT).
3. Endpoint agregador: `/api/atendimento/live-summary` (status bar).
4. Context: `DashboardFilterProvider` — todos os widgets consomem via hook `useDashboardFilter()`.
5. Componentes: `FilterDrawer`, `LiveStatusBar`, `DashboardTabs`.
6. Adaptar `useMetrics` e `useJson` dos widgets P1 para aceitar filtros do contexto.

## Revisão

Revisar em: **2026-05-30** (2 semanas após merge S8c) ou se a tabela de preferências crescer > 10k rows (gatilho para repensar persistência).
