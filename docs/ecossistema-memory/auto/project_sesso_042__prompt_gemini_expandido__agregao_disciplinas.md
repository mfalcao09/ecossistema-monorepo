---
name: Sessão 042 — Prompt Gemini expandido + agregação disciplinas
description: Sessão 042 — Prompt Gemini expandido + agregação disciplinas
type: project
project: erp
tags: ["gemini", "prompt", "extracao", "sessao-042"]
success_score: 0.88
supabase_id: cbfd429c-1628-445e-a020-e51ac7a3b644
created_at: 2026-04-13 09:24:10.156184+00
updated_at: 2026-04-13 18:06:05.2652+00
---

Commit 9117ded (10/04/2026). Causa: prompt pedia apenas 8 campos, maxOutputTokens 4096 insuficiente. Fix prompt: +10 campos diplomado (rg, sexo, genitores etc); +codigo_emec, titulo_conferido; novas seções enade e disciplinas array; dicas por tipo doc; maxOutputTokens 4096→16384. Fix agregação: agregarDados mergeia 5 chaves (diplomado/curso/ies/enade/disciplinas); disciplinas acumula todos docs com dedup por nome normalizado; genitores dedup por nome; comprobatorios_detectados lista tipos com confiança. Arquivos: extractor.js + server.js no Railway. Why: campos vazios mesmo com documentos corretos.
