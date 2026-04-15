# Pricing-AI — Análise de Abordagens para Precificação Inteligente

## Visão Geral do Problema

O módulo **pricing-ai** da Intentus Real Estate precisa:

1. Capturar dados do imóvel no sistema (endereço, CEP, características)
2. Buscar imóveis comparáveis nas plataformas de anúncio (VivaReal, OLX, ZapImóveis)
3. Comparar **mesmo tipo de produto** (mesma região, mesmo tipo de imóvel)
4. Calcular o **preço por m² praticado no mercado**
5. Alimentar o sistema com uma base de dados de mercado

---

## Caminho 1: Apify — Scraper Especializado (Encontrado por Marcelo)

### O que é
Plataforma de web scraping como serviço. Já possui **actors** (scrapers prontos) para o mercado imobiliário brasileiro.

### Actors disponíveis no Apify para Brasil
- **Brazil Real Estate Scraper** (viralanalyzer) — cobre OLX Imóveis, QuintoAndar, ImovelWeb e Airbnb. Versão 2.0 (fev/2026) com motor híbrido HTTP + Playwright
- **Viva Real Scraper** (makemakers) — scraper dedicado ao VivaReal
- **Zap Imóveis Scraper** (avorio) — scraper dedicado ao ZapImóveis
- **OLX Brazil Property Scraper** (autoscraping) — coleta por URL no OLX

### Dados extraídos
Preço, área (m²), localização, tipo do imóvel, quartos, banheiros, vagas, **cálculo automático de preço/m²** quando preço e área estão disponíveis.

### Cobertura
Todos os 27 estados brasileiros.

### Custos
- **Free**: US$ 5/mês em créditos (testes)
- **Starter**: US$ 39/mês
- **Scale**: US$ 199/mês (volume sério)
- Cobrança por unidades de computação consumidas, não por execução

### Como integraria com Intentus
```
[Intentus Frontend] → botão "Precificar"
     ↓
[pricing-ai Edge Function] → chama Apify API com parâmetros de busca
     ↓
[Apify Actor] → faz scraping nas plataformas
     ↓
[pricing-ai] → recebe dados → filtra comparáveis → calcula m² → salva no Supabase
     ↓
[Frontend] → exibe resultado com comparativos
```

### Pontos fortes
- Scrapers JÁ PRONTOS para as plataformas brasileiras
- API REST fácil de integrar com Edge Functions
- Cálculo automático de preço/m²
- Escalável — suporta volume crescente
- Mantido por terceiros (eles cuidam das mudanças nos sites)

### Pontos fracos
- Custo recorrente (cresce com uso)
- Dependência de terceiro — se o actor quebrar, precisa esperar o autor corrigir
- Scraping pode violar termos de uso das plataformas
- Latência: scraping pode levar segundos/minutos (não é instantâneo)
- Dados podem ser inconsistentes (anúncios desatualizados, preços inflados)

### Nível de esforço de implementação
⭐⭐ (Baixo) — API pronta, só precisa integrar

---

## Caminho 2: CASAFARI — API de Inteligência Imobiliária

### O que é
Plataforma profissional de dados imobiliários com presença no Brasil. Oferece API de dados e avaliação automatizada de imóveis (AVM — Automated Valuation Model).

### O que oferece
- **Property Data API** — dados estruturados e atualizados de imóveis
- **Avaliação Online Automática** — modelo matemático que estima valor de mercado comparando imóveis similares
- Dados de 30.000+ fontes e 200+ milhões de anúncios globalmente
- Histórico de preços de pedido e fechamento
- Dados de estoque, liquidez e rental yields
- Heatmaps e séries temporais
- **CASAFARI MCP** — integração com agentes de IA (compatível com protocolo MCP)

### Cobertura
20+ países, incluindo Brasil na América do Sul.

### Custos
Plano enterprise — precisa contatar vendas para cotação. Tipicamente mais caro que Apify, mas dados são mais estruturados e confiáveis.

### Como integraria com Intentus
```
[Intentus Frontend] → botão "Precificar"
     ↓
[pricing-ai Edge Function] → chama CASAFARI API com endereço + características
     ↓
[CASAFARI API] → retorna avaliação + comparáveis
     ↓
[pricing-ai] → processa → salva no Supabase
     ↓
[Frontend] → exibe avaliação com fundamentação
```

### Pontos fortes
- Dados profissionais, limpos e estruturados
- AVM (Avaliação Automatizada) já pronta — não precisa construir a lógica de comparação
- Compliance legal — dados coletados de forma estruturada
- Histórico de preços (não apenas snapshot atual)
- Suporte MCP (poderia integrar diretamente como agente de IA)

### Pontos fracos
- Custo provavelmente alto (plano enterprise)
- Menos flexibilidade — você usa o modelo de avaliação deles
- Cobertura no Brasil pode ser menor que plataformas locais
- Negociação comercial necessária

### Nível de esforço de implementação
⭐⭐ (Baixo) — API profissional bem documentada

---

## Caminho 3: DataZAP + FipeZAP — Índices Oficiais do Mercado

### O que é
O **DataZAP** é a divisão de inteligência do ZAP Imóveis (Grupo OLX, que também é dono do VivaReal e ImovelWeb). O **FipeZAP** é o índice produzido em parceria com a FIPE (Fundação Instituto de Pesquisas Econômicas) — é o principal indicador de preços imobiliários do Brasil.

### Dados disponíveis
- Índices de venda e locação residencial para 56 cidades (22 capitais)
- Índices comerciais para 10 cidades
- Preço por m² por bairro e zona
- Variação mensal e acumulada de 12 meses
- Base de 500.000+ anúncios válidos por mês
- Plataforma "Quanto Vale?" com Machine Learning (Azure) para estimativa de valor

### Custos
- Índice FipeZAP: download gratuito (planilhas Excel no site da FIPE) — mas dados agregados, não individuais
- DataZAP Plataforma: planos pagos para dados granulares — contato comercial
- Relatórios mensais em PDF: gratuitos

### Como integraria com Intentus
```
[Intentus] → usa índice FipeZAP como REFERÊNCIA de mercado
     ↓
[pricing-ai Edge Function] → combina FipeZAP (m² bairro) + dados do imóvel
     ↓
[Cálculo] → preço estimado = m² do bairro × área do imóvel × fator de ajuste
     ↓
[Frontend] → exibe estimativa com referência ao índice oficial
```

### Pontos fortes
- Fonte OFICIAL e reconhecida pelo mercado (FIPE é referência)
- Gratuito para dados agregados
- Credibilidade institucional (bancos usam FipeZAP para financiamento)
- Dados já validados e limpos
- Metodologia transparente e auditável

### Pontos fracos
- Dados AGREGADOS (preço médio por bairro) — não tem anúncios individuais
- Não permite comparar imóvel a imóvel (galpão vs galpão específico)
- Cobertura limitada a 56 cidades
- Atualização mensal (não em tempo real)
- Sem API programática pública — dados via Excel/PDF
- Para dados granulares, precisa de plano pago do DataZAP

### Nível de esforço de implementação
⭐⭐⭐ (Médio) — precisa processar planilhas Excel e construir lógica de ajuste

---

## Caminho 4: Dados Abertos do Banco Central + IBGE

### O que é
O Banco Central do Brasil disponibiliza mensalmente o relatório "Informações do Mercado Imobiliário" com 4.000+ séries mensais, incluindo dados de imóveis financiados. O IBGE fornece dados socioeconômicos que podem complementar a análise.

### API disponível
```
https://olinda.bcb.gov.br/olinda/servico/MercadoImobiliario/versao/v1/odata/mercadoimobiliario
```

### Dados disponíveis
- Informações de imóveis financiados
- Índices setoriais
- Detalhamento por estado
- Dados de crédito imobiliário

### Custos
100% gratuito — dados públicos abertos.

### Como integraria com Intentus
```
[pricing-ai] → consulta API BCB para dados macro de mercado
     ↓
[Cálculo] → cruza dados BCB + FipeZAP + dados do imóvel
     ↓
[Resultado] → precificação fundamentada em dados oficiais
```

### Pontos fortes
- 100% gratuito
- API OData oficial e estável
- Dados oficiais do governo federal
- Complementa outras fontes com contexto macro

### Pontos fracos
- Dados de FINANCIAMENTO (não de mercado/anúncios)
- Defasagem de 60 dias
- Não tem dados por imóvel individual
- Serve mais como complemento do que como fonte principal

### Nível de esforço de implementação
⭐⭐ (Baixo) — API REST disponível

---

## Caminho 5: Scraping Próprio com Bright Data ou ScrapingBee

### O que é
Em vez de usar scrapers prontos do Apify, construir scrapers customizados usando serviços de proxy e renderização JavaScript como **Bright Data** ou **ScrapingBee**.

### Bright Data
- Maior rede de proxies do mundo
- Suporta rendering JavaScript
- Preço por registro coletado
- Posicionado para grandes volumes corporativos

### ScrapingBee
- API de scraping com JavaScript rendering
- Stealth mode para evitar bloqueios
- A partir de US$ 49/mês (Freelance)
- Cobrança por créditos (features avançadas gastam mais)

### Como integraria com Intentus
```
[pricing-ai Edge Function] → monta URL de busca para VivaReal/ZAP/OLX
     ↓
[ScrapingBee/Bright Data API] → renderiza página → retorna HTML
     ↓
[pricing-ai] → faz parsing do HTML → extrai dados dos imóveis
     ↓
[Lógica de comparação] → filtra por tipo/região → calcula m²
     ↓
[Supabase] → salva resultados
```

### Pontos fortes
- Controle total sobre o que e como coletar
- Pode customizar a extração exatamente para as necessidades da Intentus
- Funciona com qualquer site (não depende de actors prontos)

### Pontos fracos
- MUITO mais trabalho de desenvolvimento — precisa construir e manter parsers HTML para cada site
- Quando os sites mudam o layout, os parsers quebram
- Custo pode ser alto com volume (especialmente Bright Data)
- Precisa manter o código constantemente atualizado
- Complexidade de lidar com anti-bot, CAPTCHAs, bloqueios

### Nível de esforço de implementação
⭐⭐⭐⭐⭐ (Muito alto) — desenvolvimento contínuo

---

## Caminho 6: Arquitetura Híbrida (Recomendado)

### Conceito
Combinar MÚLTIPLAS fontes para máxima precisão e resiliência. Usar cada fonte para o que ela faz melhor.

### Arquitetura proposta
```
┌─────────────────────────────────────────────────────┐
│                 PRICING-AI ENGINE                    │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   CAMADA 1   │  │   CAMADA 2   │  │  CAMADA 3  │ │
│  │  Dados Vivos │  │   Índices    │  │   Macro    │ │
│  │              │  │  Oficiais    │  │            │ │
│  │  Apify API   │  │  FipeZAP     │  │  BCB API   │ │
│  │  (anúncios   │  │  (m² por     │  │  (crédito  │ │
│  │  individuais)│  │   bairro)    │  │  imob.)    │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │                │         │
│         └─────────┬───────┘                │         │
│                   ▼                        │         │
│         ┌─────────────────┐                │         │
│         │   MOTOR DE      │◄───────────────┘         │
│         │   COMPARAÇÃO    │                          │
│         │                 │                          │
│         │ • Match por tipo│                          │
│         │ • Match por zona│                          │
│         │ • Cálculo m²    │                          │
│         │ • Score confiança│                         │
│         └────────┬────────┘                          │
│                  ▼                                   │
│         ┌─────────────────┐                          │
│         │  BASE DE DADOS  │                          │
│         │  DE MERCADO     │                          │
│         │  (Supabase)     │                          │
│         └────────┬────────┘                          │
│                  ▼                                   │
│         ┌─────────────────┐                          │
│         │  RESULTADO      │                          │
│         │  • Preço sugerido│                         │
│         │  • Faixa de m²   │                         │
│         │  • Comparáveis   │                         │
│         │  • Confiança (%) │                         │
│         └─────────────────┘                          │
└─────────────────────────────────────────────────────┘
```

### Funcionamento passo a passo

**Passo 1 — Coleta de anúncios (Apify)**
O Apify busca anúncios reais nas plataformas (VivaReal, OLX, ZapImóveis) com filtros de região e tipo de imóvel.

**Passo 2 — Referência oficial (FipeZAP)**
O índice FipeZAP fornece o preço médio por m² do bairro como âncora de referência.

**Passo 3 — Contexto macro (BCB)**
Dados do Banco Central sobre crédito imobiliário e tendências de mercado.

**Passo 4 — Motor de comparação (IA)**
O motor cruza tudo, filtra por tipo compatível, calcula m² e gera um **score de confiança** baseado na quantidade e qualidade dos dados.

**Passo 5 — Resultado para o usuário**
O frontend exibe: preço sugerido, faixa de preço, lista de comparáveis encontrados, e grau de confiança da estimativa.

### Custos estimados
- Apify Starter: US$ 39/mês
- FipeZAP: gratuito (dados agregados)
- BCB API: gratuito
- Total: ~US$ 39-199/mês dependendo do volume

### Pontos fortes
- Máxima precisão — múltiplas fontes se complementam
- Resiliência — se uma fonte falha, as outras compensam
- Credibilidade — usa índice FIPE como referência oficial
- Dados individuais (Apify) + contexto de mercado (FipeZAP + BCB)
- Custo controlado

### Pontos fracos
- Mais complexo de implementar
- Precisa manter integração com múltiplas fontes
- Lógica de cruzamento de dados requer refinamento contínuo

### Nível de esforço de implementação
⭐⭐⭐ (Médio) — usa APIs prontas, mas precisa construir o motor de comparação

---

## Tabela Comparativa

| Critério | Apify | CASAFARI | DataZAP/FipeZAP | BCB/IBGE | Scraping Próprio | Híbrido |
|----------|-------|---------|-----------------|----------|-----------------|---------|
| **Dados individuais** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Dados agregados** | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Custo mensal** | $39-199 | $$$ alto | Grátis/$$$ | Grátis | $49+ | ~$39-199 |
| **Esforço de dev** | Baixo | Baixo | Médio | Baixo | Muito alto | Médio |
| **Manutenção** | Baixa | Baixa | Média | Baixa | Alta | Média |
| **Precisão** | Média | Alta | Média | Baixa | Média | Alta |
| **Compliance legal** | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ⚠️/✅ |
| **Cobertura Brasil** | 27 estados | Parcial | 56 cidades | Nacional | Qualquer | Ampla |
| **Tempo real** | ✅ | ✅ | Mensal | 60 dias | ✅ | ✅ |
| **Credibilidade** | Média | Alta | Alta (FIPE) | Alta (BCB) | Baixa | Alta |

---

## Minha Recomendação

### Para MVP (começar rápido): **Caminho 1 — Apify**
Começar com o Apify é a forma mais rápida de validar a ideia. Os scrapers já existem, a API é simples, e com US$ 39/mês você consegue testar o conceito completo.

### Para produto maduro: **Caminho 6 — Híbrido**
Quando validar que a funcionalidade gera valor, evoluir para a arquitetura híbrida. Adicionar o FipeZAP como referência oficial dá credibilidade, e o BCB complementa com contexto macro.

### Se orçamento permitir: **Caminho 2 — CASAFARI**
Se o budget permitir, vale explorar a CASAFARI como alternativa ou complemento. O AVM deles já resolve o problema de comparação, e o MCP permite integração direta com agentes de IA.

### Abordagem sugerida (faseada):
1. **Fase 1 (Sprint 1-2)**: Apify only — validar conceito
2. **Fase 2 (Sprint 3-4)**: Adicionar FipeZAP como referência
3. **Fase 3 (Sprint 5+)**: Motor de comparação com IA + base de dados de mercado
4. **Fase 4 (futuro)**: Avaliar CASAFARI ou construir AVM próprio

---

## Próximos Passos

1. Decidir qual caminho seguir (ou combinação)
2. Criar conta no Apify (se for o caminho escolhido)
3. Redesenhar a edge function `pricing-ai` com a nova arquitetura
4. Criar tabelas no Supabase para a base de dados de mercado
5. Implementar o motor de comparação
6. Integrar com o frontend (botão de precificação)

---

*Documento gerado em 07/03/2026 para Intentus Real Estate — Pricing-AI Module*
