# Sessão 21 — pricing-ai v24r6: Fix URL VivaReal (/bairros/ + /apartamento_residencial/)

- **Problema**: v24r5 (version 38) mostrava erro "Não encontramos anúncios de locação compatíveis — Os 49 anúncios encontrados são de outro tipo de transação" para Vila Pires, Santo André
  - TX boundary fix da v24r5 funcionou corretamente (erro claro em vez de preços errados ✅)
  - Marcelo provou que anúncios de aluguel EXISTEM no VivaReal para Vila Pires (inclusive na mesma rua, Rua Bororós)
- **Root cause — URL inválida**: A Edge Function gerava URL que o VivaReal não reconhecia
  - **Errado (v24r5)**: `vivareal.com.br/aluguel/sp/santo-andre/vila-pires/`
  - **Correto (v24r6)**: `vivareal.com.br/aluguel/sp/santo-andre/bairros/vila-pires/apartamento_residencial/`
  - Dois segmentos faltando: `/bairros/` entre cidade e bairro, e `/apartamento_residencial/` no final
  - URL inválida fazia o VivaReal redirecionar para busca genérica → retornava dados de venda
- **Fix v24r6 — 2 changes na construção de URL**:
  1. **Segmento `/bairros/`**: Adicionado entre citySlug e neighborhoodSlug no path
  2. **Sufixo `/apartamento_residencial/`**: Adicionado em ambas as URLs (com bairro e city-only)
  - URL com bairro: `/${txSlug}/${stateSlug}/${citySlug}/bairros/${neighborhoodSlug}/apartamento_residencial/`
  - URL city-only: `/${txSlug}/${stateSlug}/${citySlug}/apartamento_residencial/`
- **Deploy**: v24r6 deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 39)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (~952 linhas, v24r6)
- **Arquivos alterados**:
  - `supabase/functions/pricing-ai/index.ts` — v24r6 com fix de URL VivaReal
