---
name: Sessão 034 — Tela 2 polling resiliente 4 camadas + Gemini retry
description: Sessão 034 — Tela 2 polling resiliente 4 camadas + Gemini retry
type: project
project: erp
tags: ["polling", "realtime", "resiliencia", "sessao-034"]
success_score: 0.88
supabase_id: 1150f6b1-0b1b-41e2-9b7e-f63a58bcaa54
created_at: 2026-04-13 09:22:44.860063+00
updated_at: 2026-04-13 17:05:58.021343+00
---

Commits db9e00d + 1445461, deploy dpl_Cj4mW READY 79s (09/04/2026). Causa: silent error swallow + setInterval frágil. Fix: 4 camadas de resiliência: (1) Supabase Realtime WebSocket (imune throttling, <1s); (2) setTimeout encadeado com cancelado var; (3) visibilitychange força fetch ao voltar aba; (4) erroFetch banner amber visível. Follow-up: retry 3x backoff 500ms/1s para TypeError/5xx + grace period falhasConsecutivas>=3 antes de painel erro + Realtime dinâmico import() isolando bundle. Railway: retry backoff 1/2/4s para Gemini 429/500/502/503/504. How to apply: defense-in-depth stack Tela 2 — cada camada cobre modo de falha diferente.
