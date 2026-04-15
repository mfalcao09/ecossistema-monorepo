# Pricing-AI: Análise Multi-Plataforma e Plano de Ação

**Data:** 08/03/2026
**Status:** Diagnóstico completo — aguardando decisão para implementação

---

## Problema Identificado

O pricing-ai v25 envia `sources: ['vivareal', 'zapimoveis', 'olx', 'quintoandar']` para o Apify actor `f1xSvpkpklEh2EhGJ`, mas **apenas dados do VivaReal são retornados**. O actor aparenta ignorar ou não suportar as outras plataformas.

## Causa Raiz

O actor `f1xSvpkpklEh2EhGJ` provavelmente é o **"Brazil Real Estate Scraper"** do viralanalyzer, que cobre OLX Imóveis, QuintoAndar, ImovelWeb e Airbnb — **não VivaReal nem ZapImóveis diretamente**. Ou é um actor customizado que aceita o parâmetro `sources` mas que na prática só executa o scraping do VivaReal.

De qualquer forma, o resultado prático é: **apenas uma plataforma retorna dados**.

## Actors Disponíveis no Apify (por plataforma)

| Plataforma | Actor | ID/Slug | Input | Output |
|---|---|---|---|---|
| **VivaReal** | Viva Real Scraper (makemakers) | `makemakers~viva-real-scraper` | city, state, transactionType, propertyType, maxPages | JSON com price, area, neighborhood, url |
| **ZapImóveis** | Zap Imóveis Scraper (avorio) | `avorio~zap-imoveis-scraper` | Busca por cidade/bairro, tipo, transação | JSON com listing details |
| **OLX** | OLX Brazil property scraper (autoscraping) | `autoscraping~olxbrazil-collect-by-url` | **URLs específicas** (não search params) | JSON com title, price, location |
| **Multi (OLX, QuintoAndar, ImovelWeb, Airbnb)** | Brazil Real Estate Scraper (viralanalyzer) | `viralanalyzer~brazil-real-estate-scraper` | city, state, sources, propertyType | JSON com listings |

**Nota importante:** O OLX scraper do autoscraping requer **URLs específicas** (não aceita busca por parâmetros), o que torna a integração mais complexa. Para OLX, o actor do viralanalyzer seria mais adequado.

## Solução Recomendada: Multi-Actor Paralelo

### Arquitetura Proposta (v26)

```
[Frontend] → pricing-ai Edge Function
                    ↓
         ┌─────────────────────────┐
         │  Promise.allSettled()   │
         │                         │
         │  ┌───────────────────┐  │
         │  │ Actor 1: VivaReal │  │  makemakers~viva-real-scraper
         │  └───────────────────┘  │
         │  ┌───────────────────┐  │
         │  │ Actor 2: ZapImóv. │  │  avorio~zap-imoveis-scraper
         │  └───────────────────┘  │
         │  ┌───────────────────┐  │
         │  │ Actor 3: Multi    │  │  viralanalyzer~brazil-real-estate-scraper
         │  │ (OLX+QuintoAndar) │  │  (ou manter f1xSvpkpklEh2EhGJ)
         │  └───────────────────┘  │
         └─────────┬───────────────┘
                   ↓
         Merge + Deduplicate listings
                   ↓
         filterComparables() + calcStats() (sem mudanças)
                   ↓
         genAnalysis() via GPT-4o-mini
                   ↓
         Response ao frontend
```

### Mudanças na Edge Function

1. **Nova função `scrapeFromActor()`** — genérica, aceita actor ID + input + normalizer
2. **Nova função `scrapeAllPlatforms()`** — orquestra múltiplos actors em paralelo via `Promise.allSettled()`
3. **Normalizer por plataforma** — cada actor retorna dados em formato diferente, precisamos normalizar para `ApifyListing`
4. **Deduplicação** — imóveis podem aparecer em mais de uma plataforma (VivaReal e ZapImóveis são do mesmo grupo OLX)
5. **Timeout individual** — cada actor tem seu próprio timeout (60s), o total fica ~90s (paralelo)
6. **Fallback graceful** — se um actor falhar, os outros continuam

### Impacto em Custos Apify

- **Atual:** 1 actor × 1 execução = ~$0.05-0.15 por análise
- **Proposto:** 3 actors × 1 execução = ~$0.15-0.45 por análise (3x)
- **Estimativa mensal (50 análises/mês):** $7.50-22.50 vs atual $2.50-7.50
- Ainda bem dentro do plano Starter ($49/mês)

### Complexidade de Implementação

- **Esforço estimado:** 4-6 horas de desenvolvimento
- **Risco:** Médio — cada actor tem input/output diferente, precisa testar cada um
- **Pré-requisito:** Testar manualmente cada actor no Apify Console para validar input schema e output format

## Plano de Execução (quando decidido)

### Etapa 1: Validação dos Actors (30 min)
- Rodar cada actor manualmente no Apify Console com dados de teste (Piracicaba/SP, locação, apartamento)
- Documentar input schema e output format exato de cada um
- Verificar se o actor do ZapImóveis requer proxy residencial (mencionado na documentação)

### Etapa 2: Implementar Multi-Scrape (2-3h)
- Criar `scrapeFromActor()` genérica com normalização
- Criar normalizadores por plataforma
- Implementar `scrapeAllPlatforms()` com `Promise.allSettled()`
- Deduplicação por título + bairro + preço (fuzzy match)

### Etapa 3: Deploy v26 + Teste (1h)
- Deploy via Supabase MCP
- Testar com contrato real no app
- Verificar se listings de múltiplas plataformas aparecem no resultado
- Confirmar que badges de source mostram dados variados

### Etapa 4: Sincronizar Repo (30 min)
- Atualizar `supabase/functions/pricing-ai/index.ts` com código v26
- Commit + push

## Alternativa Simplificada (Quick Win)

Se a abordagem multi-actor for complexa demais para agora, uma alternativa mais simples:

1. **Trocar o actor atual** pelo `viralanalyzer~brazil-real-estate-scraper` que já cobre 4 plataformas (OLX, QuintoAndar, ImovelWeb, Airbnb)
2. **Manter o actor VivaReal** atual como está
3. **Rodar 2 actors em paralelo** (VivaReal + viralanalyzer) — cobertura de 5 plataformas com apenas 2 chamadas

Isso reduz a complexidade pela metade e já dá uma melhoria significativa de cobertura.

---

*Documento gerado automaticamente — Sessão de 08/03/2026*
