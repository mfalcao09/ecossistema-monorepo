---
name: Sessão 037 — fix HTTP 400 "callback_url obrigatório" (DB Write Direto Etapa 2)
description: Fix do bug 400 que matava toda Tela 2 — server.js Railway exigia callback_url que Next.js não envia mais após sessão 033. Commit 71edf7c completa o refatoramento DB Write Direto no lado Railway.
type: project
---

Sessão 037 (09/04/2026): fix definitivo do HTTP 400 "callback_url obrigatório" que bloqueava TODA requisição à Tela 2 de extração.

**Causa raiz:**
A sessão 033 (commit 3bccb3c "DB Write Direto") fez duas coisas no lado Next.js:
1. Criou `services/document-converter/src/supabase-writer.js` com `escreverResultadoSessao` + `escreverErroSessao`
2. Removeu `callback_url` do `railwayPayload` em `/api/extracao/iniciar/route.ts`

Mas NUNCA atualizou `services/document-converter/src/server.js`. Ele continuou:
- Exigindo `callback_url` na validação do POST (linha 367-368: `return res.status(400).json({ error: 'callback_url obrigatório' })`)
- Passando `callbackUrl` para `processarExtracao`
- Chamando `enviarCallback` via HTTP PUT no Next.js ao final

Resultado: TODA requisição caía no primeiro 400 porque o Next.js parou de enviar o campo. A mensagem na UI era `Microserviço de extração rejeitou a requisição (HTTP 400)` (o Next.js reembrulha em 502).

**Diagnóstico:**
- `SELECT erro_mensagem FROM extracao_sessoes WHERE status='erro' ORDER BY iniciado_em DESC LIMIT 1` → `Railway 400: {"error":"callback_url obrigatório"}`
- `git show origin/main:services/document-converter/src/server.js | grep -n "callback_url\|enviarCallback"` → confirmou que server.js ainda usa callback HTTP
- `git show origin/main:src/app/api/extracao/iniciar/route.ts` → confirmou que railwayPayload NÃO inclui callback_url
- `ls-tree origin/main:services/document-converter/src` → supabase-writer.js existe mas nunca é importado em server.js

**Fix (commit 71edf7c):**
Completa o refatoramento DB Write Direto no lado Railway:
- Importa `escreverResultadoSessao` + `escreverErroSessao` de supabase-writer
- Remove `callback_url` do destructuring + todas as validações correlatas
- Remove `CALLBACK_ALLOWED_HOSTS`, `isCallbackUrlAllowed`, `enviarCallback`, `CALLBACK_TIMEOUT_MS`, `EXTRACAO_CALLBACK_SECRET` (no runtime)
- `processarExtracao` agora grava direto no DB: todos falharam → `escreverErroSessao`; normal/parcial → `escreverResultadoSessao`
- Catch do background também tenta `escreverErroSessao` como último recurso
- Startup log reporta `SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY` em vez do callback secret

**Why:** Fim do canal HTTP Railway → Next.js. Elimina o ciclo de bugs que arrastou 5 sessões (032 middleware 307, 034 timeout, 035 504 lite/heavy, 036 AbortController, 037 contrato dessincronizado).

**How to apply:** Quando um refatoramento cruzar serviços (Next.js ↔ Railway), SEMPRE auditar AMBOS os lados antes de declarar concluído. Grep por símbolos antigos no serviço receptor é obrigatório. Neste caso, `grep "callback_url" services/document-converter/` teria flagrado o gap na sessão 033.
