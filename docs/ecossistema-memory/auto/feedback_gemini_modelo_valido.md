---
name: Modelo Gemini válido em abr/2026
description: gemini-2.5-flash é o modelo correto em abril 2026; gemini-3.1-pro-preview e gemini-2.0-flash estão descontinuados
type: feedback
---

Modelo Gemini correto para uso em abril de 2026: **`gemini-2.5-flash`**

**Por que:** `gemini-3.1-pro-preview` nunca existiu (Marcelo usou por engano). `gemini-2.0-flash` foi descontinuado para novos usuários. Ambos causavam resposta vazia ou erro 404 na API.

**How to apply:** Sempre que criar entrada em `ia_configuracoes` ou configurar chamadas ao Google AI, usar `gemini-2.5-flash`. Validar nome do modelo antes de inserir no banco testando com uma chamada simples.

**Sinal de modelo inválido:** HTTP 200 mas `candidate?.content = null` → `text = ""` → parse JSON falha → fallback ativado silenciosamente.
