---
name: Sempre parsear body de erro da API — nunca jogar erro genérico
description: Sempre parsear body de erro da API — nunca jogar erro genérico
type: feedback
project: erp
tags: ["api", "erros", "frontend", "ux"]
success_score: 0.85
supabase_id: d657fbc7-6b45-4f63-9aa7-0da6eaafcf83
created_at: 2026-04-13 09:15:25.002792+00
updated_at: 2026-04-13 12:05:08.746019+00
---

Nunca fazer if (!res.ok) throw new Error("Erro genérico"). Sempre ler o body da resposta para mostrar a causa real. Erro genérico esconde a causa real (ex: Zod validation, constraint DB). Em todo fetch() de API, se !res.ok, fazer: const errBody = await res.json().catch(() => ({})) e incluir errBody.error ou errBody.detalhes na mensagem exibida.
