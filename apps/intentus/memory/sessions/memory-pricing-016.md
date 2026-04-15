# Sessão 16 — Fix endpoint Apify na pricing-ai (v33→v34)

- **Problema**: Marcelo reportou erro "Failed to send a request to the Edge Function" ao clicar "Precificação IA" na aba Renovações
- **Diagnóstico**: Supabase logs mostraram v33 retornando HTTP 500 em ~1.7s (falha rápida = erro de execução, não timeout)
- **Root cause**: Endpoint Apify errado na v24r reconstruída
  - **Errado** (v33): `POST https://api.apify.com/v2/actor-runs` com `{ actorId, input: {...} }` no body
  - **Correto** (v34): `POST https://api.apify.com/v2/acts/${ACTOR_VIVAREAL}/runs` com input direto no body (sem wrapper `actorId`)
  - O endpoint errado retornava erro Apify → `runData?.id` undefined → throw Error → 500
- **Fix aplicado**: Linha ~495 de `supabase/functions/pricing-ai/index.ts` — endpoint e body format corrigidos
- **Deploy**: v34 deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 34)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (header com changelog v24r-fix)
