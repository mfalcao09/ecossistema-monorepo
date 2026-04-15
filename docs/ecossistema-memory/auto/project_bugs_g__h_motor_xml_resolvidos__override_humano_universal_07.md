---
name: Bugs #G + #H motor XML resolvidos — override humano universal (07/04/2026)
description: Bugs #G + #H motor XML resolvidos — override humano universal (07/04/2026)
type: project
project: erp
tags: ["motor-xml", "bug-g", "bug-h", "override-humano", "validacao"]
success_score: 0.9
supabase_id: ff601543-3855-4109-aa99-f6d012880d53
created_at: 2026-04-13 09:19:20.356428+00
updated_at: 2026-04-13 16:05:46.000282+00
---

Commit 2518ed3, deploy dpl_7mgBX54PMUEczE3JsPxUzP3fJQzJ READY. Status: 11/12 bugs resolvidos (~92%). Único pendente: #F (Documento PDF/A base64). Bug #H elevou o princípio do override humano a regra arquitetural universal: tabela validacao_overrides genérica (entidade_tipo/entidade_id/regra_codigo/valores_originais/justificativa/usuario_id) reutilizável por qualquer regra futura. Para novas regras: adicionar em src/lib/xml/validation/regras-negocio.ts no enum REGRAS_NEGOCIO. Ciclo circular em validações module-level: usar dynamic await import() dentro da função.
