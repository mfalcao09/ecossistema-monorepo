---
name: Bug callback Railway 307 middleware (sessão 032, 09/04/2026)
description: Middleware do Next.js estava 307-redirecionando o callback do document-converter quando batia no domínio portal (diploma.*), porque a rota não estava no whitelist de PORTAL_DOMAINS. PUT + 307 = body perdido. Fix aplicado em commit 6735f4b.
type: project
---

Sintoma: Marcelo re-testou Kauana (16 docs), upload OK, mas Tela 2 ficou em "processando" e form abriu vazio. Sessão `92594dc2-f4b0-46aa-ab59-e5187672800f` com `dados_extraidos={}`.

Causa raiz (diagnosticada via Vercel runtime logs):
- 13:33:34 POST /api/extracao/iniciar → 202 OK (sessão criada, Railway disparado)
- 13:34:42/45/49 PUT /api/extracao/sessoes/92594dc2.../callback?nonce=... → **307 Temporary Redirect** (3 retries do Railway, todos falharam)
- Railway não re-envia body em redirect → callback nunca chegou ao handler.

Por quê: `obterBaseUrlPublica()` lê `NEXT_PUBLIC_APP_URL` que em produção aponta para `https://diploma.ficcassilandia.com.br` (portal público). O middleware, ao detectar `isPortalDomain(host)`, só libera um whitelist curto (`/api/portal`, `/api/public`, `/api/documentos/verificar`, `/api/diplomas/`, `/verificar`, `/rvdd`, `/`, `/_next`, `/favicon`). Qualquer outra rota cai em `NextResponse.redirect(new URL('/', request.url))` → 307.

Fix (commit `6735f4b`, deploy `dpl_AjwkGzn9tFEi4ZBWq8ddKgYdw966` READY às 09/04/2026):
```ts
// No topo do middleware, ANTES de qualquer outra checagem
if (/^\/api\/extracao\/sessoes\/[^/]+\/callback\/?$/.test(pathname)) {
  return NextResponse.next()
}
```

Segurança preservada — o handler PUT ainda valida `EXTRACAO_CALLBACK_SECRET` via `timingSafeEqual` + nonce 1-uso via `UPDATE ... WHERE callback_nonce_used_at IS NULL` (replay protection).

**Why:** sessão órfã silenciosa é o pior tipo de bug — secretária vê "processando" eterno, não tem como saber que o S2S quebrou no middleware de domínio. Forma hostil pro operador final.

**How to apply:** toda rota de callback S2S (HMAC + nonce) deve ser explicitamente bypassada no middleware logo no início, antes de qualquer domain/auth check. Se no futuro houver mais callbacks (BRy, UFMS), replicar o mesmo padrão de early return. Alternativa mais robusta: adicionar `EXTRACAO_CALLBACK_BASE_URL` como env explícita apontando pra `gestao.*`, para não depender de `NEXT_PUBLIC_APP_URL`.

Sessão órfã 92594dc2 foi marcada manualmente como `erro` via SQL UPDATE para destravar a Kauana — ela pode retestar agora.
