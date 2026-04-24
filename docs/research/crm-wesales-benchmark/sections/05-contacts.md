# 05 — Contacts

**URL:** `/contacts/smart_list/All`

## Subnav
- **Smart Lists** (active) — `/contacts/smart_list/All`
- **Bulk Actions** — `/contacts/bulk/actions`
- **Tasks**
- **Companies**
- ⚙️ Settings (ícone)

## Bulk actions (barra de ações sobre seleção)
- `Import` — importar CSV/etc
- `Add Contact` — CTA criar
- `Advanced filters` — filtros complexos
- `Export` — exportar seleção
- `Trigger automation` — disparar workflow pra contatos selecionados
- `Send email` — email em massa
- `Add tags` — tags em massa
- `Delete` — deletar em massa
- `More` — menu overflow (provável: merge, change owner, update custom fields)
- `Manage fields` — configurar colunas da tabela

## Paginação
- First / Prev / Next / Last
- Page Size

## Context topbar
- **What's new / Contact updates** — banner de release notes (red dot indica novo)

## Features observadas
- [x] Smart Lists (listas salvas com filtros dinâmicos)
- [x] Bulk Actions (seleção múltipla + ações em lote)
- [x] Tasks relacionadas a contatos (kanban de tarefas)
- [x] Companies (entidade B2B separada — Contacts ↔ Companies)
- [x] Advanced filters (construtor de queries)
- [x] Import / Export CSV
- [x] Trigger automation direto da lista
- [x] Tags em massa
- [x] Manage fields (custom fields configuráveis na view)
- [x] Release notes in-app (banner "What's new")

## Comparação

| Feature | WeSales | Pipedrive | Intentus |
|---------|---------|-----------|----------|
| Smart Lists | ✅ | ✅ (Filters) | ⚠️ |
| Bulk actions (10+) | ✅ | ✅ | ❌ |
| Companies entity | ✅ | ✅ | ⚠️ |
| Tasks vinculados | ✅ | ✅ | ⚠️ |
| Trigger workflow em lote | ✅ | ⚠️ | ❌ |
| Custom fields gerenciados na UI | ✅ | ✅ | ⚠️ |
