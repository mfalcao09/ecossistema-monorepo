# PRD — Bloco E: CAD Studio Nativo (Intentus Land Designer)

> **Versão:** 1.0
> **Owner:** Marcelo Silva (CEO Intentus)
> **Engenharia:** Claudinho + Buchecha (pair programming obrigatório)
> **Skills aplicadas:** `saas-product`, `real-estate`, `engineering:architecture`
> **Data:** 10/04/2026
> **Sessão:** 137
> **Status:** 🟡 PRD EM REVIEW — aguardando aprovação de Marcelo + review Buchecha
> **Pré-requisitos:** Blocos A-D completos ✅

---

## 0. Contexto e Motivação

### O que já temos (Blocos A-D)
- **Bloco A**: Engenharia Financeira — 8 abas (VPL, TIR, Monte Carlo, Sensibilidade, Fronteira Eficiente)
- **Bloco B**: Conformidade Legal — RAG pgvector + Lei 6.766 + Lei 4.591 + análise IA
- **Bloco C**: PDF Executivo — relatórios profissionais para investidores
- **Bloco D**: Visualização 3D — Three.js terrain viewer com DEM mesh

### O que falta (Bloco E)
Hoje, o usuário **precisa sair do Intentus** para:
1. Desenhar o projeto urbanístico (vai para AutoCAD/Civil 3D)
2. Subdividir lotes e quadras (vai para AutoCAD ou planilha)
3. Importar/exportar arquivos de engenheiros parceiros (DXF/DWG manual)
4. Projetar o loteamento sobre a topografia real (processo manual em GIS)

**Visão de Marcelo:** "Quero que meu usuário não saia do sistema para desenhar mais nada. Quero as funcionalidades mais completas possíveis."

### Inspiração
- **AutoCAD Web** (Autodesk): ferramentas de desenho 2D precisas no browser, layers, snap, cotas
- **CAD-Viewer** (open-source): editor DXF/DWG completo no browser sem backend
- **Lot Layout Designer**: ferramenta gratuita de desenho de lotes com snap e medidas
- **Lotelytics**: contexto imobiliário + geo-referenciamento (já temos paridade nos Blocos A-D)

---

## 1. Problema

Incorporadores e loteadores que usam o Intentus hoje conseguem **analisar** um terreno completo (geo, financeiro, legal, 3D), mas **não conseguem projetar** o loteamento dentro da plataforma. Isso gera:

1. **Dependência de software externo**: AutoCAD, Civil 3D, QGIS (~R$ 8-15k/ano por licença)
2. **Processo desconectado**: dados financeiros e legais não se comunicam com o desenho do projeto
3. **Retrabalho**: projetar no CAD → exportar → importar no Intentus → ajustar parâmetros manualmente
4. **Barreira técnica**: incorporador precisa contratar engenheiro SÓ para o desenho (custo + tempo)
5. **Sem feedback em tempo real**: não sabe se o layout atende Lei 6.766 até um especialista revisar

---

## 2. Visão do Produto — Intentus Land Designer

Um **editor CAD 2D nativo no browser**, geo-referenciado sobre Mapbox, com:

- **Ferramentas de desenho tipo AutoCAD**: linhas, polígonos, arcos, cotas, snap-to-grid, layers
- **Contexto imobiliário integrado**: cada lote desenhado alimenta automaticamente os cálculos financeiros (Bloco A) e a análise legal (Bloco B)
- **Import/Export DXF**: interoperabilidade total com escritórios de engenharia
- **Projeção 2D→3D**: ver o loteamento desenhado sobre o terreno 3D (Bloco D)
- **IA generativa de layout**: sugestão automática de distribuição otimizada de lotes
- **Validação legal em tempo real**: alertas imediatos quando o desenho viola Lei 6.766/79

### Resultado esperado
O incorporador entra com um terreno (KML/KMZ) e sai com:
1. Projeto urbanístico completo desenhado
2. Estudo de viabilidade financeira calculado automaticamente
3. Análise de conformidade legal em tempo real
4. Visualização 3D do empreendimento
5. Relatório PDF profissional
6. Arquivo DXF exportado para protocolar na prefeitura

**Tudo sem sair do Intentus.**

---

## 3. Personas

### 3.1 Marcelo (incorporador/founder)
Quer desenhar esboços rápidos de loteamento para avaliar viabilidade antes de contratar engenheiro. Precisa de ferramentas intuitivas, não precisa da complexidade total do AutoCAD.

### 3.2 Urbanista/Engenheiro parceiro
Profissional que faz o projeto urbanístico oficial. Quer importar DXF do AutoCAD, ajustar no Intentus com dados do terreno já carregados, e exportar de volta.

### 3.3 Incorporador parceiro
Precisa de ferramenta simples para subdividir lotes e ver impacto financeiro em tempo real. Não sabe usar AutoCAD.

### 3.4 Investidor/Fundo
Quer visualizar o projeto urbanístico proposto junto com os números financeiros. Não desenha — consome.

---

## 4. Arquitetura Técnica — Decisões-Chave

### 4.1 Stack de Desenho 2D

| Opção | Prós | Contras | Decisão |
|-------|------|---------|---------|
| **Fabric.js** | Excelente para manipulação de objetos, transformações precisas, constraints | Não é geo-referenciado nativamente | ✅ **RECOMENDADO** para o canvas CAD |
| **Mapbox GL Draw** | Geo-referenciado nativo, snap plugin existe | Limitado para CAD preciso (sem cotas, sem arcos) | ✅ **Complementar** — para desenho simples sobre mapa |
| **Konva.js** | Boa performance | Melhor para games, não para CAD | ❌ |
| **Paper.js** | Bom para vetores | Comunidade menor | ❌ |
| **OpenLayers** | Geo nativo, snap interactions | Pesado, curva de aprendizado alta | ❌ |

**Decisão arquitetural:** Abordagem **dual-layer**:
- **Camada Mapa** (Mapbox GL JS): visualização geo-referenciada, layers de contexto (APP, hidrografia, SICAR)
- **Camada CAD** (Fabric.js overlay): ferramentas de desenho preciso sobrepostas ao mapa, com conversão coordenadas pixel↔geo via projeção Mercator

### 4.2 Geometria e Cálculos

| Biblioteca | Função |
|-----------|--------|
| **Turf.js** | Cálculos geoespaciais (área, buffer, intersect, union, difference) — já usamos |
| **proj4js** | Conversão de coordenadas (WGS84 ↔ UTM ↔ pixel canvas) |
| **earcut** | Triangulação de polígonos (para projeção 3D) |
| **Fabric.js** | Manipulação de objetos 2D (snap, align, transform) |

### 4.3 DXF Import/Export

| Biblioteca | Função | Status |
|-----------|--------|--------|
| **dxf-parser** | Parse de DXF → objetos JS | Maduro, estável |
| **dxf-render** | Render de 21+ tipos de entidades DXF | Integra com Three.js |
| **maker.js** | Geração de DXF a partir de geometria JS | Para export |
| **Conversão DWG→DXF** | Via backend (LibreDWG ou API Autodesk) | DWG é proprietário — browser não parseia |

**Decisão:** DXF é formato primário (aberto, parseável no browser). DWG via conversão server-side (Edge Function com LibreDWG ou serviço externo).

### 4.4 Projeção 2D→3D

O TerrainViewer3D (Bloco D) já renderiza o mesh DEM. Para projetar lotes:
1. Pegar coordenadas 2D do lote desenhado no canvas
2. Converter para coordenadas geográficas (via proj4js)
3. Consultar elevação no DEM para cada vértice
4. Gerar geometria 3D extrudida sobre o mesh
5. Renderizar como overlay no Three.js existente

### 4.5 IA de Layout Generativo

**Fase 1 (rule-based):** Algoritmo de grid tessellation com constraints:
- Input: perímetro do terreno + regras (lote mínimo, % área verde, % viário, setbacks)
- Processo: gerar grid → aplicar constraints → otimizar via backtracking
- Output: proposta de quadras/lotes/vias

**Fase 2 (ML — futuro):** Treinar modelo com projetos urbanísticos reais aprovados em prefeituras brasileiras. Dataset: projetos públicos de loteamento + regras municipais.

---

## 5. User Stories

### 5.1 Módulo CAD — Editor 2D (US-E01 a US-E25)

| ID | Como... | Eu quero... | Para... |
|---|---|---|---|
| US-E01 | Usuário | Abrir o editor CAD a partir de um projeto de parcelamento existente | Desenhar o loteamento sobre o terreno já importado |
| US-E02 | Usuário | Ver o terreno (KML) renderizado como polígono sobre o mapa Mapbox | Ter referência visual do perímetro |
| US-E03 | Usuário | Desenhar linhas retas com snap-to-grid e snap-to-vertex | Traçar arruamento e divisas de lotes com precisão |
| US-E04 | Usuário | Desenhar polígonos fechados (lotes) com cálculo automático de área | Definir cada lote individualmente |
| US-E05 | Usuário | Ver cotas (dimensões) automaticamente ao lado de cada segmento desenhado | Saber as medidas sem precisar medir manualmente |
| US-E06 | Usuário | Usar ferramenta de offset/buffer para criar recuos (setbacks) | Definir área non-aedificandi conforme legislação |
| US-E07 | Usuário | Gerenciar layers (quadras, lotes, vias, áreas verdes, APP, infraestrutura) | Organizar o projeto por camada como no AutoCAD |
| US-E08 | Usuário | Ativar/desativar layers individualmente | Focar no que estou editando sem poluição visual |
| US-E09 | Usuário | Usar Undo/Redo ilimitado | Experimentar sem medo de errar |
| US-E10 | Usuário | Dar zoom, pan e rotacionar o canvas com mouse wheel + drag | Navegar fluentemente pelo projeto |
| US-E11 | Usuário | Ver escala dinâmica (barra de escala + grid métrico) | Manter noção de proporção real |
| US-E12 | Usuário | Selecionar, mover, rotacionar e redimensionar objetos desenhados | Ajustar o projeto iterativamente |
| US-E13 | Usuário | Dividir um polígono existente em dois com uma linha de corte | Subdividir quadras em lotes rapidamente |
| US-E14 | Usuário | Agrupar lotes em quadras e nomear (Q-01, Q-02, etc.) | Organizar o projeto urbanístico |
| US-E15 | Usuário | Numerar lotes automaticamente dentro de cada quadra (L-01, L-02, etc.) | Seguir padrão de nomenclatura oficial |
| US-E16 | Usuário | Desenhar arcos e curvas (concordância de vias) | Projetar rotatórias e curvas de rua |
| US-E17 | Usuário | Definir largura de via e gerar faixa automaticamente a partir de uma linha central | Traçar vias rapidamente sem desenhar as duas bordas |
| US-E18 | Usuário | Ver área total de cada categoria (lotes, vias, verde, institucional, APP) atualizada em tempo real | Acompanhar se estou dentro dos percentuais da Lei 6.766 |
| US-E19 | Usuário | Receber alerta visual quando um lote tem área menor que o mínimo da Lei 6.766 (125m²) | Evitar irregularidades antes de protocolar |
| US-E20 | Usuário | Receber alerta quando % de área verde < 10% ou % viário < 20% | Garantir conformidade legal em tempo real |
| US-E21 | Usuário | Salvar o projeto e retomar depois | Trabalhar em múltiplas sessões |
| US-E22 | Usuário | Ver histórico de versões do projeto (snapshots) | Comparar iterações e reverter se necessário |
| US-E23 | Usuário | Adicionar anotações/textos no canvas | Documentar decisões de projeto |
| US-E24 | Usuário | Usar atalhos de teclado (L=line, P=polygon, M=move, etc.) | Produtividade tipo CAD |
| US-E25 | Usuário | Configurar grid métrico (1m, 5m, 10m, 50m) | Adaptar precisão conforme escala do projeto |

### 5.2 Import/Export DXF (US-E26 a US-E35)

| ID | Como... | Eu quero... | Para... |
|---|---|---|---|
| US-E26 | Usuário | Importar arquivo .dxf por drag-drop | Trazer projetos do AutoCAD para dentro do Intentus |
| US-E27 | Sistema | Parsear entidades DXF (LINE, POLYLINE, LWPOLYLINE, CIRCLE, ARC, TEXT, DIMENSION, HATCH) | Renderizar o projeto importado fielmente |
| US-E28 | Sistema | Preservar layers do DXF original | Manter organização do projetista |
| US-E29 | Sistema | Geo-referenciar o DXF importado sobre o mapa (3 pontos de controle ou coordenadas UTM) | Alinhar o projeto ao terreno real |
| US-E30 | Usuário | Editar o DXF importado com as ferramentas do editor CAD | Ajustar o projeto sem voltar para o AutoCAD |
| US-E31 | Usuário | Exportar o projeto para .dxf | Enviar para o engenheiro/prefeitura |
| US-E32 | Sistema | Incluir no DXF exportado: layers, cotas, textos, blocos | Gerar arquivo profissional compatível com AutoCAD |
| US-E33 | Usuário | Importar arquivo .dwg | Suportar formato mais comum do AutoCAD |
| US-E34 | Sistema | Converter DWG→DXF automaticamente via backend | Permitir import de DWG sem pedir conversão manual ao usuário |
| US-E35 | Usuário | Importar/exportar GeoJSON e Shapefile (.shp) | Interoperar com QGIS e ferramentas GIS |

### 5.3 Projeção 2D→3D (US-E36 a US-E42)

| ID | Como... | Eu quero... | Para... |
|---|---|---|---|
| US-E36 | Usuário | Clicar "Ver em 3D" e ver o loteamento projetado sobre o terreno | Visualizar como os lotes ficam na topografia real |
| US-E37 | Sistema | Projetar polígonos 2D dos lotes sobre o mesh DEM 3D | Mostrar lotes "colados" no relevo |
| US-E38 | Sistema | Colorir lotes por categoria no 3D (residencial, comercial, verde, institucional) | Diferenciar visualmente as áreas |
| US-E39 | Usuário | Ver curvas de nível no 3D junto com os lotes | Entender a relação topografia × loteamento |
| US-E40 | Usuário | Ver cálculo de corte/aterro estimado por quadra | Estimar movimento de terra necessário |
| US-E41 | Usuário | Girar, fazer zoom e orbitar o 3D livremente | Explorar o projeto de qualquer ângulo |
| US-E42 | Usuário | Capturar screenshot do 3D para incluir no relatório PDF | Ilustrar o projeto para investidores |

### 5.4 IA Generativa de Layout (US-E43 a US-E52)

| ID | Como... | Eu quero... | Para... |
|---|---|---|---|
| US-E43 | Usuário | Clicar "Gerar Layout Automático" e receber proposta de loteamento | Ter um ponto de partida sem desenhar do zero |
| US-E44 | Sistema | Gerar layout respeitando: lote mínimo, % verde, % viário, % institucional, APP | Proposta já em conformidade legal |
| US-E45 | Usuário | Definir parâmetros antes da geração (tamanho médio de lote, tipo de empreendimento, padrão) | Customizar a proposta |
| US-E46 | Sistema | Considerar topografia (evitar vias em declividade > 15%) | Proposta viável na prática |
| US-E47 | Sistema | Gerar 3 variantes (conservador/balanceado/agressivo) | Dar opções de comparação ao incorporador |
| US-E48 | Usuário | Editar o layout gerado com as ferramentas CAD | Ajustar a proposta da IA manualmente |
| US-E49 | Sistema | Calcular automaticamente VPL/TIR/VGV do layout gerado | Conectar desenho ao financeiro imediatamente |
| US-E50 | Usuário | Comparar layouts gerados lado a lado (visual + financeiro) | Escolher a melhor opção |
| US-E51 | Sistema | Otimizar layout para maximizar número de lotes (respeitando regras) | Maximizar VGV |
| US-E52 | Sistema | Otimizar layout para minimizar movimento de terra (respeitar topografia) | Minimizar custos de terraplanagem |

### 5.5 Integração com Módulos Existentes (US-E53 a US-E60)

| ID | Como... | Eu quero... | Para... |
|---|---|---|---|
| US-E53 | Sistema | Atualizar automaticamente `parcelamento_urbanistic_params` quando lotes são desenhados | Manter dados sincronizados |
| US-E54 | Sistema | Recalcular financeiro (Bloco A) quando layout muda | Feedback em tempo real do impacto financeiro |
| US-E55 | Sistema | Recalcular compliance legal (Bloco B) quando layout muda | Saber se o novo desenho está conforme |
| US-E56 | Sistema | Incluir planta do loteamento no PDF executivo (Bloco C) | Relatório completo para investidores |
| US-E57 | Sistema | Atualizar visualização 3D (Bloco D) em tempo real | Ver mudanças no 3D ao editar no 2D |
| US-E58 | Usuário | Ver painel lateral com resumo (total lotes, área média, VGV estimado, compliance score) | Ter dashboard do projeto ao lado do editor |
| US-E59 | Sistema | Persistir geometrias dos lotes no banco (PostGIS) com tipagem (lote, via, verde, etc.) | Dados consultáveis e reutilizáveis |
| US-E60 | Usuário | Compartilhar link do projeto com urbanista parceiro (view-only ou edit) | Colaborar com profissionais externos |

---

## 6. Fases de Implementação

### Fase E1 — Fundação: Editor 2D Básico (3-4 sessões)
**Objetivo:** Canvas funcional com ferramentas essenciais sobre mapa Mapbox.

| Step | Entrega | User Stories |
|------|---------|-------------|
| E1.1 | Setup Mapbox + Fabric.js dual-layer architecture | — |
| E1.2 | Ferramentas básicas: line, polygon, select, move, delete | US-E01, E02, E03, E04, E12 |
| E1.3 | Snap-to-grid + snap-to-vertex | US-E03, E25 |
| E1.4 | Layer manager (criar, renomear, toggle visibility) | US-E07, E08 |
| E1.5 | Cotas automáticas (dimensões ao lado de segmentos) | US-E05 |
| E1.6 | Zoom/Pan/Escala dinâmica | US-E10, E11 |
| E1.7 | Undo/Redo + Save/Load (Supabase) | US-E09, E21 |
| E1.8 | Atalhos de teclado | US-E24 |

**Critérios de aceite:**
- Usuário abre editor, vê terreno no mapa, desenha polígonos com snap, vê áreas calculadas
- Salva, fecha, reabre → projeto persiste

### Fase E2 — Especialização: Ferramentas de Loteamento (2-3 sessões)
**Objetivo:** Ferramentas específicas para subdivisão de terrenos.

| Step | Entrega | User Stories |
|------|---------|-------------|
| E2.1 | Ferramenta "Split Polygon" (dividir polígono com linha de corte) | US-E13 |
| E2.2 | Agrupamento em quadras + nomenclatura automática | US-E14, E15 |
| E2.3 | Gerador de via por linha central + largura | US-E17 |
| E2.4 | Arcos e curvas de concordância | US-E16 |
| E2.5 | Buffer/Offset para setbacks | US-E06 |
| E2.6 | Painel de resumo em tempo real (áreas por categoria) | US-E18, E58 |
| E2.7 | Alertas de conformidade legal em tempo real | US-E19, E20 |
| E2.8 | Anotações e textos | US-E23 |
| E2.9 | Versionamento (snapshots) | US-E22 |

**Critérios de aceite:**
- Usuário subdivide terreno em quadras e lotes com nomenclatura
- Vê resumo de áreas atualizado em tempo real
- Recebe alertas quando viola Lei 6.766

### Fase E3 — Interoperabilidade: DXF Import/Export (2-3 sessões)
**Objetivo:** Comunicação bidirecional com AutoCAD e ferramentas GIS.

| Step | Entrega | User Stories |
|------|---------|-------------|
| E3.1 | Parser DXF (dxf-parser + renderer no Fabric.js) | US-E26, E27 |
| E3.2 | Preservação de layers do DXF | US-E28 |
| E3.3 | Geo-referenciamento do DXF (3 pontos de controle ou UTM) | US-E29 |
| E3.4 | Edição do DXF importado | US-E30 |
| E3.5 | Export para DXF (maker.js) | US-E31, E32 |
| E3.6 | Conversão DWG→DXF via Edge Function | US-E33, E34 |
| E3.7 | Import/Export GeoJSON + Shapefile | US-E35 |

**Critérios de aceite:**
- Importa DXF de projeto real do AutoCAD → renderiza corretamente → edita → exporta → abre no AutoCAD sem perda

### Fase E4 — Projeção 2D→3D (1-2 sessões)
**Objetivo:** Ver o loteamento desenhado sobre o terreno 3D.

| Step | Entrega | User Stories |
|------|---------|-------------|
| E4.1 | Pipeline coord 2D → geo → elevação → 3D mesh | US-E36, E37 |
| E4.2 | Colorização por categoria no 3D | US-E38 |
| E4.3 | Curvas de nível no 3D | US-E39 |
| E4.4 | Cálculo de corte/aterro por quadra | US-E40 |
| E4.5 | Screenshot do 3D para PDF | US-E42 |

**Critérios de aceite:**
- Desenha lotes no 2D → clica "Ver 3D" → vê lotes projetados sobre topografia real

### Fase E5 — IA Generativa de Layout (2-3 sessões)
**Objetivo:** IA sugere loteamento otimizado automaticamente.

| Step | Entrega | User Stories |
|------|---------|-------------|
| E5.1 | Edge Function `parcelamento-layout-generator` (rule-based) | US-E43, E44 |
| E5.2 | Configuração de parâmetros pré-geração | US-E45 |
| E5.3 | Consideração topográfica (declividade) | US-E46 |
| E5.4 | 3 variantes geradas | US-E47 |
| E5.5 | Layout editável pós-geração | US-E48 |
| E5.6 | Cálculo financeiro automático por variante | US-E49 |
| E5.7 | Comparação lado a lado | US-E50 |
| E5.8 | Modos de otimização (max lotes vs min terraplanagem) | US-E51, E52 |

**Critérios de aceite:**
- Clica "Gerar Layout" → recebe 3 propostas → cada uma com VPL/TIR calculado → edita a preferida

### Fase E6 — Integração Profunda (1-2 sessões)
**Objetivo:** Conectar tudo aos módulos existentes.

| Step | Entrega | User Stories |
|------|---------|-------------|
| E6.1 | Sync automático → urbanistic_params | US-E53 |
| E6.2 | Recálculo financeiro ao alterar layout | US-E54 |
| E6.3 | Recálculo legal ao alterar layout | US-E55 |
| E6.4 | Planta no PDF executivo | US-E56 |
| E6.5 | 3D sync em tempo real | US-E57 |
| E6.6 | Persistência PostGIS | US-E59 |
| E6.7 | Compartilhamento (view-only / edit) | US-E60 |

---

## 7. Schema de Banco (Novas Tabelas)

```sql
-- Projetos de loteamento desenhados
CREATE TABLE parcelamento_cad_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  development_id UUID NOT NULL REFERENCES parcelamento_developments(id),
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  canvas_state JSONB, -- Fabric.js serialized state
  settings JSONB DEFAULT '{}', -- grid size, snap settings, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Elementos individuais do desenho (lotes, vias, áreas verdes, etc.)
CREATE TABLE parcelamento_cad_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES parcelamento_cad_projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  element_type TEXT NOT NULL CHECK (element_type IN (
    'lote', 'quadra', 'via', 'area_verde', 'area_institucional',
    'app', 'reserva_legal', 'area_lazer', 'infraestrutura', 'annotation'
  )),
  label TEXT, -- "Q-01", "L-05", etc.
  quadra_id UUID REFERENCES parcelamento_cad_elements(id), -- parent quadra for lotes
  geometry GEOGRAPHY(Polygon, 4326) NOT NULL,
  properties JSONB DEFAULT '{}', -- area_m2, perimeter_m, width, depth, etc.
  layer_name TEXT DEFAULT 'default',
  style JSONB DEFAULT '{}', -- fill color, stroke, opacity
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Snapshots (versionamento)
CREATE TABLE parcelamento_cad_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES parcelamento_cad_projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  label TEXT, -- "v1 - layout inicial", "v2 - após ajuste prefeitura"
  canvas_state JSONB NOT NULL,
  elements_snapshot JSONB NOT NULL, -- array of elements at this point
  summary JSONB, -- { total_lotes, area_media, vgv_estimado, compliance_score }
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Layouts gerados por IA
CREATE TABLE parcelamento_ai_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id UUID NOT NULL REFERENCES parcelamento_developments(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  variant TEXT CHECK (variant IN ('conservador', 'balanceado', 'agressivo')),
  optimization_mode TEXT CHECK (optimization_mode IN ('max_lotes', 'min_terraplanagem', 'balanced')),
  parameters JSONB NOT NULL, -- inputs used for generation
  elements JSONB NOT NULL, -- generated lot/block/road geometries
  metrics JSONB, -- { total_lotes, area_media, vgv, vpl, tir, compliance_score, volume_terra_m3 }
  status TEXT DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_cad_elements_project ON parcelamento_cad_elements(project_id);
CREATE INDEX idx_cad_elements_type ON parcelamento_cad_elements(element_type);
CREATE INDEX idx_cad_elements_geometry ON parcelamento_cad_elements USING GIST(geometry);
CREATE INDEX idx_cad_snapshots_project ON parcelamento_cad_snapshots(project_id);
CREATE INDEX idx_ai_layouts_dev ON parcelamento_ai_layouts(development_id);
```

---

## 8. Edge Functions Necessárias

| EF | Descrição | Fase |
|----|-----------|------|
| `cad-project-manager` | CRUD de projetos CAD, save/load canvas state, versionamento | E1 |
| `cad-element-sync` | Sync elementos desenhados → PostGIS + cálculos de área | E1-E2 |
| `dxf-parser` | Parse DXF no server-side (entidades complexas) | E3 |
| `dwg-converter` | Conversão DWG→DXF via LibreDWG | E3 |
| `terrain-projection` | Projeção 2D→3D com query de elevação | E4 |
| `parcelamento-layout-generator` | IA generativa de layout (rule-based) | E5 |
| `cad-integration-hub` | Orquestrador: atualiza financeiro + legal + 3D quando layout muda | E6 |

---

## 9. Riscos e Mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|--------------|---------|-----------|
| R1 | **Fabric.js + Mapbox sync complexo** — manter coordenadas pixel↔geo em sync durante zoom/pan | Alta | Alto | Criar util `geoTransform.ts` robusto; testar com edge cases (zoom extremo, projetos grandes) |
| R2 | **Bundle size do Fabric.js** (~300KB min) | Média | Médio | Lazy load — só carrega quando abre editor CAD |
| R3 | **DXF parsing incompleto** — arquivos CAD reais têm entidades complexas (SPLINE, MTEXT, BLOCK) | Alta | Alto | Fase E3 começa com entidades básicas; entidades não suportadas viram warnings (não erros) |
| R4 | **Performance com muitos elementos** — projeto com 500+ lotes pode travar Fabric.js | Média | Alto | Implementar viewport culling (só renderizar objetos visíveis); considerar WebGL backend do Fabric.js v6 |
| R5 | **IA de layout gera resultados ruins** | Alta | Médio | Começar rule-based (previsível); IA é sugestão, não imposição — sempre editável |
| R6 | **Projeção 2D→3D com erro de alinhamento** | Média | Médio | Pipeline claro: WGS84 → UTM → local 3D com validação em cada step |
| R7 | **DWG proprietário** | Baixa | Baixo | LibreDWG resolve; se falhar, pedir ao usuário converter para DXF (AutoCAD faz em 2 cliques) |

---

## 10. Estimativas

| Fase | Sessões | Complexidade | Dependência |
|------|---------|-------------|-------------|
| E1 — Editor 2D Básico | 3-4 | Alta (fundação) | Nenhuma (começa do zero) |
| E2 — Ferramentas de Loteamento | 2-3 | Alta | E1 |
| E3 — DXF Import/Export | 2-3 | Média-Alta | E1 |
| E4 — Projeção 2D→3D | 1-2 | Média | E1 + Bloco D existente |
| E5 — IA Generativa | 2-3 | Alta | E1 + E2 |
| E6 — Integração | 1-2 | Média | E1 + E2 + Blocos A-D |
| **TOTAL** | **11-17 sessões** | — | — |

---

## 11. Métricas de Sucesso

| Métrica | Target |
|---------|--------|
| Usuário consegue subdividir terreno em lotes sem ajuda | < 15 min |
| DXF importado e renderizado corretamente | > 90% das entidades |
| Layout IA gera proposta válida (dentro da Lei 6.766) | > 80% das vezes |
| Tempo para gerar layout automático | < 30 segundos |
| Projeção 2D→3D sem erro de alinhamento visível | 100% |
| Recálculo financeiro após mudança de layout | < 3 segundos |

---

## 12. Escopo Negativo (NÃO incluído)

- **3D modeling** (edificações, casas): fora do escopo — foco é terreno e lotes
- **BIM integration**: futuro longínquo
- **Colaboração real-time** (Google Docs style): futuro — v1 é single-user com share link
- **Mobile editor**: desktop-first — editor CAD em celular não faz sentido
- **Renderização fotorrealística**: fora — o 3D é analítico, não marketing
- **Impressão A1/A0 direto**: export DXF → imprimir no AutoCAD (padrão do mercado)

---

## 13. Referências Técnicas

- [AutoCAD Web App](https://web.autocad.com/) — referência UX de editor CAD no browser
- [CAD-Viewer (GitHub)](https://github.com/mlightcad/cad-viewer) — editor DXF/DWG open-source no browser
- [Lot Layout Designer](https://lotdesigner.github.io/lotdesigner/) — ferramenta de lotes no browser
- [Fabric.js](http://fabricjs.com/) — biblioteca Canvas para manipulação de objetos 2D
- [Mapbox GL Draw](https://github.com/mapbox/mapbox-gl-draw) — plugin de desenho sobre Mapbox
- [dxf-parser](https://www.npmjs.com/package/dxf-parser) — parser DXF para JavaScript
- [maker.js](https://maker.js.org/) — geração de DXF
- [Turf.js](https://turfjs.org/) — cálculos geoespaciais (já utilizado)
- [proj4js](https://github.com/proj4js/proj4js) — conversão de coordenadas
- Lei 6.766/79 — Parcelamento de Solo Urbano
- Lei 4.591/64 — Incorporações (condomínios de lotes)
