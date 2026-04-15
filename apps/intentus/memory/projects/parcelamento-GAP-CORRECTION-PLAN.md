# Plano de Correção — GAPs Parcelamento vs Lotelytics

**Criado:** 2026-04-12 (Sessão 152)
**Contexto:** Após análise competitiva completa + engenharia reversa do `analyze-roads` do Lotelytics.
**Objetivo:** Eliminar as vantagens competitivas do Lotelytics nas próximas 4-5 sessões.

---

## Diagnóstico Resumido

O Lotelytics vence o Intentus em **uma única categoria: Premissas/Custos detalhados (8×0)**.

Os 3 GAPs P0 desta categoria são:
1. **Servidão automática** — nós temos o dado (Overpass), falta o processamento geométrico
2. **SINAPI itemizados** — nós temos médias agregadas, falta o detalhamento por item
3. **Terraplanagem por declividade** — nós temos o 3D/elevation, falta o cálculo de custo por faixa

---

## SESSÃO 153 — Bloco N1: Detecção Automática de Servidão

### US-N1.1: Edge Function `analyze-easements` (P0)

**Problema:** Quando o usuário sobe um KMZ, ele NÃO sabe automaticamente quanto da área está comprometida por faixas de servidão de rodovias e linhas de transmissão.

**Solução:** Nova EF que recebe o polígono do terreno, busca rodovias + LT via Overpass API, aplica buffer legal por tipo, clipa pelo polígono e retorna percentuais.

#### Arquitetura da EF

```
POST /functions/v1/analyze-easements
Body: {
  polygon: GeoJSON.Feature<Polygon>,  // polígono do KMZ
  grossArea: number,                   // área bruta m²
  projectId: string                    // UUID do development
}

Response: {
  success: boolean,
  data: {
    roadsGeoJSON: FeatureCollection<LineString>,      // linhas brutas encontradas
    bufferGeoJSON: FeatureCollection<Polygon>,         // buffers por feature
    clippedGeoJSON: FeatureCollection<Polygon>,        // buffers clipados ao polígono
    totalAffectedM2: number,
    totalAffectedPercent: number,
    affectedByType: {
      road:      { areaM2: number; percent: number; count: number },
      railway:   { areaM2: number; percent: number; count: number },
      powerline: { areaM2: number; percent: number; count: number },
      waterway:  { areaM2: number; percent: number; count: number }  // APP bônus
    },
    bufferMeters: {
      road: number,       // 15m padrão (rodovias municipais/estaduais)
      railway: number,    // 30m (ferrovias - Lei 11.483/2007)
      powerline: number,  // configurable por tensão (20-70m - Lei 12.783/2013)
      waterway: number    // 30m APP (Código Florestal)
    }
  }
}
```

#### Algoritmo Interno (Deno)

```typescript
// Passo 1: Calcular bbox do polígono
const bbox = calcBbox(polygon); // [minLon, minLat, maxLon, maxLat]

// Passo 2: Buscar features via Overpass API (já temos isso no geo-layers!)
// DELAY 500ms entre queries para não estourar rate limit
const queries = [
  buildOverpassQuery(bbox, 'highway', ['primary','secondary','tertiary','trunk','motorway']),
  buildOverpassQuery(bbox, 'power', ['line']),
  buildOverpassQuery(bbox, 'railway', ['rail','subway']),
  buildOverpassQuery(bbox, 'waterway', ['river','stream','canal'])
];

// Passo 3: Buffer por tipo (Turf.js no Deno)
// @turf/buffer aceita meters + GeoJSON
const buffered = features.map(f => {
  const dist = getBufferDistance(f.type); // 15 / 30 / 20 / 30
  return turf.buffer(f, dist, { units: 'meters' });
});

// Passo 4: Clip pelo polígono (turf.intersect)
const clipped = buffered
  .map(b => turf.intersect(b, polygon))
  .filter(Boolean);

// Passo 5: Calcular área por tipo
const areas = calcAreasByType(clipped, polygon.grossArea);
// turf.area() em m² para cada feature clipada

// Passo 6: Retornar + salvar cache em developments.easement_analysis (JSONB)
```

#### Turf.js no Deno

Importações necessárias via esm.sh:
```typescript
import { buffer }    from 'https://esm.sh/@turf/buffer@7';
import { intersect } from 'https://esm.sh/@turf/intersect@7';
import { area }      from 'https://esm.sh/@turf/area@7';
import { bbox }      from 'https://esm.sh/@turf/bbox@7';
import { featureCollection } from 'https://esm.sh/@turf/helpers@7';
```

> ⚠️ Alternativa mais leve: implementar buffer de LineString manualmente (offset de coordenadas). Mais rápido de boot, sem dependência.

#### Migração de Banco

```sql
-- Adicionar coluna de cache na tabela developments
ALTER TABLE developments 
ADD COLUMN IF NOT EXISTS easement_analysis JSONB,
ADD COLUMN IF NOT EXISTS easement_analyzed_at TIMESTAMPTZ;
```

---

### US-N1.2: Frontend — Tab "Servidão" no ParcelamentoDevelopment (P0)

**Onde adicionar:** Nova aba "Servidão" dentro das tabs do ParcelamentoDevelopment (ao lado das tabs existentes: Mapa, Geo Layers, 3D, etc.)

**Componentes:**

```tsx
// src/components/parcelamento/ParcelamentoEasements.tsx

interface EasementAnalysisProps {
  developmentId: string;
  polygon: GeoJSON.Feature<Polygon> | null;
  grossArea: number;
}

// Card de resumo (igual ao Lotelytics):
// "Faixa de Servidão Total: 11.4%"
// Composição: Rodovias 10.5% | Ferrovias 0.8% | Linhas Transmissão 1.0% | APP 0.9%

// Mapa Mapbox com overlays:
// - Polígono azul (terreno)
// - Fill vermelho/rosa (faixa rodovias)
// - Fill amarelo (faixa linhas transmissão)
// - Fill roxo (faixa ferrovias)
// - Fill verde escuro (APP)

// Botão "Analisar Servidão" → chama EF → mostra skeleton/loading

// Diferencial vs Lotelytics: buffers configuráveis por tipo
// "Ajustar buffers" → modal com sliders (15m, 30m, 20m)
```

**Hook:**
```typescript
// src/hooks/useEasementAnalysis.ts
export function useEasementAnalysis(developmentId: string) {
  // Carrega cache do banco se existir
  // Expõe: analyze(), data, isLoading, error, lastAnalyzedAt
}
```

**Integração com Premissas Profundas:**
- Após análise, o resultado de `totalAffectedPercent` é auto-aplicado no campo "Servidão (%)" nas Premissas Profundas
- Toast: "✅ Faixa de Servidão atualizada automaticamente: 11.4%"

---

### US-N1.3: Copilot v23 — Tool `analyze_easements` (P0)

```typescript
// Tool #47 no copilot EF
{
  name: 'analyze_easements',
  description: 'Detecta automaticamente faixas de servidão (rodovias, ferrovias, linhas de transmissão, APP) que intersectam o polígono do projeto e calcula o percentual de área comprometida',
  parameters: {
    project_id: { type: 'string', required: true }
  }
}
```

---

## SESSÃO 154 — Bloco N2: SINAPI Itemizado

### US-N2.1: Tabela DB `sinapi_line_items` (P0)

Hoje temos `market-benchmarks` com 15 composições SINAPI agregadas por categoria.
Precisamos de **30+ itens individuais** com custo unitário + quantidades calculadas automaticamente.

```sql
CREATE TABLE sinapi_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_sinapi TEXT NOT NULL,           -- ex: "95995"
  descricao TEXT NOT NULL,               -- ex: "CBUQ camada rolamento 5cm"
  categoria TEXT NOT NULL,               -- pavimentacao|drenagem|saneamento|complementares|fechamento|lazer
  unidade TEXT NOT NULL,                 -- m², m³, m, un, verba
  custo_esperado DECIMAL(12,2) NOT NULL, -- R$/unidade - referência SINAPI
  custo_pessimista DECIMAL(12,2) NOT NULL,
  regiao TEXT DEFAULT 'SP',              -- UF de referência
  mes_ref TEXT NOT NULL,                 -- ex: "02/2026"
  fonte TEXT DEFAULT 'SINAPI',           -- SINAPI|SICRO|mercado
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: 30+ itens baseados na análise do Lotelytics
-- Pavimentação (5 itens): CBUQ, bloco intertravado, meio-fio, pintura faixa, calçada
-- Drenagem (3 itens): boca de lobo, tubos PVC, galeria
-- Saneamento (6 itens): rede água, rede esgoto, caixa inspeção, ligações, ETE, ETA
-- Complementares (3 itens): iluminação pública, paisagismo, sinalização vertical
-- Fechamento (2 itens): muro perímetro, portaria/guarita
-- Lazer (2 itens): playground, área verde
```

### US-N2.2: EF `sinapi-detailed-calc` (P0)

```typescript
// Actions: get_items | calc_quantities | save_customization | get_project_costs

// calc_quantities: dado viario_area (m²) e total_lots, calcula automaticamente:
// - Pavimentação: 1.0 × viario_area m²
// - Drenagem: 0.8 × viario_area m² (estimativa)
// - Saneamento: lotes × fator padrão
// etc.
```

### US-N2.3: Frontend — Tab "Custos Detalhados" (P0)

```tsx
// src/components/parcelamento/ParcelamentoCustosDetalhados.tsx

// Estrutura:
// ┌─────────────────────────────────────────────────────────┐
// │ Custos de Infraestrutura — SINAPI SP 02/2026            │
// │ Área Viária: 12.450 m²  |  Lotes: 156  |  Total: R$ XX │
// ├─────────────────────────────────────────────────────────┤
// │ PAVIMENTAÇÃO                                    R$ xxx  │
// │ ☑ CBUQ 5cm    95995+104375    m²  12.450  R$65  R$68   │
// │ ☑ Bloco inter 74138           m²  12.450  R$85  R$95   │
// │ ☑ Meio-fio    73960           m   1.560   R$35  R$42   │
// ├─────────────────────────────────────────────────────────┤
// │ DRENAGEM                                        R$ xxx  │
// │ ☑ Boca lobo   72898           un  28      R$1.2k R$1.5k│
// ...
// ├─────────────────────────────────────────────────────────┤
// │ RESUMO: Esperado R$ 4.2M | Pessimista R$ 5.1M          │
// │ Por lote: R$ 26.9k | Por m²: R$ 48.50                  │
// └─────────────────────────────────────────────────────────┘

// Features:
// - Toggle por item (include/exclude)
// - Editar quantidade manualmente
// - Editar custo unitário (override do padrão SINAPI)
// - Auto-calcular quantidades do viário (botão "Calcular auto")
// - Sync com campo "Custo Infra (R$/m²)" nas Premissas
```

---

## SESSÃO 155 — Bloco N3: Terraplanagem por Declividade

### US-N3.1: Integração Elevation × Custo (P0)

**Contexto técnico:**
- Já temos `development-elevation` EF que retorna grid de elevações (SRTM 30m)
- Já temos ThreeJS 3D viewer com shader de declividade (4 faixas de cores)
- **Falta:** traduzir cada faixa de declividade → custo de terraplanagem R$/m²

**Tabela de referência (SINAPI/SICRO - mercado):**
| Faixa | Declividade | Custo Corte R$/m³ | Custo Aterro R$/m³ | Custo Consolidado R$/m² |
|-------|------------|------------------|-------------------|------------------------|
| Plano | 0% - 5% | R$ 8 | R$ 5 | R$ 15 |
| Ondulado leve | 5% - 10% | R$ 18 | R$ 12 | R$ 35 |
| Ondulado forte | 10% - 18% | R$ 35 | R$ 25 | R$ 65 |
| Montanhoso | 18% - 25% | R$ 65 | R$ 45 | R$ 120 |
| Escarpado | >25% | R$ 120 | R$ 80 | R$ 220 |

### US-N3.2: EF `earthwork-calc` (P0)

```typescript
// Actions: calculate | save_result | get_result

// Input: project_id (busca elevation grid do banco)
// Output:
{
  slopeDistribution: [
    { range: '0-5%',   areaM2: 45000, areaPercent: 52.0, costM2: 15,  totalCost: 675000 },
    { range: '5-10%',  areaM2: 28000, areaPercent: 32.3, costM2: 35,  totalCost: 980000 },
    { range: '10-18%', areaM2: 10000, areaPercent: 11.5, costM2: 65,  totalCost: 650000 },
    { range: '18-25%', areaM2: 3000,  areaPercent: 3.5,  costM2: 120, totalCost: 360000 },
    { range: '>25%',   areaM2: 700,   areaPercent: 0.8,  costM2: 220, totalCost: 154000 }
  ],
  totalEarthworkCost: 2819000,
  costPerM2Weighted: 32.5,    // média ponderada
  criticalAreaPercent: 4.3,   // % acima de 18% (montanhoso+escarpado)
  recommendation: "15% da área requer terraplanagem especial..."
}
```

### US-N3.3: Frontend — Seção "Terraplanagem" na Tab 3D (P0)

```tsx
// Adicionar abaixo do viewer 3D existente:

// ┌─────────────────────────────────────────────────────────┐
// │ Análise de Terraplanagem por Declividade                │
// ├────────────────┬────────────┬───────────┬──────────────┤
// │ Faixa          │ Área       │ %         │ Custo Total  │
// ├────────────────┼────────────┼───────────┼──────────────┤
// │ 0-5% (plano)  │ 45.000 m²  │ 52%       │ R$ 675k      │
// │ 5-10%         │ 28.000 m²  │ 32%       │ R$ 980k      │
// │ 10-18%        │ 10.000 m²  │ 11.5%     │ R$ 650k      │
// │ 18-25%        │ 3.000 m²   │ 3.5%      │ R$ 360k      │
// │ >25% (crítico)│ 700 m²     │ 0.8%      │ R$ 154k      │
// ├────────────────┼────────────┼───────────┼──────────────┤
// │ TOTAL          │ 86.700 m² │ 100%      │ R$ 2.82M     │
// └────────────────┴────────────┴───────────┴──────────────┘
// Custo médio ponderado: R$ 32.50/m²
// ⚠️ 4.3% da área requer terraplanagem especial (>18%)

// Barra de progresso colorida por faixa (igual ao 3D shader)
// Sync: atualiza campo "Terraplanagem (R$/m²)" nas Premissas Profundas

// Custos configuráveis: "Ajustar custos por faixa" → table editável
```

---

## SESSÃO 156 — Bloco N4: P1 UX/Polimentos

### US-N4.1: Diagrama Visual Sistema Viário (P1)

```tsx
// src/components/parcelamento/ViarioSection.tsx
// SVG interativo mostrando corte transversal da via:
// [Recuo] [Calçada] [Valeta] [Pista] [Canteiro?] [Pista] [Valeta] [Calçada] [Recuo]
// Larguras em metros, editáveis via input
// Total = soma de todas as faixas
// Auto-calcula % do sistema viário sobre área total
```

### US-N4.2: Perfis Visuais de Curva de Vendas (P1)

```tsx
// 4 cards com mini-gráficos Recharts (sparklines)
// Lançamento Forte: pico no mês 1-3, cauda longa
// Crescimento Orgânico: curva ascendente gradual
// Ritmo Constante: barra plana, igual todo mês
// Fechamento Forte: aceleração no final

// Ao selecionar perfil → alimenta array de velocidades mensais nas Premissas
```

### US-N4.3: Cronograma Visual com Fases no Fluxo de Caixa (P1)

```tsx
// Adicionar timeline colorida ACIMA do gráfico de fluxo de caixa
// [Preparação Xm] [Obra Xm] [Obra+Vendas Xm] [Recebimentos Xm]
// Cores: cinza → laranja → verde → azul
// Gerado automaticamente dos campos de cronograma nas Premissas
```

### US-N4.4: Simulador de Parcela Individual (P1)

```tsx
// Widget no card de análise financeira:
// Valor do lote: R$ 180.000
// Entrada (20%): R$ 36.000
// 1ª parcela: R$ 1.847
// Última parcela (60x): R$ 1.975 (+6.9% IPCA)
// Total pago: R$ 154.820
```

---

## Plano de Sessões

| Sessão | Bloco | User Stories | EFs | Entregável |
|--------|-------|-------------|-----|-----------|
| **153** | N1 - Servidão | US-N1.1 + N1.2 + N1.3 | `analyze-easements` v1 | Aba Servidão funcionando + Copilot v23 |
| **154** | N2 - SINAPI | US-N2.1 + N2.2 + N2.3 | `sinapi-detailed-calc` v1 | Tab Custos Detalhados com 30+ itens |
| **155** | N3 - Terraplanagem | US-N3.1 + N3.2 + N3.3 | `earthwork-calc` v1 | Seção Terraplanagem no 3D |
| **156** | N4 - UX P1 | US-N4.1..N4.4 | nenhuma nova | 4 melhorias de UX |

**Total:** 4 sessões → **GAP fechado completamente**. Intentus superior ao Lotelytics em todas as categorias.

---

## Dependências Técnicas

### `analyze-easements` EF

- **Reutiliza:** Lógica Overpass da `development-geo-layers` v2 (90% igual)
- **Novo:** Turf.js buffer + intersect + area no Deno
- **Turf no Deno:** `https://esm.sh/@turf/buffer@7` — testar import no início da sessão
- **Alternativa sem Turf:** Buffer de LineString manual via fórmula geodésica (mais rápido, mais robusto)
- **Cache:** `developments.easement_analysis` (JSONB) — mesma estratégia do `road_analysis` do Lotelytics

### `sinapi-detailed-calc` EF

- **Reutiliza:** Padrão de EF de tabelas lookup (igual ao `market-benchmarks`)
- **Novo:** Tabela `sinapi_line_items` com seed de 30+ itens
- **Quantidades auto:** Calculadas a partir de `viario_area` (já calculada nas premissas)

### `earthwork-calc` EF

- **Reutiliza:** Dados de `development-elevation` (grid de elevações SRTM já salvo no banco)
- **Novo:** Algoritmo de cálculo de declividade + agrupamento em faixas + custo por faixa
- **Crítico:** Verificar se elevation grid já tem resolução suficiente para calcular slope (SRTM 30m = ok para faixas de 5%)

---

## Diferenciais vs Lotelytics (o que faremos MELHOR)

| Feature | Lotelytics | Intentus v153+ |
|---------|-----------|----------------|
| Buffer de servidão | 15m fixo para tudo | **Configurável por tipo + legal** (15m rodovia, 30m ferrovia, 20-70m LT por tensão, 30m APP) |
| Tipos de interferência | Road + Railway + Powerline | **+ APP (cursos d'água)** = 4 tipos |
| Integração | Só aplica % a uma premissa | **Destaca no mapa + aplica em todas premissas relevantes** |
| SINAPI | SP 02/2026 fixo | **Multi-UF, atualização mensal via MES_REF** |
| Terraplanagem | 5 faixas de custo fixo | **Custos editáveis por faixa + justificativa SICRO** |
| Copilot | ❌ | **Tool analyze_easements + earthwork_summary** |

---

## Critérios de Aceite por US

### US-N1.1 (analyze-easements EF)
- [ ] EF deployada e retornando `affectedByType` com road/railway/powerline/waterway
- [ ] Buffer correto: 15m roads, 30m railway, 20m powerline, 30m waterway
- [ ] Clip pelo polígono funcionando (área retornada ≤ área bruta)
- [ ] Cache em `developments.easement_analysis` (JSONB)
- [ ] Tempo de resposta < 15s

### US-N1.2 (Tab Servidão)
- [ ] Botão "Analisar Servidão" visível na aba
- [ ] Loading skeleton durante análise
- [ ] Overlays coloridos por tipo no Mapbox
- [ ] Card de resumo com total + composição
- [ ] Auto-preenchimento do campo "Servidão (%)" nas Premissas
- [ ] Resultado cacheado — recarregar não refaz análise

### US-N2.3 (Custos Detalhados)
- [ ] 30+ itens SINAPI listados por categoria
- [ ] Toggle per-item funcionando (incluir/excluir)
- [ ] Quantidades calculadas automaticamente do viário
- [ ] Override manual de quantidade e custo
- [ ] Total esperado e pessimista calculado
- [ ] Sync com campo "Custo Infra (R$/m²)" nas Premissas

### US-N3.3 (Terraplanagem)
- [ ] Tabela de distribuição por faixa
- [ ] Custo total por faixa e consolidado
- [ ] Custo médio ponderado em R$/m²
- [ ] Alerta se área crítica (>18%) > 10%
- [ ] Sync com "Terraplanagem (R$/m²)" nas Premissas

---

## Notas de Implementação

1. **Overpass rate limit:** Delay de 500ms entre queries sequenciais (já aprendido no geo-layers v2)
2. **Turf.js no Deno:** Usar esm.sh — testar no início. Se não funcionar, implementar buffer manualmente (fórmula: ponto a cada 1° ao redor de cada coordenada da linha, dist em graus = meters/111320)
3. **SRTM para slope:** `slope = atan2(dZ, dX)` onde dZ é diferença de elevação e dX é distância horizontal. Para SRTM 30m: dX = 30m → slope = atan2((z[i+1]-z[i]), 30) * 180/π
4. **Auth pattern:** Manter `getUser(token)` com opções `persistSession: false, autoRefreshToken: false` (padrão sistêmico da sessão 151)
5. **Coluna `easement_analysis`:** Verificar se `developments` ou `development_parcelamento` é a tabela certa (lembrar que é `developments`!)
