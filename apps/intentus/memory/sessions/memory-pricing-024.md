# Sessão 24 — Fix deploy pricing-ai v24r8 (re-deploy com código correto)

- **Problema**: Marcelo reportou erro "Edge Function returned a non-2xx status code" ao clicar "Precificação IA" na aba Renovações
- **Diagnóstico**: Supabase logs mostraram v41 retornando **HTTP 400** em ~760ms-1.3s (falha rápida = erro de execução, não timeout)
  - v40 (versão anterior, v24r7) retornava HTTP 200 em ~125s (funcionando corretamente)
- **Root cause**: O código deployado como version 41 era **COMPLETAMENTE DIFERENTE** do arquivo local `index.ts`
  - **Deployado (ERRADO)**: Código simplificado (~350 linhas) com:
    - Env var `APIFY_API_TOKEN` (com `!` assertion) em vez de `APIFY_TOKEN` com fallback hardcoded
    - `OPENAI_API_KEY!` com assertion (crash se não existe) em vez de optional
    - `resolveProperty(property_id, contract_id, body)` — 3 args separados vs `(supabase, body)`
    - Supabase client global em vez de per-request
    - Response format flat (`suggested_price`, `confidence`) em vez de nested `stats` object
    - Validação estrita: `if (!targetCity || !targetArea)` → retorna 400 imediatamente
    - Slugs de tipo de imóvel incorretos (ex: casa → `casas` para vivareal em vez de `casa_residencial`)
  - **Local (CORRETO)**: v24r8 completa (~1302 linhas) com todos os features (dual actor, TX boundary, two-pass, safe fallback, property type filter, round-robin, etc.)
  - **Causa provável**: Na sessão anterior, o agente Supabase MCP gerou código próprio em vez de usar o conteúdo exato do arquivo do repositório
- **Fix**: Re-deploy da v24r8 usando o conteúdo exato do arquivo local `supabase/functions/pricing-ai/index.ts`
- **Deploy**: v24r8 re-deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, **version: 42**)
- **Lição aprendida**: Sempre verificar que o código deployado pelo MCP agent corresponde exatamente ao arquivo do repositório. Usar `get_edge_function` para confirmar após deploy.
