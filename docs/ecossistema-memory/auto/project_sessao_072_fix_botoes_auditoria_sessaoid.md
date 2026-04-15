---
name: Sessão 072 — Fix botões auditoria → FormularioRevisao (sessaoId)
description: Botões de correção abriam formulário legado vazio. Fix: roteamento dual via sessaoId → /diploma/processos/novo/revisao/{sessaoId}. Commit 031b9f7 READY.
type: project
---

Fix Bug #3 da pipeline de auditoria XSD (sessão 072, 11/04/2026).

**Commit:** `031b9f7` | **Deploy:** `dpl_7gr9x8W4YSCfgMnP6Y2K3yyornvy` → READY

**Problema:** Após sessão 071, botões de correção apontavam para `/diploma/processos/{processoId}` — o formulário legado vazio para diplomas criados pelo novo fluxo de extração IA.

**Fix:** Adição de `sessaoId` à cadeia de props + roteamento dual em `BotaoCorrecao`:
- `sessaoId` presente → `/diploma/processos/novo/revisao/{sessaoId}` (FormularioRevisao com dados da IA)
- `sessaoId` ausente → `/diploma/processos/{processoId}` (fallback legado manual)
- `sessaoId` = `extracao?.id` — já disponível no estado da página desde sessão 038+
- Cadeia: `page.tsx (extracao?.id)` → `PainelAcoes` → `PainelAuditoria` → `GrupoExpandivel` → `IssueRow` → `BotaoCorrecao`

**Why:** Diplomas criados via extração têm dados em `extracao_sessoes.dados_confirmados`. O formulário legado `/diploma/processos/{id}` está completamente vazio para esses casos.

**How to apply:** Sempre que adicionar novos botões de correção na auditoria, verificar se o destino é o fluxo novo (precisa de `sessaoId`) ou o fluxo legado (`processoId`). Preferir `sessaoId` quando disponível.
