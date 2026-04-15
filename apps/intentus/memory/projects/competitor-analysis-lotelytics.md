# Análise Competitiva: Módulo de Parcelamento (Intentus) vs Lotelytics

**Data:** 2026-04-12 (Sessão 152)
**Analista:** Claudinho
**Escopo:** Apenas o módulo de Parcelamento de Solo do Intentus vs Lotelytics inteiro
**URL analisada:** https://lotelytics.com/projeto/85f8e0d1-714f-4770-a964-af2191000a3d

---

## 1. Visão Geral do Lotelytics

**Produto:** Plataforma SaaS de análise de viabilidade para loteamentos
**Foco:** Exclusivamente loteamentos horizontais
**Projeto analisado:** Condomínio Splendori House&Garden II - Piracicaba (920 lotes, 86.59 ha)

### Stack Técnico (idêntico!)
- **Frontend:** React + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (`mjgknpznxyjcaflniijq.supabase.co`)
- **Mapas:** Mapbox GL JS (satellite-streets-v12)

### Edge Functions identificadas
- `analyze-roads` — detecção automática de faixas de servidão (rodovias + linhas de transmissão)
- `get-mapbox-token` — token Mapbox dinâmico
- `check-subscription` — controle de assinatura

---

## 2. Comparativo Feature-a-Feature

### 2.1 Estudo Urbanístico

| Feature | Lotelytics | Parcelamento Intentus | Vencedor |
|---------|-----------|----------------------|----------|
| Upload KMZ | ✅ Upload simples | ✅ Upload + validação kinks (turf.js) | 🟢 Intentus |
| Cálculo área bruta | ✅ m² + ha + centroid | ✅ m² + ha + centroid | Empate |
| Parâmetros urbanísticos | ✅ 6 campos (Pública, Verde, Viário, APP, Servidão, Área min. lote) | ✅ Premissas Profundas 4 abas (mais campos) | 🟢 Intentus |
| **Servidão automática** | ✅ EF `analyze-roads` calcula buffer rodovias+LT automaticamente | ❌ Geo layers mostram rodovias/LT mas NÃO calcula % de servidão auto | 🔴 Lotelytics |
| Resultado distribuição áreas | ✅ Área líquida + total lotes + taxa aproveitamento | ✅ Similar | Empate |
| Indicador qualitativo | ✅ "Excelente aproveitamento" | ❌ Sem indicador textual | 🔴 Lotelytics |
| Auto-aplicar à premissa | ✅ "Dados automaticamente aplicados às premissas" | ✅ Premissas integradas | Empate |

### 2.2 Visualização e Geoespacial

| Feature | Lotelytics | Parcelamento Intentus | Vencedor |
|---------|-----------|----------------------|----------|
| Mapa satellite | ✅ Mapbox satellite-streets-v12 | ✅ Mapbox GL JS | Empate |
| Polígono terreno no mapa | ✅ Contorno azul + APP/rodovias/LT overlay | ✅ Polígono + 5 geo layers (Overpass API) | 🟢 Intentus |
| Topografia 3D | ✅ Interativo (toggle declividade/elevação) | ✅ Three.js terrain viewer + curvas de nível | Empate |
| Dados no 3D | ✅ Área (ha), elevação (m), declividade média (%) | ✅ Similar + corte transversal | 🟢 Intentus |
| Corte transversal | ❌ | ✅ Perfil SRTM ao longo de linha | 🟢 Intentus |
| Áreas de exclusão | ❌ | ✅ Marcação manual de áreas não-edificantes | 🟢 Intentus |
| Export geo | ❌ | ✅ GeoJSON + KML + KMZ + DXF | 🟢 Intentus |
| IBGE dados demográficos | ✅ População + crescimento + PIB | ✅ ibge-census EF v2 (55 municípios, renda, habitação) | 🟢 Intentus |
| MapBiomas | ❌ | ✅ Uso do solo histórico via GEE REST API | 🟢 Intentus |
| Embargos ambientais | ❌ | ✅ IBAMA + ICMBio (Haversine + classificação risco) | 🟢 Intentus |
| Reserva Legal | ❌ | ✅ DataGeo RL (SP) | 🟢 Intentus |

### 2.3 Premissas / Parâmetros do Projeto

| Feature | Lotelytics | Parcelamento Intentus | Vencedor |
|---------|-----------|----------------------|----------|
| **Aba Projeto** | ✅ Nome, tipo, estado, cidade, lotes, área, preço/m², mix de produtos, cronograma | ✅ Premissas Profundas (4 abas: Área, Urbanístico, Financeiro, Cronograma) | Empate |
| Mix de Produtos | ✅ Toggle (residencial, comercial) | ❌ Sem mix explícito | 🔴 Lotelytics |
| Lançamento em Etapas | ✅ Toggle divide projeto em fases | ✅ Cenários salvos | Empate |
| **Aba Vendas** | ✅ 12+ campos detalhados | ✅ Campos similares no modal financeiro | Empate |
| **Perfil Curva de Vendas** | ✅ 4 perfis visuais (Lançamento Forte, Crescimento Orgânico, Ritmo Constante, Fechamento Forte) com mini-gráficos | ❌ Curva linear/customizável mas sem seleção visual de perfis | 🔴 Lotelytics |
| Correção monetária (IPCA) | ✅ Índice + base + taxa adicional | ✅ IPCA base customizável | Empate |
| Comissão de Vendas | ✅ % editável | ✅ Incluído nas premissas | Empate |
| Taxa de Inadimplência | ✅ % editável | ✅ Parametrizado | Empate |
| Administração da Carteira | ✅ Modelo com/sem taxa | ❌ | 🔴 Lotelytics |
| **Aba Terreno** | ✅ Modalidade aquisição (Permuta/Compra), % VGV, aportes ao terreneiro, comissão corretor | ✅ Terreno % permuta nas premissas | 🔴 Lotelytics (mais detalhado) |
| **Aba Custos** — Visão geral | ✅ R$/m² + Total Estimado + Total Pessimista | ✅ Custo infra R$/m² | Empate |
| **Custos SINAPI itemizados** | ✅ 30+ itens com toggle on/off, Un., Qtd., Esperado/Pessimista, Total, Δ% — ref SINAPI SP 02/2026 | ❌ market-benchmarks dá valores agregados (15 composições SINAPI), sem breakdown unitário | 🔴 Lotelytics |
| Categorias de custo | ✅ Pavimentação (5 itens), Drenagem (3), Saneamento (6+), Complementares (3), Fechamento (2), Lazer | ❌ Sem breakdown por categoria | 🔴 Lotelytics |
| Materiais configuráveis | ✅ Paver/Tradicional/Subterrânea com preço | ❌ | 🔴 Lotelytics |
| **Diagrama sistema viário** | ✅ Visual: largura total, pista, calçadas, concreto, comprimento | ❌ | 🔴 Lotelytics |
| **Terraplanagem por declividade** | ✅ Usa dados 3D reais, custo por 5 faixas (0-5%, 5-10%, 10-18%, 18-25%, >25%), % intervenção por faixa | ❌ Temos 3D e declividade mas não calculamos custo de terraplanagem por faixa | 🔴 Lotelytics |
| Projetos, Licenças, Marketing | ✅ 3 campos + parcelamento + registro/lote | ✅ Incluído nas premissas | Empate |
| Taxas e Contingências | ✅ Percentuais sobre VGV/custos | ✅ Contingência parametrizada | Empate |
| **Seguro Garantia** | ✅ Tipo, %, taxa anual, pagamento, prêmio estimado, vigência | ❌ | 🔴 Lotelytics |

### 2.4 Análise Financeira

| Feature | Lotelytics | Parcelamento Intentus | Vencedor |
|---------|-----------|----------------------|----------|
| VPL | ✅ Com taxa customizável | ✅ Newton-Raphson + bisection | Empate |
| TIR | ✅ Retorno anualizado | ✅ | Empate |
| ROI | ✅ "Para cada R$ 1 investido: R$ X" | ✅ | Empate |
| Margem Bruta | ✅ | ✅ | Empate |
| Capital Necessário | ✅ Pico de exposição financeira | ✅ Exposição de caixa | Empate |
| 3 Cenários | ✅ Conservador/Ideal/Agressivo com cards | ✅ Cenários salvos + comparação | Empate |
| **Simulação de Parcela** | ✅ Valor lote, entrada, 1ª parcela, última, variação | ❌ | 🔴 Lotelytics |
| Custos Pré-Venda vs Durante Vendas | ✅ Breakdown claro (o que exige capital vs o que paga com receita) | ❌ Breakdown não tão claro na UI | 🔴 Lotelytics |
| Distribuição de Recebíveis | ✅ Desenvolvedor X% vs Terreneiro Y% | ✅ Permuta calculada | Empate |
| Curva de Vendas (gráfico) | ✅ Lotes/mês + acumulado + pico + mês 50% | ✅ Similar no tab Fluxo de Caixa | Empate |
| VGV Gross vs Net | ✅ Com explicação detalhada | ✅ VGV Banner (Bloco K) | Empate |
| Payback | ✅ Em meses | ✅ Simples + descontado | 🟢 Intentus |
| Impostos Lucro Presumido | ✅ R$ + % do VGV | ✅ RET 4% (Lei 10.931/04) + presumido | 🟢 Intentus |
| **Monte Carlo** | ❌ | ✅ 1000-10000 iterações, distribuição triangular | 🟢 Intentus |
| **Análise de Sensibilidade** | ✅ Tab "Sensibilidade" | ✅ Tornado chart ±20% (VGV, custo, velocidade, taxa) | Empate |
| **Fronteira Eficiente** | ✅ Tab "Fronteira" | ✅ Markowitz adaptado (50-100 combinações equity/debt) | Empate |
| Performance Score | ❌ | ✅ Score 0-100 ring (4 dimensões) | 🟢 Intentus |
| Estrutura de Capital | ❌ Apenas visão no gráfico | ✅ Tab dedicada (donut equity vs debt) | 🟢 Intentus |
| **Fluxo de Caixa com fases** | ✅ Fases coloridas (Preparação/Obra/Obra+Vendas/Recebimentos) com timeline visual e duração | ✅ Tab Fluxo de Caixa com Recharts mas sem fases coloridas tão claras | 🔴 Lotelytics (UX) |
| **Cronograma visual** | ✅ Timeline: Preparação Xm → Obra Xm → Vendas Xm → Recebimentos Xm com cores e ícones | ❌ Sem timeline visual de fases | 🔴 Lotelytics |

### 2.5 Conformidade Legal e Regulatória

| Feature | Lotelytics | Parcelamento Intentus | Vencedor |
|---------|-----------|----------------------|----------|
| Checklist Lei 6.766/79 | ❌ | ✅ 14 items | 🟢 Intentus |
| Checklist Lei 4.591/64 | ❌ | ✅ 8 items | 🟢 Intentus |
| Score de compliance | ❌ | ✅ 0-100 com parecer textual | 🟢 Intentus |
| RAG jurídico | ❌ | ✅ pgvector + Gemini 2.0 Flash | 🟢 Intentus |
| Knowledge Base jurídica | ❌ | ✅ Ingest PDF + chunking + embeddings | 🟢 Intentus |
| Regulações municipais | ❌ | ✅ brazil-regulations EF (ITBI, outorga, lei verde, CNPJ SPE) | 🟢 Intentus |
| Zoneamento municipal | ❌ | ✅ zoneamento-municipal EF (PDF analysis) | 🟢 Intentus |
| Memorial descritivo | ❌ | ✅ memorial-descritivo EF (Lei 6.015/73) | 🟢 Intentus |
| CRI/Matrícula | ❌ | ✅ cri-matricula EF | 🟢 Intentus |

### 2.6 Relatórios e Exportação

| Feature | Lotelytics | Parcelamento Intentus | Vencedor |
|---------|-----------|----------------------|----------|
| **Relatório Executivo** | ✅ | ✅ PDF 2 páginas (capa + KPIs) | Empate |
| **Relatório de Custos** | ✅ Dedicado | ❌ Custos dentro do PDF técnico | 🔴 Lotelytics |
| **Relatório Terreneiro** | ✅ Específico para dono do terreno | ❌ | 🔴 Lotelytics |
| Relatório Adiantamento | ✅ (condicional) | ❌ | 🔴 Lotelytics |
| **Auditoria Financeira** | ✅ Análise detalhada | ❌ | 🔴 Lotelytics |
| PDF Técnico | ❌ | ✅ 15 seções completas | 🟢 Intentus |
| Excel export | ❌ | ✅ 11 abas | 🟢 Intentus |
| Share links (público) | ❌ | ✅ Token + expiry + access counting | 🟢 Intentus |

### 2.7 CAD / Projeto Urbanístico

| Feature | Lotelytics | Parcelamento Intentus | Vencedor |
|---------|-----------|----------------------|----------|
| CAD Studio nativo | ❌ | ✅ Fabric.js + Mapbox dual-layer | 🟢 Intentus |
| DXF import/export | ❌ | ✅ DXF R12 generator 10 layers | 🟢 Intentus |
| Export urbanístico | ❌ | ✅ urbanistic-project-export EF (DXF+PDF) | 🟢 Intentus |

### 2.8 IA e Automação

| Feature | Lotelytics | Parcelamento Intentus | Vencedor |
|---------|-----------|----------------------|----------|
| Copilot IA | ❌ | ✅ v22 com 46 tools (16 módulos) | 🟢 Intentus |
| Parse Contract IA | ❌ | ✅ Gemini 2.0 Flash | 🟢 Intentus |
| FII/CRA Simulator | ❌ | ✅ NPV, IRR, WAL tranches | 🟢 Intentus |

### 2.9 Gestão de Projetos

| Feature | Lotelytics | Parcelamento Intentus | Vencedor |
|---------|-----------|----------------------|----------|
| Dashboard com filtros | ❌ (lista simples) | ✅ Filtros por cidade, VGV, score | 🟢 Intentus |
| Status workflow | ❌ | ✅ 8 estados com transições | 🟢 Intentus |
| Soft delete / Lixeira | ❌ | ✅ Trash + restore | 🟢 Intentus |
| Comparador lado-a-lado | ❌ | ✅ Multi-projeto | 🟢 Intentus |
| Documentos do projeto | ✅ Upload + busca | ✅ Drive integrado | Empate |

---

## 3. PLACAR FINAL

| Categoria | Lotelytics ganha | Intentus ganha | Empate |
|-----------|-----------------|----------------|--------|
| Estudo Urbanístico | 2 | 1 | 4 |
| Geo / Visualização | 0 | 8 | 3 |
| Premissas / Parâmetros | 8 | 0 | 7 |
| Análise Financeira | 3 | 4 | 8 |
| Conformidade Legal | 0 | 9 | 0 |
| Relatórios | 3 | 3 | 1 |
| CAD | 0 | 3 | 0 |
| IA | 0 | 3 | 0 |
| Gestão | 0 | 4 | 1 |
| **TOTAL** | **16** | **35** | **24** |

---

## 4. GAPs Prioritários (onde Lotelytics ganha)

### P0 — Implementar nas próximas 2-3 sessões

| # | GAP | Descrição | Esforço |
|---|-----|-----------|---------|
| 1 | **Detecção automática de servidão** | Buffer de rodovias + LT sobre polígono, calculando % automaticamente. Pode reutilizar dados do Overpass API que já temos no geo-layers. | 1 sessão |
| 2 | **Custos SINAPI itemizados** | Expandir market-benchmarks para 30+ itens unitários (pavimentação, drenagem, saneamento, complementares, fechamento) com toggle on/off, custo esperado/pessimista, cálculo automático de quantidades a partir da área viária | 2 sessões |
| 3 | **Terraplanagem por declividade** | Integrar dados de elevation/3D que já temos para calcular custo de terraplanagem por faixa de declividade (0-5%, 5-10%, 10-18%, 18-25%, >25%) com R$/m² diferente por faixa e % de intervenção | 1 sessão |

### P1 — Sprint seguinte

| # | GAP | Descrição | Esforço |
|---|-----|-----------|---------|
| 4 | **Diagrama visual do sistema viário** | Seção transversal da via (largura, pista, calçadas, meio-fio) como SVG/React interativo | 0.5 sessão |
| 5 | **Perfis visuais de curva de vendas** | 4 cards com mini-gráficos: Lançamento Forte, Crescimento Orgânico, Ritmo Constante, Fechamento Forte | 0.5 sessão |
| 6 | **Cronograma visual com fases** | Timeline colorida no fluxo de caixa: Preparação → Obra → Obra+Vendas → Recebimentos | 0.5 sessão |
| 7 | **Simulador de parcela individual** | Widget mostrando valor do lote, entrada, 1ª parcela, última parcela, variação % | 0.5 sessão |

### P2 — Backlog

| # | GAP | Descrição | Esforço |
|---|-----|-----------|---------|
| 8 | Relatório do Terreneiro | PDF/view específico para owner do terreno (receita permuta, cronograma aportes) | 1 sessão |
| 9 | Auditoria Financeira | Relatório detalhado de auditoria com premissas vs resultados | 0.5 sessão |
| 10 | Seguro Garantia calculator | Tipo, % garantia, taxa anual, prêmio estimado, vigência | 0.5 sessão |
| 11 | Custos Pré-Venda vs Durante Vendas (UX) | Separar visualmente o que exige capital próprio vs pago com receita | 0.5 sessão |
| 12 | Mix de Produtos | Toggle para tipologias diferentes (comercial, residencial, misto) com preços distintos | 1 sessão |
| 13 | Administração da Carteira | Modelo com/sem taxa no recebível | 0.5 sessão |

---

## 5. Conclusão

**Placar:** Intentus 35 × 16 Lotelytics (+ 24 empates)

O módulo de Parcelamento do Intentus é **significativamente mais completo** que o Lotelytics em: geoespacial (8×0), conformidade legal (9×0), CAD (3×0), IA (3×0), e gestão (4×0).

O Lotelytics ganha em **Premissas/Custos detalhados (8×0)** — esse é o ponto forte deles. Os custos de infraestrutura SINAPI itemizados com 30+ itens, terraplanagem por declividade integrada ao 3D, e o diagrama de sistema viário são features muito bem executadas e que nosso módulo precisa ter.

**Estratégia:** Incorporar os 3 GAPs P0 (servidão automática, SINAPI itemizado, terraplanagem/declividade) nas próximas 2-4 sessões para eliminar a principal vantagem competitiva do Lotelytics. Os 4 GAPs P1 são polimentos de UX que podem ser feitos em 2 sessões adicionais.

Após fechar esses GAPs, o módulo de Parcelamento do Intentus será **estritamente superior** ao Lotelytics em todas as categorias.

---

## 6. Engenharia Reversa — Edge Function `analyze-roads`

### 6.1 Arquitetura Geral

A ferramenta de mapeamento de interferência do Lotelytics funciona com a seguinte arquitetura:

```
[Frontend] → supabase.functions.invoke("analyze-roads", { body: { polygon, grossArea, projectId } })
     ↓
[Edge Function Deno] → Busca rodovias/ferrovias/linhas de transmissão na região do polígono
     ↓
[Retorno] → { roadsGeoJSON, bufferGeoJSON, clippedBufferGeoJSON, affectedAreaM2, affectedPercent, affectedByType, bufferMeters }
     ↓
[Frontend] → Recalcula percentuais client-side + renderiza overlays no Mapbox + persiste cache em `urban_studies.road_analysis`
```

### 6.2 Request (Frontend → EF)

```typescript
// Invocação via Supabase JS client
const { data } = await supabase.functions.invoke("analyze-roads", {
  body: {
    polygon: GeoJSON.Feature<Polygon>,  // polígono do terreno (do KMZ)
    grossArea: number,                   // área bruta em m²
    projectId: string                    // UUID do projeto
  }
});
```

### 6.3 Response (EF → Frontend)

```typescript
interface RoadAnalysisResult {
  roadsGeoJSON: FeatureCollection<LineString>;      // linhas originais das rodovias/ferrovias/LT
  bufferGeoJSON: FeatureCollection<Polygon>;        // buffers ao redor de cada linha
  clippedBufferGeoJSON: FeatureCollection<Polygon>; // buffers CLIPADOS ao polígono do terreno
  affectedAreaM2: number;                           // área total afetada em m²
  affectedPercent: number;                          // % da área bruta afetada
  bufferMeters: number;                             // raio do buffer (padrão: 15m)
  affectedByType: {
    road: { areaM2: number; percent: number };      // rodovias
    railway: { areaM2: number; percent: number };   // ferrovias
    powerline: { areaM2: number; percent: number }; // linhas de transmissão
  };
}
```

### 6.4 Lógica da Edge Function (Deno)

**Fonte de dados:** A EF NÃO usa WFS, WMS, Geoserver, ou Overpass API. A referência "DNIT" no bundle é do **SICRO** (custos rodoviários), NÃO de dados geoespaciais. Não existe NENHUMA tabela geo no Supabase deles (28 tabelas listadas, zero com dados espaciais). A fonte de geometrias de rodovias, ferrovias e linhas de transmissão está **100% dentro da Edge Function** (Deno server-side). Duas possibilidades: (a) A EF faz fetch a uma API externa em tempo real (Overpass API, OpenRouteService, ou API gov.br) que não aparece no bundle porque roda no servidor; (b) A EF usa dados hardcoded/lookup de infraestrutura principal por região. Usa `bbox` para filtrar espacialmente.

**Algoritmo (inferido da análise do bundle):**

1. **Recebe** o polígono + grossArea + projectId
2. **Calcula bbox** do polígono para limitar a busca espacial
3. **Busca features** (rodovias, ferrovias, linhas de transmissão) que intersectam o bbox
4. **Classifica** cada feature por tipo: `road`, `railway`, `powerline`
5. **Aplica buffer** de 15 metros ao redor de cada LineString (faixa de servidão)
6. **Clippa** os polígonos de buffer pelo polígono do terreno (intersection geométrica)
7. **Calcula área** de cada buffer clipado
8. **Soma** áreas por tipo → `affectedByType`
9. **Calcula** `affectedPercent = totalAffected / grossArea * 100`
10. **Retorna** GeoJSON das linhas, buffers e buffers clipados + métricas

### 6.5 Processamento Client-Side (Frontend)

O frontend tem lógica adicional significativa:

1. **Cache:** O resultado é salvo em `urban_studies.road_analysis` (coluna JSONB) para evitar re-chamadas
2. **Detecção de formato antigo:** Console log "[RoadAnalysis] Old segmented format detected, forcing re-analysis" — há migração de formatos
3. **Recálculo client-side:** Se o formato retornado é antigo, o frontend recalcula os percentuais:
   ```
   affectedPercent = round((road.percent + railway.percent + powerline.percent) * 10) / 10
   ```
4. **Estimativa por segmentos:** Quando o clipado não está disponível, usa "line-segment estimation with terrain polygon" — calcula overlap por segmento de linha dentro do polígono
5. **Persistência:** Após recálculo, atualiza o DB: `.update({road_analysis: Q}).eq("id", projectId)`
6. **Renderização Mapbox:** Adiciona 3 layers ao mapa:
   - Linhas das rodovias/ferrovias/LT (LineString)
   - Buffers como polígonos semi-transparentes (fill layer)
   - Buffers clipados (intersection com terreno) em cor mais intensa

### 6.6 Visualização no Mapa

O resultado visual mostra:
- **Polígono azul** — contorno do terreno
- **Overlay vermelho/rosa** — faixa de servidão de rodovias (buffer 15m clipado)
- **Overlay amarelo** — linhas de transmissão (se houver)
- **Card de resumo:** "Faixa de Servidão: 11.4% — Composição: Rodovias 10.5%, L. Transmissão 1.0%"

### 6.7 Tabelas do Banco de Dados

| Tabela | Coluna relevante | Uso |
|--------|-----------------|-----|
| `urban_studies` | `road_analysis` (JSONB) | Cache do resultado da EF |
| `sinapi_reference_values` | Toda a tabela | Custos unitários SINAPI |
| `projects` | Dados do projeto | Metadados |

---

## 7. Proposta de Implementação para o Intentus

### 7.1 EF `analyze-easements` (equivalente ao `analyze-roads`)

**Vantagem competitiva:** Já temos os dados! Nossa EF `development-geo-layers` v2 já busca rodovias federais e linhas de transmissão via Overpass API. Só faltam 3 coisas:

1. **Buffer geométrico** — aplicar buffer de N metros ao redor de cada feature
2. **Clip pelo polígono** — intersectar buffers com o polígono do terreno
3. **Cálculo de área** — somar áreas por tipo e calcular percentuais

**Stack proposto:**
- **Turf.js no Deno** (`@turf/buffer`, `@turf/intersect`, `@turf/area`) — ou implementar buffer/intersect manualmente com geometria computacional
- **Overpass API** — já integrada no `development-geo-layers` v2
- **Tipos de feature:** `road` (highway=primary/secondary/tertiary), `railway`, `powerline` (power=line)
- **Buffers padrão:** Rodovias 15m, Ferrovias 30m, Linhas de Transmissão 20m (configurável)

**Estimativa:** 1 sessão para implementar (reutilizando 80% do código do geo-layers)

### 7.2 Diferencial vs Lotelytics

Podemos ir **além** do que eles fazem:
- **Buffers configuráveis** por tipo (Lotelytics usa 15m fixo pra tudo)
- **APP automática** — detectar cursos d'água e calcular APP (30m, 50m, 100m conforme Código Florestal)
- **Integração com Reserva Legal** — já temos DataGeo RL
- **Copilot integration** — Tool #47: "analyze_easements" no Copilot v23
