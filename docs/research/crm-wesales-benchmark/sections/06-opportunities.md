# 06 — Opportunities

**URL:** `/opportunities/list`

## Subnav
- **Opportunities** (active) — list view — `/opportunities/list`
- **Pipelines** — kanban view — `/opportunities/pipeline`
- **Bulk Actions** — `/opportunities/bulk-actions`

## CTAs
- `Sort By`
- `Opportunity` (nova)
- `Create New Pipeline`

## Features inferidas (GHL standard)
- [x] List view (table) + Kanban view (Pipelines) — switch por subnav
- [x] Multiple pipelines (cada deal num pipeline específico)
- [x] Create New Pipeline do zero
- [x] Bulk actions em deals (similar a Contacts)
- [x] Sort by (provável: Created, Updated, Value, Stage, Owner)
- [x] Stages custom por pipeline (padrão GHL)
- [x] Opportunity owner/assignee
- [x] Opportunity value em BRL

## Gap para benchmark profundo
Precisa criar pipeline + deal de teste pra ver:
- Formulário de criação de oportunidade (campos padrão + custom)
- Card view do kanban (foto, valor, last activity, tasks)
- Drag-and-drop entre stages
- Probability/forecast
- Rotten deals (aging alerts)

## Comparação

| Feature | WeSales | Pipedrive | Intentus |
|---------|---------|-----------|----------|
| Multi-pipeline | ✅ | ✅ | ⚠️ |
| List + Kanban toggle | ✅ | ✅ | ⚠️ |
| Bulk actions | ✅ | ✅ | ❌ |
| Custom stages | ✅ | ✅ | ⚠️ |
| Rotten deals aging | prov. | ✅ | ❌ |
