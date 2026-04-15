---
name: Etapa 1.1 Sprint 2 — rota /extrair-documentos no Railway
description: Etapa 1.1 Sprint 2 — rota /extrair-documentos no Railway
type: project
project: erp
tags: ["railway", "gemini", "extracao", "sessao-029"]
success_score: 0.9
supabase_id: 0890ecfc-89cf-4700-88a4-93491cc96b50
created_at: 2026-04-13 09:22:03.410397+00
updated_at: 2026-04-13 16:05:49.84355+00
---

Commit 5c6bf66 (08/04/2026, sessão 029). POST /extrair-documentos no converter-service Railway com Gemini 2.5 Flash fire-and-forget + SSRF guards. Arquivos: extractor.js (195 linhas, wrapper REST Gemini sem SDK por bug ai-sdk/google) + server.js (rota 202 Accepted, processarExtracao background, agregarDados first-non-empty-wins, enviarCallback retry 3x backoff). Hardening Buchecha: SSRF allowlist HTTPS *.supabase.co/storage/ + gestao.*/diploma.*/vercel.app configurável; timeouts AbortController 30s/60s/15s; erro_parcial para falhas parciais. Verificação: /health 200, /extrair-documentos sem key → 401. Why: bypass timeout 60s Vercel via fire-and-forget + callback HMAC. How to apply: próximas etapas consomem este endpoint; EXTRACAO_CALLBACK_SECRET já em Vercel + Railway.
