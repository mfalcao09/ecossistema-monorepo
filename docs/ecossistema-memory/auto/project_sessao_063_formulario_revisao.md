---
name: Sessão 063 — FormularioRevisao 12 seções + PDF Export
description: FormularioRevisao expandido para 12 seções XSD v1.05 + PDF export portado do formulário antigo + RPC COALESCE docente key
type: project
---

Sessão 063 (11/04/2026): FormularioRevisao reescrito com 12 seções completas (XSD v1.05) + PDF export portado. Commit `2fd21c3`, deploy READY.

**Why:** FormularioRevisao era tela 2 (pós-extração) com apenas 5 seções; precisava cobrir todos os campos do XSD v1.05 antes de remover o formulário antigo (tela 3).

**How to apply:** FormularioRevisao é o formulário canônico. O formulário antigo em `/diploma/processos/[id]/page.tsx` ainda existe mas não é mais atingido pelo fluxo normal (redirect pós-criação vai para `/diploma/processos`). Próxima sessão deve removê-lo.

**Pendências:**
- 61 disciplinas no processo `b71cdb1b` com `docente_nome = NULL` — UPDATE manual a partir de `dados_confirmados->>'docente'`
- Formulário antigo ainda não removido
- Seções Curso/Emissora/IES precisam de auto-preenchimento do cadastro
