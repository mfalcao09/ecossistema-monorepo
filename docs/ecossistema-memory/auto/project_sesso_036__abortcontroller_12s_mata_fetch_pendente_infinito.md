---
name: Sessão 036 — AbortController 12s mata fetch pendente infinito
description: Sessão 036 — AbortController 12s mata fetch pendente infinito
type: project
project: erp
tags: ["abortcontroller", "polling", "cold-start", "sessao-036"]
success_score: 0.92
supabase_id: 74373702-85bd-4edd-93aa-1797925b19c0
created_at: 2026-04-13 09:23:25.175709+00
updated_at: 2026-04-13 17:06:01.728623+00
---

Commit 6ed2db6, deploy dpl_e7CY READY 77s (09/04/2026). Bug: mesmo após lite/heavy, Tela 2 ficou 9min em "Carregando". Smoking gun: zero polls entre 21:47:14 e 21:58:09 — tick() nunca foi agendado. Causa: fetch() sem AbortController → cold start retornou 504 server-side mas browser nunca soube → fetch ficou pending infinito → .then() nunca disparou → setTimeout(tick) nunca agendou → loader eterno. Fix: AbortController 12s por tentativa em fetchSessao. Abort → DOMException → catch → backoff → retry. Padrão: toda chamada fetch em polling deve ter AbortController. Como detectar AbortError: DOMException name="AbortError" || /abort/i.test(msg).
