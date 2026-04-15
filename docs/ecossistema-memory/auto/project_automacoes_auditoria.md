---
name: Automações de auditoria configuradas
description: 3 automações: daily-cross-memory-sync (diária 5h), plan-audit (dom/seg/qua/sex 9h30), weekly-memory-review (dom 13h30)
type: project
---

Configuração aprovada em 11/04/2026:

| Automação | Cron | Frequência |
|-----------|------|------------|
| daily-cross-memory-sync | `0 5 * * *` | Diária 5h |
| plan-audit | `30 9 * * 0,1,3,5` | Dom/Seg/Qua/Sex 9h30 |
| weekly-memory-review | `30 13 * * 0` | Domingo 13h30 |

**Why:** Marcelo quer que divergências plano×execução sejam detectadas automaticamente, sem depender dele pedir. A weekly roda 4h após o plan-audit de domingo para consolidar com base nos achados.

**How to apply:** plan-audit gera/atualiza `memory/PENDENCIAS.md` em cada projeto. daily-sync mantém TRACKER e CENTRAL-MEMORY atualizados. weekly-review faz limpeza e consolidação.
