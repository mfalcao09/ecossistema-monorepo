---
name: Remover campo do tipo TS para travar compile-time (Caminho C)
description: Remover campo do tipo TS para travar compile-time (Caminho C)
type: feedback
project: erp
tags: ["typescript", "compile-time", "refatoracao", "bug"]
success_score: 0.9
supabase_id: 65c4cde9-9a3d-4c57-8a68-a349b39455a8
created_at: 2026-04-13 09:15:25.002792+00
updated_at: 2026-04-13 12:05:09.66526+00
---

Quando um bug decorre de um campo que nunca deveria ser passado pelo chamador — porque deve ser derivado automaticamente — a melhor trava é remover o campo do tipo TS e mover a derivação para dentro do builder via helper. Validação runtime só pega o erro em produção. Remover do tipo faz o tsc/next build falhar imediatamente em qualquer caller — pega regressões em PR, não em prod. Marcelo escolheu explicitamente o "Caminho C" (refatoração completa) no Bug #E (DataExpedicaoDiploma). Manter JSDoc no local da remoção.
