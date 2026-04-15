---
name: Sessão 037b — AbortController calibrado 12→35s
description: Sessão 037b — AbortController calibrado 12→35s
type: project
project: erp
tags: ["abortcontroller", "timeout", "sessao-037"]
success_score: 0.88
supabase_id: da6c745a-8dc0-483d-b5c9-cb0772e02f89
created_at: 2026-04-13 09:23:25.175709+00
updated_at: 2026-04-13 17:06:00.781452+00
---

Commit 13fb0ea (09/04/2026). Bug segunda camada: AbortController 12s abortava fetch do GET heavy (cold start + payload vários MB leva 15-25s) antes do server responder. Todas 9 tentativas (3 retries × 3 grace period) abortavam cedo. Fix: FETCH_TIMEOUT_MS 12→35s; backoff 500ms→500/1.5s/3s; AbortError → mensagem PT amigável em vez de DOMException raw. Meta-lição: AbortController é pra matar pending INFINITO, não timeout agressivo de perf. SEMPRE calibrar FETCH_TIMEOUT_MS > route.maxDuration. Nunca mostrar DOMException raw ao usuário.
