---
name: Bugs #G + #H do motor XML resolvidos + override humano universal
description: Status do motor XML após sessão 022 (07/04/2026) — 11/12 bugs resolvidos, princípio do override humano elevado a regra arquitetural universal
type: project
---

**Fato:** Em 2026-04-07 os bugs #G (atos regulatórios do curso via tabela dedicada `atos_curso`) e #H (override humano de regras de negócio) foram resolvidos e estão em produção. Commit `2518ed3`, deploy `dpl_7mgBX54PMUEczE3JsPxUzP3fJQzJ` READY. Status do motor XML: **11 de 12 bugs resolvidos (~92%)**. Único pendente: **#F (Documento PDF/A em base64)** — sub-projeto de 2-4 dias, será tratado em sessão dedicada.

**Why:** O princípio do override humano (#H) foi elevado pelo Marcelo a regra arquitetural universal do ERP: *"A confirmação humana pode sobrescrever qualquer regra de negócio"*. Isso vale para todo o ERP, não só motor XML. A tabela `validacao_overrides` é genérica (`entidade_tipo`/`entidade_id`/`regra_codigo`/`valores_originais`/`justificativa`/`usuario_id`) e deve ser reutilizada por qualquer regra futura — financeiro, acadêmico, regulatório.

**How to apply:**
- Quando perguntarem "o que falta no motor XML?" — só o #F (PDF/A base64).
- Quando implementar nova regra de negócio que pode bloquear ação do usuário: NUNCA bloquear em definitivo. Sempre permitir override com justificativa ≥10 chars (CHECK constraint no banco), registrar em `validacao_overrides`, e usar o padrão de 422 estruturado + Modal React (ver `ModalOverrideRegra.tsx` como referência).
- Para novas regras do motor: adicionar em `src/lib/xml/validation/regras-negocio.ts` no enum `REGRAS_NEGOCIO`, expandir `avaliarRegrasNegocio()`, passar `regrasIgnoradas` via `MontarDadosDiploma.options.pular_regras_negocio`.
- Padrão `tabela_dedicada ?? fallback_planos` (do #G) é o template para qualquer migração gradual de campos planos → tabela normalizada — cursos legados continuam funcionando até serem migrados explicitamente.
- Ciclo circular em validações module-level: usar `dynamic await import()` dentro da função (não no topo do arquivo).
