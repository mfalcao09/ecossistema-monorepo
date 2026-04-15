---
name: Sessão 037 — fix HTTP 400 "callback_url obrigatório" (DB Write Direto Etapa 2)
description: Sessão 037 — fix HTTP 400 "callback_url obrigatório" (DB Write Direto Etapa 2)
type: project
project: erp
tags: ["railway", "callback", "bug", "extração", "sessão-037"]
success_score: 0.85
supabase_id: 563cffee-c029-4d41-881d-4a1482068561
created_at: 2026-04-14 09:14:35.295761+00
updated_at: 2026-04-14 10:07:28.047268+00
---

Sessão 037 (09/04/2026): fix definitivo do HTTP 400 "callback_url obrigatório" que bloqueava TODA requisição à Tela 2 de extração.

**Causa raiz:**
A sessão 033 (DB Write Direto) removeu `callback_url` do `railwayPayload` no Next.js MAS nunca atualizou `services/document-converter/src/server.js`. Ele continuava exigindo `callback_url` na validação do POST (linha 367-368).

Resultado: TODA requisição caía no 400 "callback_url obrigatório" — a UI mostrava `Microserviço de extração rejeitou a requisição (HTTP 400)` (reembrulhado em 502).

**Fix:** Atualizar server.js Railway para remover validação de callback_url e usar DB Write Direto no lugar do callback HTTP. Commit 71edf7c completa o refatoramento no lado Railway.
