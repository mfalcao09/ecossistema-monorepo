---
name: Zod .optional() não aceita null — usar .nullable().optional()
description: Zod .optional() não aceita null — usar .nullable().optional()
type: feedback
project: erp
tags: ["zod", "typescript", "validacao", "null"]
success_score: 0.9
supabase_id: ec3b77f5-6716-46ec-adea-b9c776aa3036
created_at: 2026-04-13 09:15:25.002792+00
updated_at: 2026-04-13 12:05:12.459429+00
---

Zod .optional() aceita undefined mas rejeita null. Campos de formulário que o frontend envia como null precisam de .nullable().optional(). Frontend envia campos vazios como null (padrão JS). Sem .nullable(), Zod retorna 400 silenciosamente. Em TODOS os schemas Zod que recebem dados do frontend, campos opcionais devem usar .nullable().optional(), nunca apenas .optional().
