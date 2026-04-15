---
name: AI SDK Google retorna texto vazio — usar REST direto para Gemini
description: AI SDK Google retorna texto vazio — usar REST direto para Gemini
type: feedback
project: erp
tags: ["gemini", "ai-sdk", "bug", "rest"]
success_score: 0.9
supabase_id: 9bd93300-8fb9-4bbe-a890-cc3bf23a3bf2
created_at: 2026-04-13 09:14:17.519968+00
updated_at: 2026-04-13 11:04:57.385503+00
---

NUNCA usar generateText do Vercel AI SDK com @ai-sdk/google para o modelo gemini-2.5-flash. Retorna texto vazio silenciosamente. Incompatibilidade entre ai@4.1 e @ai-sdk/google@^3.0.53. Para google_genai, usar chamada REST direta: fetch(https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}, { method: POST, headers: { Content-Type: application/json }, body: JSON.stringify({ systemInstruction, contents, generationConfig })}). Para outros providers (OpenRouter, Anthropic), o AI SDK com @ai-sdk/openai funciona normalmente.
