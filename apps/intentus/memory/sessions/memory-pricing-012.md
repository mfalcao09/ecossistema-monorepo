# Sessão 12 — pricing-ai v29: Transaction type filter + Metro area + Actor input fixes

- **6 bugs críticos identificados no v28** (testado em propriedade de Santo André/SP):
  - **Bug 1**: VivaReal retornava imóveis de VENDA em vez de LOCAÇÃO (R$107k-300k = claramente venda)
  - **Bug 2**: VivaReal retornava Piracicaba em vez de Santo André (actor ignora `locationCityName`)
  - **Bug 3**: OLX retornava São Paulo em vez de Santo André (actor ignora param `city` em formato original)
  - **Bug 4**: ZapImóveis retornava 0 resultados (params errados: `transactionType` em vez de `businessType`)
  - **Bug 5**: Mix de venda e locação nos comparáveis distorce estatísticas (R$3k aluguel + R$300k venda)
  - **Bug 6**: area=0 → cálculos usavam pricePerSqm × 100m² arbitrariamente
- **Fixes implementados (v29)**:
  - **Transaction type sanity filter**: Post-processing remove listings com preço incompatível (rent: R$200-50k, sale: R$30k-50M)
  - **VivaReal URL-based input**: `startUrls` com URL completa (`vivareal.com.br/aluguel/sp/santo-andre/apartamentos/`)
  - **ZapImóveis fix**: `businessType: 'RENTAL'` (não `transactionType`), `startUrls` com URL, city slug
  - **OLX city slug**: `city: citySlug` (ex: "santo-andre") em vez de nome original
  - **Metro area tier (tier 2.5)**: Regiões metropolitanas (ABC Paulista, Grande SP, Campinas, Piracicaba)
  - **Area=0 fallback**: Usa mediana de preço total direto (-15% confidence penalty)
  - **Source normalization**: Mapeia "OLX Imoveis" → "olx", "VivaReal" → "vivareal" para round-robin consistente
  - **Enhanced logging**: Distribuição de cidades, tipos de transação, mix de plataformas
- **Deploy**: v29 deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 29)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (1053 linhas)
