---
name: Sessão 031 — Fix timeout Tela 2 (paralelização 4x Railway)
description: Sessão 031 — Fix timeout Tela 2 (paralelização 4x Railway)
type: project
project: erp
tags: ["railway", "performance", "timeout", "sessao-031"]
success_score: 0.85
supabase_id: 48dcc11b-529f-417a-9d70-bf100aad5558
created_at: 2026-04-13 09:22:44.860063+00
updated_at: 2026-04-13 17:05:55.242904+00
---

Commit e0acf69, deploy READY 97s (09/04/2026). Bug: Kauana 16 docs ficou 583s em processando. Causa: loop sequencial 16×25s=400s > TIMEOUT_MS 300s. Fix Railway: executarComLimite() inline (sem dep nova) roda 4 arquivos em paralelo (EXTRACAO_CONCORRENCIA env). Ganho: 400s→100s. Fix Next.js: TIMEOUT_MS 5→7min. Por que não p-limit: v5+ ESM-only incompatível com require(). How to apply: subir EXTRACAO_CONCORRENCIA se extração ficar lenta. Limiter genérico reusável em outros loops pesados.
