# Plano de Integração — Urbit API para Precificação de Aluguel

**Data**: 10/03/2026
**Status**: Análise concluída — aguardando decisão de implementação
**Prioridade**: P0 (alternativa ao Apify que está instável)

---

## 1. Contexto e Motivação

O pricing-ai atual usa **Apify actors** para scraping de VivaReal e ZapImóveis. Após 24 sessões de evolução (v22→v24r8), a solução continua instável — o deploy v42 retorna erros HTTP non-2xx. Os problemas recorrentes incluem:

- Actors Apify ignoram parâmetros de cidade/bairro (retornam dados state-wide)
- URLs de scraping precisam de engenharia reversa constante (segmentos `/bairros/`, sufixos de tipo)
- Mistura de dados de venda/locação exige post-processing complexo
- Dependência de 2 actors externos sem garantia de estabilidade
- Deploy via Supabase MCP ocasionalmente gera código diferente do repositório

A **Urbit** (Urbit Serviços de Informática LTDA, CNPJ 31.687.326/0001-62, São Paulo) oferece uma API REST de dados imobiliários que pode substituir o scraping por acesso direto e estruturado.

---

## 2. A Urbit Atende a Demanda de Precificação de Aluguel?

### ✅ RESPOSTA: SIM — com ressalvas

A Urbit possui **dois endpoints** que atendem diretamente a necessidade de comparáveis de aluguel:

| Endpoint | Adequação | Observação |
|----------|-----------|------------|
| **`listing`** | ⭐ Principal | Multi-portal, filtro nativo de `finalidade: "aluguel"`, busca por raio geográfico, filtros de área/preço/quartos/tipo |
| **`apartment-for-rent`** | 🔄 Complementar | Anúncios de aluguel dos últimos 90 dias, com link original. Mais simples que `listing` |
| **`avm`** | ❌ Não serve para aluguel | Automated Valuation Model — **somente para venda** |

---

## 3. Análise Detalhada dos Endpoints Relevantes

### 3.1. Endpoint `listing` (PRINCIPAL)

**URL**: `POST https://api.urbit.com.br/listing`

**Body de exemplo (locação)**:
```json
{
  "area": { "min": 30, "max": 100 },
  "valor": { "min": 500, "max": 5000 },
  "quartos": 2,
  "finalidade": "aluguel",
  "distancia": 2000,
  "tipo": "apartamento;casa;flat_residencial;kitnet;studio",
  "latLng": "-22.72840;-47.64900"
}
```

**Response inclui**:
- `data_coleta` — data de coleta do anúncio
- `endereco` — endereço completo
- `area` — área do imóvel
- `quartos`, `suites`, `banheiros`, `vagas`
- `valor` — preço total/venda
- `tipo` — tipo do imóvel
- `link` — **URL do anúncio original** (já resolve o pedido de links clicáveis)
- `cep` — CEP
- `valor_aluguel` — valor do aluguel puro
- `iptu` — valor do IPTU
- `condominio` — valor do condomínio
- `aluguel_total` — soma (aluguel + condomínio + IPTU)
- `latitude`, `longitude` — coordenadas do imóvel
- `distancia` — distância do ponto de busca

**Portais cobertos**: VivaReal, ImovelWeb, QuintoAndar, FirstBoutique, HomeSphere, PilarHomes

**Vantagens sobre Apify**:
1. Filtro de `finalidade: "aluguel"` nativo — elimina 100% do problema de mistura venda/locação
2. Busca por raio geográfico (lat/lng + distância) — elimina problema de cidade errada
3. Filtro de tipo de imóvel nativo (`tipo: "apartamento;casa"`) — elimina post-processing
4. Filtro de área e preço nativo — elimina cálculo de ±70%
5. Breakdown de aluguel (puro + condomínio + IPTU) — dado mais rico
6. URL do anúncio original no response — resolve pedido de links clicáveis
7. 6 portais em uma query (vs 2 actors separados no Apify)

**Limitações identificadas**:
- `distancia` máximo: **2000 metros** (pode ser insuficiente para bairros com pouca oferta)
- `limit` máximo: **10 resultados** por query (pode ser insuficiente para análise estatística robusta)
- Sem ZapImóveis na lista de portais (mas tem VivaReal, QuintoAndar e ImovelWeb)
- Requer coordenadas lat/lng (precisamos geocoding a partir do endereço)

### 3.2. Endpoint `apartment-for-rent` (COMPLEMENTAR)

**URL**: `GET https://api.urbit.com.br/service/apartment-for-rent/{lng}/{lat}`

**Características**:
- Retorna apartamentos para aluguel publicados nos últimos 90 dias
- Inclui preço, tipologia, observações e link do anúncio
- Mais simples (sem body params — só coordenadas na URL)
- Pode servir como fallback ou validação cruzada

**Limitação**: Apenas apartamentos (não inclui casas, terrenos, comerciais).

### 3.3. Endpoint `avm` (NÃO SERVE PARA ALUGUEL)

**URL**: `POST https://api.urbit.com.br/avm`

- Automated Valuation Model para estimativa de preço
- **Somente para VENDA** (`"finalidade": venda` no body)
- Retorna preço estimado baseado em localização e tipologia
- Poderia ser útil no futuro se Intentus expandir para precificação de venda

### 3.4. Endpoint `supply-location-quality-index` (BÔNUS)

- Índice de qualidade-oferta (liquidez) para 48 municípios
- Score composto: Censo (0.30), IPEA (0.15), Urbit (0.15), Anúncios (0.40)
- Útil para enriquecer a análise com contexto de mercado
- **Limitação**: 48 municípios (inclui Santo André, mas NÃO Piracicaba)

---

## 4. Comparação: Urbit API vs Apify (Abordagem Atual)

| Aspecto | Apify (v24r8) | Urbit API |
|---------|---------------|-----------|
| **Tipo de acesso** | Scraping via actors | API REST direta |
| **Filtro venda/locação** | Post-processing (TX sanity filter) | Nativo (`finalidade: "aluguel"`) |
| **Filtro geográfico** | URL-based + post-processing city filter | Nativo (lat/lng + raio em metros) |
| **Filtro tipo imóvel** | URL slugs + post-processing | Nativo (`tipo: "apartamento;casa"`) |
| **Filtro área** | Post-processing ±70% | Nativo (`area: {min, max}`) |
| **Portais** | VivaReal + ZapImóveis (2) | VivaReal + ImovelWeb + QuintoAndar + 3 outros (6) |
| **Max resultados** | ~150 por actor | **10 por query** ⚠️ |
| **Custo por query** | ~$0.05-0.15 Apify + ~$0.001 OpenAI | A definir (pricing Urbit não documentado no PDF) |
| **Tempo de resposta** | 60-180s (scraping + polling) | Provavelmente < 10s (API direta) |
| **Estabilidade** | Instável (actors mudam, URLs quebram) | Esperado estável (API versionada) |
| **Dados de resposta** | Campos variáveis (normalização necessária) | Campos padronizados e documentados |
| **Breakdown aluguel** | Não disponível | `valor_aluguel` + `iptu` + `condominio` + `aluguel_total` |
| **Link do anúncio** | Nem sempre presente | Sempre presente (`link`) |
| **Geocoding necessário** | Não (busca por nome de cidade/bairro) | Sim (precisa lat/lng) |
| **Complexidade do código** | ~1300 linhas (v24r8) | Estimado ~200-300 linhas |

---

## 5. Riscos e Mitigações

### 5.1. Limite de 10 resultados por query
**Risco**: Estatísticas com 10 comparáveis podem não ser robustas (mediana de 10 vs 15+ no Apify)
**Mitigação**:
- Fazer múltiplas queries com raios diferentes (500m, 1000m, 2000m) e deduplicar
- Complementar com `apartment-for-rent` para mais dados
- 10 comparáveis BEM filtrados (mesmo tipo, mesma cidade, mesmo tipo de transação) são melhores que 150 mal filtrados

### 5.2. Geocoding necessário
**Risco**: Propriedades no Intentus têm endereço/bairro/cidade, mas podem não ter lat/lng
**Mitigação**:
- Tabela `properties` tem campos `latitude` e `longitude` (verificar se estão preenchidos)
- Se não tiver, usar Google Geocoding API ou Nominatim (OpenStreetMap) como step intermediário
- Custo mínimo — Google Geocoding: $5/1000 requests

### 5.3. Piracicaba não está na lista de municípios (quality index)
**Risco**: O quality index só cobre 48 municípios, Piracicaba não é um deles
**Mitigação**: O quality index é um BÔNUS, não é essencial. Os endpoints nacionais (`listing`, `apartment-for-rent`) funcionam com qualquer coordenada do Brasil

### 5.4. Pricing da Urbit desconhecido
**Risco**: Não sabemos o custo por query ou modelo de preço (não está no PDF)
**Mitigação**: Entrar em contato com a Urbit antes de implementar. Dados de contato:
- Site: urbit.com.br
- CNPJ: 31.687.326/0001-62
- Sede: São Paulo/SP

### 5.5. Sem ZapImóveis
**Risco**: ZapImóveis não está listado entre os portais da Urbit
**Mitigação**: A Urbit cobre 6 portais (incluindo VivaReal e QuintoAndar), o que compensa. ImovelWeb é um portal relevante que o Apify não cobria

---

## 6. Plano de Implementação

### Fase 1 — Validação (antes de codar)
**Estimativa**: 1-2 dias
1. **Contatar Urbit**: Obter credenciais de API (username/password) e entender pricing
2. **Testar manualmente**: Chamar `POST /listing` com coordenadas de Piracicaba e Santo André via curl/Postman
3. **Validar cobertura**: Confirmar que retorna anúncios de aluguel para as cidades-alvo
4. **Validar limite**: Testar se 10 resultados são suficientes ou se precisa de múltiplas queries

### Fase 2 — Implementação da Edge Function (v25-urbit)
**Estimativa**: 4-6 horas
1. **Nova versão do pricing-ai** (`v25-urbit`):
   - Autenticação Urbit (POST /authenticate → Bearer token)
   - Geocoding do endereço da propriedade (se não tiver lat/lng)
   - Query ao endpoint `listing` com filtros nativos
   - Opcionalmente, query complementar ao `apartment-for-rent`
   - Cálculo de estatísticas (mantém lógica existente de mediana, avg, range)
   - AI analysis via OpenAI GPT-4o-mini (mantém)
   - Auto-persist em `pricing_analyses` (mantém)
   - Response no mesmo formato do frontend (`stats`, `top_comparables`, `ai_analysis`)

2. **Fluxo simplificado**:
   ```
   Frontend → Edge Function → Urbit /authenticate → Bearer token
                            → Urbit /listing (aluguel, lat/lng, raio, tipo)
                            → calculateStats (mesma lógica)
                            → OpenAI GPT-4o-mini (análise)
                            → Response formatado
   ```

3. **Código estimado**: ~200-300 linhas (vs 1300 linhas da v24r8)
   - Sem: normalizeApifyItem, pollApifyRun, scrapeVivaReal, scrapeZapImoveis, buildZapNeighborhoodSlug, TX sanity filter, city filter post-processing, URL slug engineering
   - Mantém: resolveProperty, calculateStats, generateAIAnalysis, persistAnalysis, mapEdgeFunctionResponse

### Fase 3 — Ajustes no Frontend
**Estimativa**: 1-2 horas
1. **`usePricingAI.ts`**: Minimal changes — o response format será mantido compatível
2. **`PricingAIDialog.tsx`**: Adicionar badges de fonte (ImovelWeb, QuintoAndar, etc.)
3. **`ContractPricingTab.tsx`**: Nenhuma mudança necessária (histórico já funciona)

### Fase 4 — Testes e Deploy
**Estimativa**: 2-3 horas
1. Testar com contratos de locação em Piracicaba (Splendori)
2. Testar com contratos em Santo André/SP
3. Validar que links dos comparáveis abrem os anúncios originais
4. Confirmar breakdown aluguel + condomínio + IPTU no dialog
5. Deploy e monitoramento

---

## 7. Variáveis de Ambiente Necessárias

```
URBIT_USERNAME=<email de acesso>
URBIT_PASSWORD=<senha de acesso>
OPENAI_API_KEY=<já existe>
```

**Nota**: A autenticação Urbit retorna um Bearer token que pode ser cacheado (o PDF não especifica TTL, testar na prática).

---

## 8. Estimativa Total

| Fase | Esforço | Dependência |
|------|---------|-------------|
| Validação (contato Urbit + testes manuais) | 1-2 dias | Credenciais Urbit |
| Edge Function v25-urbit | 4-6h | Credenciais Urbit confirmadas |
| Ajustes frontend | 1-2h | Edge Function pronta |
| Testes e deploy | 2-3h | Tudo pronto |
| **Total** | **~8-12h de desenvolvimento** + tempo de validação | — |

---

## 9. Decisão Necessária

Marcelo precisa:

1. **Contatar a Urbit** para obter credenciais e entender pricing
2. **Decidir se quer manter o Apify como fallback** ou substituir completamente
3. **Confirmar** se as propriedades no Intentus já têm lat/lng preenchidos (ou se precisa de geocoding)

---

## 10. Conclusão

A Urbit API é uma **alternativa superior ao Apify** para precificação de aluguel no Intentus:

- **Elimina 90% dos bugs das últimas 24 sessões** (cidade errada, venda/locação misturada, URLs quebradas, actors instáveis)
- **Reduz o código de ~1300 para ~200-300 linhas** (menos manutenção)
- **Tempo de resposta estimado em < 10s** (vs 60-180s do Apify)
- **Dados mais ricos** (breakdown aluguel/condomínio/IPTU)
- **Links dos anúncios sempre presentes** no response

O principal risco é o **limite de 10 resultados por query**, mitigável com múltiplas queries em raios diferentes. O segundo risco é o **custo** (desconhecido até contato com a Urbit).

**Recomendação**: Iniciar a Fase 1 (validação) o mais rápido possível. Se os testes confirmarem cobertura adequada para Piracicaba e Santo André, avançar para implementação.
