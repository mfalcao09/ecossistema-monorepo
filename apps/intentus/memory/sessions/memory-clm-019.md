# Sessão 19 — pricing-ai v24r4: Two-pass scraping + never-fail strategy

- **Problema persistente**: v24r3 (version 36) continuava retornando "dados insuficientes" para contratos de locação
- **Root cause**: Bairros com poucos anúncios de aluguel no VivaReal (ex: Vila Pires, Santo André) resultavam em 0 listings após TX + geo filters
  - v34 "funcionava" porque buscava VENDA (não mapeava "locacao" → rental) → encontrava 15 comps de venda → R$402k (ERRADO: preço de venda em contrato de locação)
  - v24r2/v24r3 corrigiram o mapping → buscam corretamente ALUGUEL → mas Vila Pires tem pouquíssimos anúncios de aluguel
- **Solução v24r4 — 4 melhorias fundamentais**:
  1. **`scrapeVivaReal()` extraída**: Função reutilizável para permitir múltiplas chamadas
  2. **Two-pass strategy**: Pass 1 = URL com bairro. Se < 3 resultados válidos, Pass 2 = URL só com cidade (mais dados). Deduplicação por URL no merge
  3. **maxResults 80 → 150**: Mais dados brutos do Apify = mais chance de encontrar comps do bairro
  4. **Never-fail strategy**: Relaxamento progressivo de filtros:
     - Se geo filter remove tudo → usa TX-filtered inteiro (tier=state)
     - Se TX filter remove tudo → usa todos os listings (tier=unfiltered)
     - Se calculateStats retorna 0 → last resort com ALL normalized listings e -25 confidence
     - Só retorna erro se literalmente 0 listings vieram do Apify
- **Frontend fix**: `usePricingAI.ts` linha 262 — `analysis_type` mapping adicionou `"locacao"` e `"administracao"` para mapear corretamente para `"rental"` (antes só checava `"rental"` e `"lease"`)
- **Deploy**: v24r4 deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 37)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (~925 linhas, v24r4)
- **Arquivos alterados**:
  - `supabase/functions/pricing-ai/index.ts` — v24r4 completa
  - `src/hooks/usePricingAI.ts` — fix analysis_type mapping
