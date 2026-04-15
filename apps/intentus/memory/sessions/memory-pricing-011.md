# Sessão 11 — pricing-ai v28: City filter + Platform mix

- **Problema 1 — Cidade errada**: OLX retornava imóveis de São Paulo para propriedade em Santo André
  - Causa: tier system da v27 expandia para ALL listings sem filtro de cidade quando neighborhood < 3 resultados
  - Fix: `cityMatch()` function com normalização, substring match e slug match
  - Tier system reescrito: tier 1 (city+neighborhood), tier 2 (city only), tier 3 (state — last resort)
- **Problema 2 — Sem mix de plataformas**: Todos os 10 comparáveis vinham da OLX
  - Causa: `matchingListings.slice(0, 10)` pegava os primeiros 10 por proximidade de área, ignorando fonte
  - Fix: Round-robin balanceado — agrupa por source, calcula quota igual por plataforma, distribui slots
  - Se 3 plataformas: ~3-4 de cada; se 2: ~5 de cada; se 1: todos da mesma
- **Deploy**: v28 deployada via Supabase MCP (version: 28)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (826 linhas)
