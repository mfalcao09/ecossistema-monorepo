---
name: Toda rota API precisa skipCSRF: true no protegerRota
description: Toda rota API precisa skipCSRF: true no protegerRota
type: feedback
project: erp
tags: ["api", "csrf", "rota", "protegerrota"]
success_score: 0.9
supabase_id: c4dd1c46-1fe8-450c-ae9a-637c9ac8c967
created_at: 2026-04-13 09:14:36.740071+00
updated_at: 2026-04-13 11:05:01.801596+00
---

Toda rota API que usa protegerRota() DEVE incluir { skipCSRF: true } como segundo parâmetro para métodos de mutação. Sem isso, o middleware bloqueia com 403 "Token de segurança ausente". O frontend não envia tokens CSRF (não usa fetchSeguro). Todas as ~30+ rotas existentes usam skipCSRF: true. Ao criar qualquer nova rota API, SEMPRE adicionar { skipCSRF: true } no protegerRota: export const POST = protegerRota(async (request, { userId }) => { ... }, { skipCSRF: true })
