# Sessão 20 — pricing-ai v24r5: TX filter boundary absoluto (fix CRÍTICO)

- **Problema**: v24r4 (version 37) continuava mostrando preços de VENDA (R$199k-R$402k) para contrato de LOCAÇÃO (aluguel real: R$1.850/mês)
  - Marcelo enviou 3 screenshots confirmando: "+21633.08% unfiltered", todos os comparáveis de Piracicaba com preços de venda
  - Badge "unfiltered" confirmou que o never-fail strategy relaxou o TX filter
- **Root cause**: A "never-fail strategy" da v24r4 tinha 3 níveis de fallback:
  1. Relaxar geo filter (city→state) ✅ Seguro
  2. Relaxar TX filter (usar allListings sem filtro de venda/locação) ❌ **CRÍTICO — misturava venda com locação**
  3. Last-resort usando `allListings` (pré-TX-filter) ❌ **CRÍTICO — mesmo problema**
- **Fix v24r5 — TX filter boundary absoluto (3 changes)**:
  1. **Removido relaxamento do TX filter**: Quando TX filter remove tudo → retorna erro claro ("Não encontramos anúncios de locação compatíveis") com diagnostic info, em vez de usar dados de venda
  2. **Last-resort usa `txFiltered`**: Alterado de `allListings` (sem TX filter) para `txFiltered` (com TX filter). Tier renomeado de 'unfiltered' para 'state'
  3. **Renomeado**: "NEVER-FAIL STRATEGY" → "SAFE FALLBACK STRATEGY" — geo filter pode relaxar, TX filter NUNCA
- **Consequência esperada**: Se Apify retorna só dados de venda para query de locação, usuário vê mensagem de erro em vez de preços errados. Melhor sem resultado que resultado errado.
- **Deploy**: v24r5 deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 38)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (~942 linhas, v24r5)
- **Arquivos alterados**:
  - `supabase/functions/pricing-ai/index.ts` — v24r5 com TX filter boundary
