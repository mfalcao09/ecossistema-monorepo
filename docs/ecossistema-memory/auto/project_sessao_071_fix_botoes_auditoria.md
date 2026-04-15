---
name: Sessão 071 — Fix botões de correção da auditoria XSD
description: Botões de correção da auditoria apontavam para rotas erradas (circular/404). Refatoração para processoId + onVerDocumentos → /diploma/processos/{id}. Commit 8c59bb7 READY.
type: project
---

Fix Bug #2 da pipeline de auditoria XSD (sessão 071, 11/04/2026).

**Commit:** `8c59bb7` | **Deploy:** `dpl_4AGvw3VQcpEbg8tow7wJC9CdqQtn` → READY

**Problema:** botões "Editar dados pessoais/histórico/docentes" no PainelAuditoria abriam página circular ou 404.

**Fix:** Refatoração de toda a cadeia de props:
- `BotaoCorrecao`, `IssueRow`, `GrupoExpandivel`, `PainelAuditoriaProps`, `PainelAuditoria` → substituem `diplomadoId/cursoId/onAbrirDocentes` por `processoId/onVerDocumentos`
- `editar_diplomado/historico/preencher_docentes` → `/diploma/processos/{processoId}` (nova aba)
- `adicionar_comprobatorio` → callback `onVerDocumentos` → `setAbaAtiva("documentos")`
- `PainelAcoes` em `page.tsx` recebe e passa `onVerDocumentos={() => setAbaAtiva("documentos")}`

**Why:** O form de edição completo está em `/diploma/processos/[id]` (SecaoPessoais, SecaoDisciplinas, etc.), não em `/diploma/diplomados` nem `/diploma/diplomas`.

**How to apply:** Ao adicionar novos botões de correção na auditoria, usar sempre `processoId` como identificador de navegação para edição.
