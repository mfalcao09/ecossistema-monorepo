# Parcelamento de Solo — Gap Analysis Completo

> **Data:** 10/04/2026 (Sessão 137)
> **Objetivo:** Mapear TUDO que falta para completar o módulo de parcelamento conforme PRD v0.2 (145 US) + Bloco E (60 US)
> **Total de User Stories:** 205
> **Já implementadas:** ~77 US (~38%)
> **Pendentes:** ~128 US (~62%)
> **Sessões estimadas totais:** 33-51 sessões

---

## BLOCO E — CAD Studio Nativo (Intentus Land Designer)
**Status:** 🟡 PRD v1.0 CRIADO | **Sessões:** 11-17 | **US pendentes:** 60

O usuário precisa desenhar lotes, quadras e vias dentro do Intentus sem sair para AutoCAD.

| # | Funcionalidade | US | Complexidade | Valor |
|---|---------------|-----|-------------|-------|
| 1 | Editor 2D básico (Fabric.js + Mapbox dual-layer, ferramentas de desenho, snap, layers, cotas, zoom/pan, undo/redo, save) | E01-E12, E24-E25 | Alta | Crítico |
| 2 | Ferramentas de loteamento (split polygon, agrupamento quadras, nomenclatura automática, gerador de via por linha central, arcos, buffer/offset, anotações) | E13-E20, E22-E23 | Alta | Crítico |
| 3 | Painel de resumo em tempo real (áreas por categoria) + alertas de conformidade | E18-E20, E58 | Média | Alto |
| 4 | Import DXF (parse, preservar layers, geo-referenciar, editar) | E26-E30 | Média-Alta | Alto |
| 5 | Export DXF (maker.js, layers, cotas, textos) | E31-E32 | Média | Alto |
| 6 | Conversão DWG→DXF via Edge Function | E33-E34 | Média | Médio |
| 7 | Import/Export GeoJSON + Shapefile | E35 | Baixa | Médio |
| 8 | Projeção 2D→3D sobre terreno (pipeline coord, colorização por tipo, curvas de nível 3D, corte/aterro, screenshot) | E36-E42 | Média | Alto |
| 9 | IA Generativa de Layout (rule-based, 3 variantes, topografia, editável, financeiro automático, comparação, otimização) | E43-E52 | Alta | Muito Alto |
| 10 | Integração profunda (sync urbanistic_params, recálculo financeiro/legal, planta no PDF, 3D sync, PostGIS, compartilhamento) | E53-E60 | Média | Alto |

---

## BLOCO F — Premissas Profundas (Paridade Lotelytics)
**Status:** 🔴 NÃO INICIADO | **Sessões:** 3-5 | **US pendentes:** 13

Hoje o módulo financeiro (Bloco A) usa parâmetros urbanísticos simples. O Lotelytics tem um modal de premissas com 4 abas e catálogo SINAPI completo. Precisamos parear.

| # | Funcionalidade | US | Complexidade | Valor |
|---|---------------|-----|-------------|-------|
| 1 | Modal "Editar Premissas" com 4 abas (Projeto/Vendas/Terreno/Custos) + auto-save | US-66 | Média | Crítico |
| 2 | Aba Projeto: nome, tipo (aberto/fechado), total lotes, área média, preço/m², cronograma | US-67 | Baixa | Crítico |
| 3 | Aba Vendas: prazo parcelamento, juros, vendas à vista, desconto, índice correção (IPCA/INCC/IGPM), comissão, inadimplência | US-68 | Média | Crítico |
| 4 | Aba Terreno: modalidade (parcelada/à vista/permuta), valor, parcelas, comissão corretor (split empreendedor/terreneiro) | US-69 | Média | Crítico |
| 5 | Aba Custos overview: R$/m² × total estimado, badge SINAPI, tags contexto | US-70 | Baixa | Alto |
| 6 | Parâmetros do sistema viário + visualização gráfica proporcional em tempo real (Calçada/Pista/Calçada) | US-71 | Média | Alto (wow) |
| 7 | Especificações de acabamento: Pavimentação (Paver/CBUQ), Meio-Fio, Rede Elétrica — com R$/m | US-72 | Baixa | Alto |
| 8 | Tabela de infraestrutura editável: 8 categorias, toggle ON/OFF por item, cenário ideal vs pessimista | US-73, 74 | Alta | Crítico |
| 9 | Terraplanagem do sistema viário baseada em declividade DEM | US-75 | Média | Alto |
| 10 | Taxas e contingências: despesas gerais, contingência, taxa desconto VPL | US-76 | Baixa | Alto |
| 11 | Toggle garantia para prefeitura (seguro garantia / lotes caucionados) | US-77 | Baixa | Médio |
| 12 | Rodapé total consolidado de custos | US-78 | Baixa | Alto |

---

## BLOCO G — Copilot Agentic + IA Proprietária
**Status:** 🟡 PARCIAL | **Sessões:** 5-8 | **US pendentes:** ~15

Copilot v15 está deployado com CORS fix, mas o modo agentic com 12 tools não está funcional no frontend. Esta é a camada que diferencia o Intentus de TODOS os concorrentes.

| # | Funcionalidade | US | Complexidade | Valor |
|---|---------------|-----|-------------|-------|
| 1 | **Copilot Agentic**: chat lateral que entende todo o contexto do projeto e responde perguntas | US-101 | Alta | Muito Alto |
| 2 | **Copilot executa ações**: "Mude o viário para 22% e mostre o impacto" → altera parâmetro e mostra delta | US-102 | Muito Alta | Muito Alto |
| 3 | **Otimizador Automático de Massa**: algoritmo genético + LLM → 5 disposições alternativas de quadras/lotes | US-103, 104 | Muito Alta | Muito Alto |
| 4 | **Recomendador de Infraestrutura**: IA sugere itens SINAPI baseado no perfil do terreno | US-105 | Alta | Alto |
| 5 | **Análise Preditiva**: dado apenas KMZ + localização, IA prediz VPL/TIR em 30s com banda de confiança | US-106 | Alta | Alto |
| 6 | **Gerador de Parecer Técnico**: IA escreve 1-2 pág de parecer estruturado para o PDF | US-107 | Média | Alto |
| 7 | **Comparador Multi-Terreno IA**: ranking de até 10 projetos com pesos customizáveis | US-108 | Média | Alto |
| 8 | **Detector de Red Flags**: IA escaneia e sinaliza riscos não-óbvios | US-109 | Média | Alto |
| 9 | **Sugerir Melhorias**: ao salvar, IA sugere 3 ações para melhorar Performance Score | US-110 | Média | Médio |
| 10 | **Memória de Projetos**: IA aprende com projetos anteriores para recalibrar estimativas | US-111 | Alta | Alto |
| 11 | **Simulador Climático** (P2, futuro pós-2030) | US-112 | Muito Alta | Baixo |
| 12 | **Voice Mode** (P2) | US-113 | Alta | Médio |
| 13 | **Sentiment do Mercado Local**: IA analisa anúncios Zap/Viva Real | US-114 | Alta | Alto |
| 14 | **Auto-PRD do Empreendimento**: IA gera documento executivo do empreendimento | US-115 | Média | Médio |

---

## BLOCO H — Diferenciais Brasil (Integrações Nacionais)
**Status:** 🟡 PARCIAL | **Sessões:** 5-8 | **US pendentes:** ~15

Este é o "moat regional" contra o Lotelytics. Integrações com dados e legislação brasileira que um produto internacional não consegue replicar facilmente.

### Já implementados ✅
- IBGE API (geocoding + renda municipal) ✅
- CAR/SICAR consulta (EF geo-layers) ✅
- Checklist Lei 6.766/79 (Bloco B) ✅
- APP Lei 12.651/2012 (buffers + cálculo) ✅
- Google Geocoding (IBGE API faz esse papel) ✅

### Pendentes 🔴

| # | Funcionalidade | US | Complexidade | Valor |
|---|---------------|-----|-------------|-------|
| 1 | **MapBiomas via Google Earth Engine**: histórico 10 anos uso/cobertura do solo | US-117 | Alta | Muito Alto |
| 2 | **Catálogo SINAPI mensal** por estado (pipeline ingestão CEF) | US-121 | Alta | Crítico |
| 3 | **Benchmarks SECOVI** (preço/m² por cidade, velocidade venda) | US-122 | Média | Alto |
| 4 | **Benchmarks ABRAINC** (% lançamentos por região) | US-123 | Média | Alto |
| 5 | **IBGE renda por setor censitário** (Performance Score com base local) | US-124 | Média | Alto |
| 6 | **Detector de zoneamento municipal** (OCR + LLM sobre Plano Diretor) | US-125 | Muito Alta | Muito Alto |
| 7 | **Detector de área embargada** (IBAMA/ICMBio) | US-126 | Média | Alto |
| 8 | **Cálculo ITBI** estimado por município (1-3%) | US-127 | Baixa | Médio |
| 9 | **Outorga onerosa** (conforme plano diretor) | US-128 | Baixa | Médio |
| 10 | **Lei do Verde municipal** (SP e outras cidades) | US-129 | Baixa | Médio |
| 11 | **Memorial Descritivo automático** (formato Cartório, Lei 6.015/73) | US-130 | Alta | Muito Alto |
| 12 | **Pré-projeto urbanístico** exportável para prefeituras (DWG via ConvertAPI) | US-131 | Média | Alto |
| 13 | **Validação CNPJ** incorporador/SPE via Receita Federal | US-132 | Baixa | Baixo |
| 14 | **Integração CRI** consulta matrícula (quando API disponível) | US-133 | Média | Médio |
| 15 | **Simulação FII/CRA** securitização de recebíveis | US-134, 135 | Alta | Baixo (P2) |

---

## BLOCO I — Integração CRM/CLM/Relationship
**Status:** 🔴 NÃO INICIADO | **Sessões:** 3-5 | **US pendentes:** 10

Fechar o ciclo completo: estudo de viabilidade → contrato → CRM → relacionamento. Transforma o parcelamento em módulo que alimenta toda a plataforma.

| # | Funcionalidade | US | Complexidade | Valor |
|---|---------------|-----|-------------|-------|
| 1 | Projeto "Viável" → cria lead/oportunidade no CRM automaticamente | US-136 | Média | Muito Alto |
| 2 | Lote vendido → unidade no CRM (twin digital com dados geo/financeiro) | US-137 | Alta | Muito Alto |
| 3 | Gerar contrato de terreno via CLM (template parametrizado) | US-138 | Média | Alto |
| 4 | Contrato de compra e venda por lote via CLM | US-139 | Média | Alto |
| 5 | Prospects de compradores → Relationship Module (nurturing) | US-140 | Baixa | Alto |
| 6 | Churn risk no Relationship (inadimplência → scoring) | US-141 | Média | Médio |
| 7 | **Pipeline Kanban**: Captado→Estudo→Viável→Negociação→Fechado→Obra→Vendas→Encerrado | US-142 | Média | Muito Alto |
| 8 | **Dashboard executivo portfolio** (9 de 120 projetos · VGV · VPL) | US-143 | Média | Muito Alto |
| 9 | Multi-tenant para squads (cada squad vê só seus projetos) | US-144 | Média | Alto |
| 10 | Webhook/API pública para integrar com ERPs externos | US-145 | Alta | Médio |

---

## BLOCO J — Geoespacial Avançado (Lacunas)
**Status:** 🟡 PARCIAL | **Sessões:** 2-3 | **US pendentes:** ~5

A base geoespacial é sólida, mas faltam features P1 que completam a paridade com Lotelytics.

| # | Funcionalidade | US | Complexidade | Valor |
|---|---------------|-----|-------------|-------|
| 1 | **Export geometria** em KMZ, KML, Shapefile, GeoJSON, DWG/DXF | US-60 | Média | Alto |
| 2 | **Upload ortomosaico** GeoTIFF/ECW + render como camada raster | US-61 | Alta | Médio |
| 3 | **Corte transversal** do terreno em qualquer eixo (clique → perfil) | US-63 | Média | Alto |
| 4 | **Áreas de exclusão custom** (lago, risco) + recálculo automático | US-65 | Média | Médio |
| 5 | **Validação KMZ** (auto-intersectante, área zero, projeção) + correção automática | US-62 | Média | Alto |

---

## BLOCO K — Relatórios e Exportação
**Status:** 🟡 PARCIAL | **Sessões:** 2-3 | **US pendentes:** ~5

Temos o PDF executivo (2 páginas). Faltam os relatórios profundos e formatos de exportação.

| # | Funcionalidade | US | Complexidade | Valor |
|---|---------------|-----|-------------|-------|
| 1 | **Relatório técnico PDF** (10-20 páginas completo: geo+financeiro+legal+3D) | US-29 | Alta | Muito Alto |
| 2 | **Memorial descritivo** automático (formato cartório, Lei 6.015/73) | US-30 | Alta | Muito Alto |
| 3 | **Link expirável** para compartilhar relatório | US-31 | Baixa | Alto |
| 4 | **Export Excel** (dados financeiros + urbanísticos) | US-32 | Média | Alto |
| 5 | VGV de referência permanente (bruto/líquido, aviso de ajuste) | US-100 | Baixa | Alto |

---

## BLOCO L — Gestão de Projetos e Pipeline
**Status:** 🟡 PARCIAL | **Sessões:** 1-2 | **US pendentes:** ~5

Dashboard existe mas faltam funcionalidades de gestão de ciclo de vida dos projetos.

| # | Funcionalidade | US | Complexidade | Valor |
|---|---------------|-----|-------------|-------|
| 1 | **Status com transições** (em análise → viável → rejeitado → monitorando) | US-15 | Baixa | Alto |
| 2 | **Lixeira** + restore por super admin | US-16, 17 | Baixa | Médio |
| 3 | **Convidar colaboradores** com role específico | US-18 | Média | Médio |
| 4 | **Comparar 5 terrenos** lado a lado | US-42 | Alta | Alto |
| 5 | **Filtros avançados** no dashboard (por status, cidade, VGV) | — | Baixa | Médio |

---

## RESUMO EXECUTIVO

| Bloco | Tema | Status | US | Sessões | Impacto no produto |
|-------|------|--------|-----|---------|-------------------|
| **E** | CAD Studio | 🟡 PRD | 60 | 11-17 | Diferenciador — "nunca sai do sistema" |
| **F** | Premissas | 🔴 Zero | 13 | 3-5 | Fundação — alimenta todo o financeiro |
| **G** | Copilot + IA | 🟡 Parcial | 15 | 5-8 | Moat — nenhum concorrente tem |
| **H** | Brasil | 🟡 Parcial | 15 | 5-8 | Moat regional — difícil de copiar |
| **I** | CRM/CLM | 🔴 Zero | 10 | 3-5 | Ciclo completo — estudo→contrato→venda |
| **J** | Geo Avançado | 🟡 80% | 5 | 2-3 | Paridade Lotelytics |
| **K** | Relatórios | 🟡 20% | 5 | 2-3 | Valor para investidores |
| **L** | Gestão | 🟡 60% | 5 | 1-2 | UX de portfolio |
| **TOTAL** | — | — | **128** | **33-51** | — |
