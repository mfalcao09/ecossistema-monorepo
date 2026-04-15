# Sessão 18 — pricing-ai v24r3: Field normalization + resilient stats (fix "dados insuficientes")

- **Problema reportado por Marcelo**: Após deploy da v24r2, ao clicar "Precificação IA" na aba Renovações, aparecia erro "Não foi possível calcular valor de mercado — dados insuficientes"
- **Diagnóstico**: Supabase logs mostraram v35 retornando HTTP 200 em ~64s (scraping funcionou), mas `calculateStats` filtrava todos os listings
- **Root cause**: Apify actor retorna items com nomes de campos diferentes do esperado pela interface `ApifyListing`
  - O actor retorna campos como `totalArea`, `usableArea`, `listingPrice`, `pricingInfos`, etc.
  - A interface esperava `area`, `price`, etc. direto — como os campos não batiam, `area=undefined` e `price=undefined` para todos
  - `calculateStats` filtrava items sem price+area → 0 válidos → suggested_value=0 → erro "dados insuficientes"
- **3 fixes implementados (v24r3)**:
  1. **`normalizeApifyItem()`**: Nova função que mapeia 10+ variações de nome por campo (price, area, city, neighborhood, url, source, bedrooms, bathrooms, parkingSpaces) para a interface padrão `ApifyListing`
  2. **`calculateStats` resiliente**: Quando menos de 3 listings têm `area > 0`, usa modo "preço-only" (mediana de preço direto em vez de preço/m²×área) com -15 de confidence penalty
  3. **Wiring no main handler**: `rawListings = await pollApifyRun()` → `listings = rawListings.map(normalizeApifyItem)`, com log diagnóstico dos primeiros items raw
- **Extras**:
  - **Diagnostic data**: Quando `suggested_value === 0`, o response inclui `diagnostic` object com contagens de cada estágio do pipeline (raw, normalized, tx_filter, city_matches, etc.) e sample keys do raw
  - **Division-by-zero fix**: `TopComparable.pricePerSqm` agora verifica `area > 0` antes de dividir
  - **Raw item logging**: Logs das keys e primeiros 2 items do Apify para facilitar diagnóstico futuro
- **Deploy**: v24r3 deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 36)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (~913 linhas, v24r3 com field normalization)
