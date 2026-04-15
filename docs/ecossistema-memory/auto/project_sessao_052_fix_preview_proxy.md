---
name: Sessão 052 — Fix preview PDF proxy server-side
description: Fix preview PDF/imagem nos dialogs de comprobatórios — proxy `/api/storage-proxy` substituiu blob URL (CORS) e embed (CSP). Commit 6c06897.
type: project
---

Sessão 052 (11/04/2026): PDFs e imagens não exibiam nos dialogs de conferência de comprobatórios.

**Causa raiz:** (1) `fetch()` cross-origin para Supabase Storage falhava com CORS → blob URL null; (2) `<embed>` bloqueado por CSP `object-src: 'none'`.

**Solução:** Criou `/api/storage-proxy/route.ts` (espelhando `/api/portal/rvdd-proxy` do portal público). Atualizou `DialogVisualizarDocumento.tsx` (blob→proxy) e `SelecaoComprobatorios.tsx` (`embed`→`iframe` via proxy).

**Why:** Supabase Storage retorna X-Frame-Options e CSP restritivos; fetch cross-origin falha com CORS. Proxy server-side elimina ambos os problemas.

**How to apply:** Sempre usar `/api/storage-proxy?url=...` para exibir arquivos do Supabase Storage em iframes/img. Nunca fetch cross-origin no client para embed/iframe.

Commit `6c06897`, push para origin/main. Deploy Vercel auto.
