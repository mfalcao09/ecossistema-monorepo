---
name: fetchSeguro obrigatório em mutações frontend
description: fetchSeguro obrigatório em mutações frontend
type: feedback
project: erp
tags: ["csrf", "frontend", "seguranca"]
success_score: 0.9
supabase_id: f27f2674-20d6-4c88-8d0c-87e0ded30fec
created_at: 2026-04-13 09:13:28.773921+00
updated_at: 2026-04-13 10:04:48.924129+00
---

Toda chamada de mutação no frontend (POST, PUT, PATCH, DELETE) DEVE usar fetchSeguro de @/lib/security/fetch-seguro, nunca o fetch() nativo. O fetch() nativo não envia o header x-csrf-token. Quando o cookie fic-csrf-token existe (qualquer sessão autenticada), validarCSRF() bloqueia a requisição com 403. Por que: o erro fica mascarado porque a resposta retorna { erro: ... } mas o frontend lê data.error. Ao escrever ou revisar qualquer página React com chamadas de API: verificar se fetchSeguro está importado, substituir fetch(url, { method: POST/PUT/PATCH/DELETE... }) por fetchSeguro(url, {...}). GETs podem continuar com fetch() nativo.
