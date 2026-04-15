---
name: Sessão 038 — paralelização total GET /api/extracao/sessoes/[id]
description: Fix definitivo dos 504 persistentes na Tela 2 — causa raiz era 6 queries sequenciais (middleware+auth+tenant+lite+heavy+arquivos) excedendo maxDuration=30s no cold start
type: project
---

**Sessão 038 (09/04/2026 — commit 2bcfb8c, deploy dpl_AqVUrQsqtCxvLZamr6UMgSBcVnB5 READY)**

**Contexto:** Após fix 037b (AbortController 12→35s), Marcelo reportou Tela 2 ainda travada — loader "Carregando sessão..." indefinido. DevTools mostrou fetch cancelado em exatos 35.00s + outra request pendente.

**Diagnóstico:**
- Vercel runtime logs: função internamente retornava status=200, mas edge retornava 504 (function timeout)
- Filtro `statusCode=504` mostrou 3 novos 504s às 23:32 MESMO APÓS deploy 037b
- Das 23:01-23:09: 35+ 504s consecutivos (tempestade de retries)
- Causa raiz NÃO era tamanho do payload (dados_extraidos = 4.7KB, arquivos 814B)
- Causa raiz: 6 queries SEQUENCIAIS acumulando latência:
  1. middleware → getSession()
  2. verificarAuth → getUser()
  3. verificarAuth → getTenantId (1-2 queries)
  4. SELECT_LITE
  5. SELECT_HEAVY (se status final)
  6. SELECT processo_arquivos
- Com cold start serverless, cada query = 200-500ms. Total = 3-6s best case, 15-25s worst case. maxDuration=30s estourava consistentemente para sessão Kauana 16 docs.

**Fix aplicado:**
1. BYPASS do `verificarAuth` genérico no GET (que faz getUser + getTenantId = 3 queries sequenciais)
2. Auth rápida: só `supabase.auth.getUser()` direto (1 query — esta rota NÃO precisa de tenantId)
3. Merge SELECT_LITE + SELECT_HEAVY em único `SELECT_ALL` (17 campos, exceto callback_nonce)
4. `Promise.all([SELECT_ALL sessão, SELECT processo_arquivos])` — 2 queries em paralelo

**Resultado:** De 6 queries sequenciais → 2 passos (1 auth + 1 batch paralelo). Latência estimada ~1-2s.

**Segurança preservada:**
- RLS da tabela já filtra por `usuario_id = auth.uid()`
- `.eq('usuario_id', userId)` explícito como defesa em profundidade
- callback_nonce e callback_nonce_used_at NUNCA expostos (anti-replay)
- PUT handler no mesmo arquivo mantém `verificarAuth` completo (precisa de tenantId eventualmente)

**Why:** 8 sessões consecutivas (031→038) atacando resiliência da Tela 2. Esta corrige a causa raiz fundamental — as anteriores tratavam sintomas (timeouts, retries, AbortController). A sequencialidade das queries era o gargalo real.

**How to apply:** Em qualquer rota API que não precisa de tenantId, bypassar verificarAuth e fazer getUser() direto. Sempre paralelizar queries independentes com Promise.all. Medir latência = contagem de round trips sequenciais × tempo médio por query (~200-500ms Supabase).
