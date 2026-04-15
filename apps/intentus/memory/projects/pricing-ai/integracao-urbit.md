# Integração Urbit

**Status:** 🔄 Em negociação comercial (Marcelo contatando Urbit)
**Prioridade:** P0 (alternativa ao Apify instável)
**Documento completo:** `docs/plano-integracao-urbit.md`

## O que é
Substituir o scraping Apify (instável, 1300 linhas, 24 sessões de bugs) pela API REST da Urbit para dados de mercado imobiliário.

## Endpoints-chave
- **`listing`** (POST) — Principal. Multi-portal, filtro nativo de aluguel, busca por raio geográfico
- **`apartment-for-rent`** (GET) — Complementar. Apartamentos para aluguel dos últimos 90 dias
- **`avm`** — NÃO serve para aluguel (somente venda)

## Vantagens sobre Apify
- Filtro venda/locação nativo (elimina TX filter)
- Busca por lat/lng + raio (elimina problema de cidade errada)
- 6 portais em 1 query (VivaReal, ImovelWeb, QuintoAndar, etc.)
- Tempo de resposta ~10s (vs 60-180s Apify)
- Código estimado: ~200-300 linhas (vs ~1300)

## Riscos
- Limite de 10 resultados por query (mitigável com múltiplas queries)
- Precisa de lat/lng (geocoding se propriedade não tiver)
- Custo desconhecido (aguardando resposta comercial)

## Próximos Passos
1. Marcelo negocia credenciais + pricing com Urbit
2. Testar manualmente com curl (Piracicaba e Santo André)
3. Implementar Edge Function v25-urbit (~4-6h)
4. Ajustes frontend (~1-2h)
5. Testes e deploy (~2-3h)

## Estimativa Total
~8-12h de desenvolvimento (após credenciais obtidas)
