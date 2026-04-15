---
name: Todas as rotas API precisam de skipCSRF
description: Padrão do projeto diploma-digital — toda rota API deve ter skipCSRF: true no protegerRota, senão POST/PATCH retornam 403
type: feedback
---

Toda rota API que usa `protegerRota()` DEVE incluir `{ skipCSRF: true }` como segundo parâmetro para métodos de mutação (POST, PATCH, PUT, DELETE). Sem isso, o middleware bloqueia com 403 "Token de segurança ausente".

**Why:** O frontend não envia tokens CSRF (não usa fetchSeguro). Todas as ~30+ rotas existentes usam skipCSRF: true. Descoberto quando upload do timbrado e save das configurações falhavam com 403.

**How to apply:** Ao criar qualquer nova rota API, SEMPRE adicionar `{ skipCSRF: true }` no protegerRota. Exemplo:
```typescript
export const POST = protegerRota(async (request, { userId }) => {
  // ...
}, { skipCSRF: true })
```
