---
name: fetchSeguro obrigatório em mutações
description: Toda chamada de mutação frontend (POST/PUT/PATCH/DELETE) deve usar fetchSeguro, nunca fetch nativo — CSRF bloqueará silenciosamente
type: feedback
---

Toda chamada de mutação no frontend (POST, PUT, PATCH, DELETE) DEVE usar `fetchSeguro` de `@/lib/security/fetch-seguro`, nunca o `fetch()` nativo do JavaScript.

**Why:** O `fetch()` nativo não envia o header `x-csrf-token`. Quando o cookie `fic-csrf-token` existe (qualquer sessão autenticada), `validarCSRF()` bloqueia a requisição com 403. O erro ainda fica mascarado porque a resposta retorna `{ erro: '...' }` mas o frontend lê `data.error` — resultado: mensagem genérica sem pista da causa real. Descoberto na sessão 081 ao investigar "Erro ao excluir diploma".

**How to apply:** Ao escrever ou revisar qualquer página React com chamadas de API:
1. Verificar se `fetchSeguro` está importado: `import { fetchSeguro } from "@/lib/security/fetch-seguro"`
2. Substituir `fetch(url, { method: "POST/PUT/PATCH/DELETE", ... })` por `fetchSeguro(url, { ... })`
3. GETs podem continuar com `fetch()` nativo (CSRF só bloqueia métodos de mutação)
