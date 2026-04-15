---
name: Sempre ler body de erro da API
description: Frontend deve SEMPRE parsear res.json() em erros HTTP, não jogar erro genérico
type: feedback
---

Nunca fazer `if (!res.ok) throw new Error("Erro genérico")`. Sempre ler o body da resposta para mostrar a causa real.

**Why:** Erro genérico esconde a causa real (ex: Zod validation, constraint DB). Marcelo gastou tempo desnecessário debugando porque a mensagem real estava oculta.

**How to apply:** Em todo `fetch()` de API, se `!res.ok`, fazer `const errBody = await res.json().catch(() => ({}))` e incluir `errBody.error` ou `errBody.detalhes` na mensagem exibida.
