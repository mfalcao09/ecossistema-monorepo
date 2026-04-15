---
name: Zod nullable vs optional
description: Zod .optional() aceita undefined mas NÃO null — usar .nullable().optional() para campos que o frontend envia como null
type: feedback
---

Zod `.optional()` aceita `undefined` mas rejeita `null`. Campos de formulário que o frontend envia como `null` precisam de `.nullable().optional()`.

**Why:** Frontend envia campos vazios como `null` (padrão JS). Sem `.nullable()`, Zod retorna 400 silenciosamente.

**How to apply:** Em TODOS os schemas Zod que recebem dados do frontend, campos opcionais devem usar `.nullable().optional()`, nunca apenas `.optional()`.
