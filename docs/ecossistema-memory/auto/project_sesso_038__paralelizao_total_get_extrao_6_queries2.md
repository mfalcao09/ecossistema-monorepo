---
name: Sessão 038 — Paralelização total GET extração (6 queries→2)
description: Sessão 038 — Paralelização total GET extração (6 queries→2)
type: project
project: erp
tags: ["performance", "paralelizacao", "queries", "sessao-038"]
success_score: 0.9
supabase_id: 1a9707bf-42a5-4aaa-9488-ae70e675a3e9
created_at: 2026-04-13 09:23:25.175709+00
updated_at: 2026-04-13 17:05:59.852896+00
---

Commit 2bcfb8c, deploy dpl_AqVU READY (09/04/2026). Após fix 037b, Tela 2 ainda travava. Causa: 6 queries sequenciais (middleware getSession + verificarAuth getUser + getTenantId + SELECT_LITE + SELECT_HEAVY + processo_arquivos) = 3-25s worst case excedendo maxDuration=30s. Fix: bypass verificarAuth (usa só getUser() — não precisa tenantId); merge SELECT_LITE + SELECT_HEAVY em SELECT_ALL; Promise.all([SELECT_ALL, SELECT_processo_arquivos]) em paralelo. De 6 sequenciais → 2 passos (1 auth + 1 batch). Segurança: RLS filtra por usuario_id + .eq() explícito. callback_nonce NUNCA exposto. How to apply: rotas sem tenantId devem bypassar verificarAuth e paralelizar queries independentes.
