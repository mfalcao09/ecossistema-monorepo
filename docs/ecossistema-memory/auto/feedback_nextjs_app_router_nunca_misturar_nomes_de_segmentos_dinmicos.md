---
name: Next.js App Router: NUNCA misturar nomes de segmentos dinâmicos no mesmo nível
description: Next.js App Router: NUNCA misturar nomes de segmentos dinâmicos no mesmo nível
type: feedback
project: erp
tags: ["nextjs", "approuter", "routing", "bug"]
success_score: 0.95
supabase_id: c2810fda-6328-444f-bb26-7d13d28b236b
created_at: 2026-04-13 09:16:28.130214+00
updated_at: 2026-04-13 13:05:17.771821+00
---

NUNCA criar diretórios dinâmicos com nomes diferentes no mesmo nível do App Router (ex: [id]/ e [sessaoId]/ sob o mesmo pai). O build do Next.js NÃO detecta o conflito — compila silenciosamente. Em runtime, o router falha com "Unhandled Rejection" em 100% das invocações para QUALQUER rota naquele nível. Sessão 039 — 8 sessões consecutivas de debugging (031-038) sem resolver, causa era [id]/ e [sessaoId]/ coexistindo sob /api/extracao/sessoes/. Sintoma: zero logs da aplicação + 504/503 em todas as invocações + edge-middleware logando status=200.
