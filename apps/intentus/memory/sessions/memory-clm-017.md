# Sessão 17 — pricing-ai v24r2: Fix contract_type + city filter + tx filter

- **Problema reportado por Marcelo** (com screenshot):
  1. **Preços de venda** aparecendo em contratos de locação (R$210k-929k = claramente venda)
  2. **Cidade/bairro errados** — todos os comparáveis de bairros aleatórios de Piracicaba, não do bairro do imóvel
- **Root cause 1 — contract_type mapping**: A v24r só checava `"rental"` e `"lease"`, mas o frontend envia `"locacao"` (enum Zod: `venda, locacao, administracao, distrato`). Resultado: `isRental=false` → URL de venda → preços de venda
- **Root cause 2 — sem filtro de cidade**: A v24r não tinha post-processing filter de cidade/bairro (esses filtros existiam na v29/v30 mas foram perdidos na reconstrução)
- **Análise histórica**: Identificou que v25 (session 6) adicionou contract_type, v29 (session 12) adicionou tx sanity filter, v30 (session 13) adicionou city-strict filter
- **6 fixes implementados (v24r2)**:
  1. **contract_type mapping**: `"locacao"`, `"administracao"`, `"rental"`, `"lease"`, `.includes('aluguel')`, `.includes('locação')` → todos mapeiam para `isRental=true`
  2. **Neighborhood na URL VivaReal**: `/aluguel/sp/piracicaba/nova-america/` em vez de só `/aluguel/sp/piracicaba/`
  3. **Transaction type sanity filter** (portado da v29): Rental R$200-50k, Sale R$30k-50M — remove listings com preço incompatível
  4. **City/neighborhood post-processing filter** (portado da v30): normalização com `NFD` (remove acentos), substring match, tier system (bairro > cidade > estado)
  5. **Confidence penalty por tier**: state=-30, city=-10 (portado da v30)
  6. **Corrigido txLabel** em `generateAIAnalysis`, `generateLocalAnalysis`, e `persistAnalysis` — todas as 3 funções tinham o mesmo bug de mapping
- **Extras**: `geo_stats` no response (transparência), logs de city distribution para diagnóstico
- **Deploy**: v24r2 deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 35)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (~776 linhas, v24r2 com post-processing filters)
