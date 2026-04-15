# Sessão 14 — pricing-ai v31: Single actor (VivaReal only)

- **Problema da v30**: Mesmo com city-strict filtering, actors OLX e ZapImóveis continuavam poluindo dados
  - ZapImóveis: SEMPRE retornava 0 resultados (params incompatíveis com actor)
  - OLX/QuintoAndar: IGNORA parâmetros de cidade completamente, retorna dados state-wide (84 de SP capital vs 1 de Santo André)
  - Post-processing não resolvia: dados misturados de cidades diferentes distorciam estatísticas
- **Decisão do Marcelo**: Remover actors secundários, manter apenas VivaReal (único confiável)
- **Solução v31 — simplificação**:
  - **Removido**: `ACTOR_ZAPIMOVEIS` (`avorio~zap-imoveis-scraper`)
  - **Removido**: `ACTOR_MULTI_OLX_QA` (`viralanalyzer~brazil-real-estate-scraper`)
  - **Mantido**: `ACTOR_VIVAREAL` (`f1xSvpkpklEh2EhGJ`) — único actor, URL-based input
  - **Removido**: `Promise.allSettled()` paralelo → chamada direta simples
  - **Removido**: Round-robin multi-plataforma na seleção de comparáveis
  - **Simplificado**: Seleção de comparáveis (city > metro > state, sem balanceamento por fonte)
  - **Preservado**: Todo o post-processing (city filter, tier system, tx type filter, stats, auto-persist, confidence)
- **Deploy**: v31 deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 32)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (~1007 linhas, redução de ~100 linhas)
