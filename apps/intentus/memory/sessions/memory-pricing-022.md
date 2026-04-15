# Sessão 22 — pricing-ai v24r7: Remove /apartamento_residencial/ + Adiciona ZapImóveis

- **Contexto**: Marcelo enviou 8 URLs de VivaReal e ZapImóveis para Claude analisar padrões de URL via Chrome browser
- **Descobertas da pesquisa de URL**:
  - **VivaReal**: `/apartamento_residencial/` no final da URL LIMITA resultados (63 vs 226 sem o sufixo)
  - **ZapImóveis**: Formato `/{txSlug}/imoveis/{uf}+{cidade}++{bairroSlug}/` com abbreviações (Vila→vl, Jardim→jd, Nova→nv, etc.)
- **3 opções apresentadas**: (1) Só remover sufixo VivaReal, (2) Só adicionar ZapImóveis, (3) Ambos
- **Marcelo escolheu**: Opção 3 — ambas as mudanças
- **Implementação v24r7 — 6 mudanças principais**:
  1. **Removido `/apartamento_residencial/`** de ambas as URLs VivaReal (com bairro e city-only) — 3.6× mais resultados
  2. **Novo actor ZapImóveis** (`avorio~zap-imoveis-scraper`): Re-adicionado com URL-based input correta (removido na sessão 14 por params errados)
  3. **`buildZapNeighborhoodSlug()`**: Função de abbreviação com 18 mapeamentos (Vila→vl, Jardim→jd, Santa→sta, São→s, Parque→pq, etc.)
  4. **`scrapeZapImoveis()`**: Função dedicada com error handling gracioso — se actor falha, retorna [] sem quebrar o fluxo
  5. **Scraping paralelo**: `Promise.allSettled()` para rodar VivaReal e ZapImóveis simultaneamente (ambos os passes)
  6. **`selectBalancedComparables()`**: Round-robin por fonte — distribui slots iguais entre plataformas (se 2 fontes: ~5 de cada)
- **Source tagging**: Cada item recebe `_source_tag` ('vivareal' ou 'zapimoveis') antes da normalização para atribuição correta
- **Preservado**: Todos os features existentes (TX boundary absoluto, two-pass, safe fallback, geo filter, auto-persist, confidence)
- **Deploy**: v24r7 deployada via Supabase MCP (function ID: 0cfa68cf-dcae-4020-a58d-a1a73c931d89, version: 40)
- **Repo**: `supabase/functions/pricing-ai/index.ts` atualizado (~1050 linhas, v24r7)
- **Arquivos alterados**:
  - `supabase/functions/pricing-ai/index.ts` — v24r7 com dual actor + URL fix
