# Sessão 13 — pricing-ai v30: City-strict filtering (fix comparáveis da cidade errada)

- **Problema persistente da v29**: Apify actors IGNORAM filtro de cidade, retornam dados do estado inteiro
  - Teste com Santo André/SP: 145 listings totais, apenas 1 de Santo André, 84 de São Paulo
  - Tier system da v29 exigia >= 3 matches → caía para tier "estado" → 10 comparáveis de SP capital
  - Tx filter funcionava (31 removidos), mas city filter era ineficaz
- **Root cause confirmado**: Actors Apify retornam dados state-wide independente dos parâmetros de cidade (URL, slug, structured)
- **Solução v30 — city-strict post-processing**:
  - **Tier threshold 3 → 1**: Aceitar até 1 listing da cidade correta (melhor 1 certo que 10 errados)
  - **City-prioritized comparable selection**: city matches primeiro, depois metro, depois state
  - **Sample size confidence penalty**: 1 comp = -20, 2 = -15, 3-5 = -5, 6+ = 0
  - **State tier penalty**: -30 (antes era -10) — desencorajar uso de dados state-wide
  - **maxResults 80 → 150**: Mais dados scraped = mais chance de incluir cidade-alvo
  - **Geo stats**: Transparência no response (city/metro/state counts)
- **Deploy**: v30 deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 30)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (~1100 linhas)
