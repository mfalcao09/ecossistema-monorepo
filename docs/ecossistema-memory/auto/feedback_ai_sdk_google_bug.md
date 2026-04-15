---
name: AI SDK Google retorna texto vazio — usar REST direto
description: Vercel AI SDK (ai@4.1 + @ai-sdk/google@3.x) retorna texto vazio com Gemini. Usar fetch direto à API REST do Google AI.
type: feedback
---

NUNCA usar `generateText` do Vercel AI SDK com `@ai-sdk/google` para o modelo gemini-2.5-flash. Retorna texto vazio silenciosamente.

**Why:** Incompatibilidade entre `ai@4.1` (sem caret) e `@ai-sdk/google@^3.0.53`. O SDK cria o modelo como LanguageModelV3, mas o generateText espera V1. Em runtime, a chamada "funciona" mas retorna string vazia.

**How to apply:** Para google_genai, usar chamada REST direta:
```
fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ systemInstruction, contents, generationConfig })
})
```
Para outros providers (OpenRouter, Anthropic), o AI SDK com `@ai-sdk/openai` funciona normalmente.
