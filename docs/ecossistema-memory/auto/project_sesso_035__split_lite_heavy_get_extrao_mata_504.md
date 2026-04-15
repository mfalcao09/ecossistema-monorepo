---
name: Sessão 035 — Split lite/heavy GET extração (mata 504)
description: Sessão 035 — Split lite/heavy GET extração (mata 504)
type: project
project: erp
tags: ["performance", "504", "api", "sessao-035"]
success_score: 0.92
supabase_id: 20c64511-08b5-4073-92bb-dff79b5fa2d6
created_at: 2026-04-13 09:23:25.175709+00
updated_at: 2026-04-13 17:05:58.90722+00
---

Commit 1869807, deploy dpl_E8yR READY 78s (09/04/2026). Causa raiz dos "Failed to fetch" era 504 no handler GET devolvendo JSONB pesado a cada poll. Dados_extraidos com vários MB → Vercel edge estourava em cold start. Fix: SELECT_LITE (12 colunas leves, <500B, durante processando) vs SELECT_HEAVY (5 colunas JSONB + arquivos, só status final, roda UMA vez). Resultados: polling durante loading ~500B vs vários MB. Padrão generalizável: toda rota polling com JSONB deve separar metadata(lite) vs payload(heavy). _lite:true marca response explicitamente. How to apply: futuras rotas /api/*/status devem seguir este padrão.
