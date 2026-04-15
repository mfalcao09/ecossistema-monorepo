---
name: Rodar next build (não só tsc) antes de push com commits de sessão paralela
description: Rodar next build (não só tsc) antes de push com commits de sessão paralela
type: feedback
project: erp
tags: ["nextjs", "build", "typescript", "sessao-paralela"]
success_score: 0.9
supabase_id: f2bdf181-e7cf-4b20-a865-db5c94c399e3
created_at: 2026-04-13 09:15:25.002792+00
updated_at: 2026-04-13 12:05:10.565199+00
---

Quando origin/main contém commits novos de sessão paralela, rodar next build completo (não só tsc --noEmit) no clone /tmp antes de commitar e fazer push. tsc sozinho não pega dependências faltantes quando há skip libs — só o build completo do Next pega. Em 07/04/2026 commit 0c25a58 introduziu import de fast-xml-parser sem adicionar ao package.json — deploy ERROR herdado pelo commit seguinte. Sempre que git log origin/main mostrar commits recentes que eu não fiz, rodar npm install && npx next build antes de commitar por cima.
