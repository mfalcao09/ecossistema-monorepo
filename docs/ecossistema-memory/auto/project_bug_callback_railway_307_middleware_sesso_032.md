---
name: Bug callback Railway 307 middleware (sessão 032)
description: Bug callback Railway 307 middleware (sessão 032)
type: project
project: erp
tags: ["middleware", "callback", "s2s", "sessao-032"]
success_score: 0.9
supabase_id: f13acde0-c221-4316-b86f-acf57f056f49
created_at: 2026-04-13 09:22:44.860063+00
updated_at: 2026-04-13 17:05:54.296948+00
---

Commit 6735f4b, deploy dpl_Ajwk READY (09/04/2026). Sintoma: Tela 2 processando após retest Kauana 16 docs. Causa: PUT /api/extracao/sessoes/{id}/callback batia em domínio diploma.* → middleware 307-redirecionava (rota não no whitelist PORTAL_DOMAINS). Railway não reenvia body em redirect → callback nunca chegou. Fix: early return no topo do middleware para regex /api/extracao/sessoes/[^/]+/callback. Segurança preservada: handler valida EXTRACAO_CALLBACK_SECRET + nonce 1-uso. How to apply: toda rota callback S2S (HMAC+nonce) deve ser bypassada no middleware ANTES de qualquer domain/auth check.
