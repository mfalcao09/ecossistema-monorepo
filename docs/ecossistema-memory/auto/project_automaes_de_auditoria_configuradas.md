---
name: Automações de auditoria configuradas
description: Automações de auditoria configuradas
type: project
project: erp
tags: ["automações", "auditoria", "cron", "scheduled-tasks"]
success_score: 0.85
supabase_id: 5c2e101d-52ff-4fcf-9b8e-98687c54e1e2
created_at: 2026-04-14 09:13:13.023116+00
updated_at: 2026-04-14 10:07:21.702161+00
---

Configuração aprovada em 11/04/2026:

| Automação | Cron | Frequência |
|-----------|------|------------|
| daily-cross-memory-sync | `0 5 * * *` | Diária 5h |
| plan-audit | `30 9 * * 0,1,3,5` | Dom/Seg/Qua/Sex 9h30 |
| weekly-memory-review | `30 13 * * 0` | Domingo 13h30 |

**Why:** Marcelo quer que divergências plano×execução sejam detectadas automaticamente, sem depender dele pedir.

**How to apply:** plan-audit gera/atualiza `memory/PENDENCIAS.md` em cada projeto. daily-sync mantém TRACKER e CENTRAL-MEMORY atualizados. weekly-review faz limpeza e consolidação.
