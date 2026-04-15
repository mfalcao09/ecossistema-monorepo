# Parcelamento de Solo — Referência Visual (Lotelytics)

> **Fonte:** Vídeo "Gravação de Tela 2026-04-07 às 05.16.48.mov" (~17min, 41 frames extraídos)
> **Data da análise:** 2026-04-07
> **Produto referência:** Lotelytics.com — plataforma de viabilidade para loteamentos urbanos
> **Status:** Esta é a "estrela do norte" do que o módulo Parcelamento de Solo da Intentus precisa se tornar.

---

## 1. Visão Geral do Produto Observado

**Lotelytics** é uma plataforma SaaS web (browser, sem app nativo) focada em **viabilidade financeira e urbanística de loteamentos**. O fluxo macro é:

```
1. Cadastrar Projeto (nome, localização)
   ↓
2. Upload do Terreno (arquivo KMZ/DWG)
   ↓
3. Definir Parâmetros Urbanísticos (% áreas)
   ↓
4. Processar Topografia (curvas de nível + declividade)
   ↓
5. Definir Premissas (Projeto / Vendas / Terreno / Custos)
   ↓
6. Análise Financeira completa (8 abas)
   ↓
7. Performance Score + Benchmarks de mercado
```

**Posicionamento aparente:** ferramenta para **incorporadores e investidores** avaliarem oportunidades de loteamento — desde a oportunidade de terreno até o cenário financeiro completo, em minutos, com IA assistindo no processamento topográfico.

**Planos visíveis:** Professional, Estrategista (badges no header).

---

## 2. Telas Identificadas (mapa do produto)

### 2.1 Dashboard "Oportunidades de Terreno"
- **Header**: Logo Lotelytics, badges de plano (Professional, Estrategista), botão "+ Novo Projeto"
- **Resumo do Portfólio**: 9 de 120 projetos este ano · VGV R$ 2.3B · VPL R$ 740.9M
- **Filtros de status**: Todos / Análise / Viáveis / Alertas / Quase
- **Cards de projetos** (grid):
  - Nome do projeto
  - Tag de status ("Em Análise", "Lote. Aberto", "Lote. Fechado")
  - Localização (cidade, UF)
  - Quantidade de lotes
  - KPIs financeiros: VPL, TIR, ROI
  - Exposição de Caixa (barra progressiva R$ + %)
  - Data
- **Busca** por nome
- **Toggles** de visualização (grid / lista / mapa)

### 2.2 Modal "Criar Novo Projeto"
- Campo: Nome do Projeto * (placeholder "Ex: Loteamento Vista Verde")
- Campo: Descrição (opcional)
- Campos: Estado * + Cidade * (dropdowns dependentes)
- Botões: Cancelar / Criar Projeto

### 2.3 Tela do Projeto — Estudo Urbanístico
URL pattern: `lotelytics.com/projeto/{uuid}/estudo-urbanistico`

**Etapa 1 — Importar Terreno**
- Upload de arquivo KMZ (Google Earth) ou DWG (AutoCAD)
- Após upload, mostra:
  - Nome do arquivo
  - Área Bruta calculada (m² + ha)
  - Coordenadas do centro (lat/lng)
  - Botão "Trocar Arquivo"

**Visualização do Terreno** (mapa interativo Mapbox + OpenStreetMap + Maxar satellite)
- Polígono do terreno em destaque (azul)
- Camadas sobrepostas com legenda:
  - 🟦 Terreno (área principal)
  - 🟥 APP — Áreas de Preservação Permanente (com %)
  - 🟧 Rodovias (com % de servidão)
  - 🟨 L. Transmissão (linhas de transmissão de energia)
- Controles: zoom, fullscreen, escala (200m)
- Área total exibida no canto superior direito

**Etapa 2 — Parâmetros Urbanísticos**
- Área Pública (%) — default 10,0
- Área Verde (%) — default 5,0
- Sistema Viário (%) — default 25,0
- APP (%) — calculado automaticamente do KMZ (ex: 10,8)
- Faixa de Servidão (%) — calculado (ex: 11,4 — composição: Rodovias 10,5% + L. Transmissão 1,0%)
- Área Mínima do Lote (m²) — default 300
- **Highlight**: bloco amarelo "Áreas com restrição de uso — faixas de domínio não edificantes"
- Tooltips em cada campo (ícone i)

**Etapa 3 — Resultado da Viabilidade Urbanística**
- Total de lotes calculado (ex: 920)
- Área média por lote (ex: 450 m²)

**Processamento de Topografia** (modal/painel lateral)
- Etapas com status (✓/em progresso/aguardando):
  1. Lendo terreno
  2. Buscando elevações (consultando dados de satélite)
  3. Criando superfície
  4. Gerando curvas (calculando curvas de nível)
  5. Finalizando
- Barra de progresso (X de Y pontos processados — ex: 2100/2173)
- Tempo restante estimado (ex: ~37 segundos restantes)

**Mapa de Declividade**
- Visualização com heatmap colorido (verde→amarelo→laranja→vermelho)
- Curvas de nível desenhadas
- Toggle entre "Declividade" / "Elevação"
- Legenda:
  - 🟢 0–10% — Ideal
  - 🟡 10–18% — Atenção
  - 🟠 18–25% — Difícil
  - 🔴 >25% — Inviável
- Mostra área e altimetria total (ex: 86.6ha · 83m · 7.4%)

### 2.4 Modal "Editar Premissas — Cenário Ideal"

Modal grande com 4 abas: **Projeto · Vendas · Terreno · Custos**

#### Aba PROJETO
- Nome do empreendimento
- Tipo de Loteamento: Aberto / Fechado (Condomínio)
- Estado · Cidade
- Total de Lotes · Área Média/Lote (m²) · Preço por m² (R$)
- Mês Início da Obra · Mês Início das Vendas
- Duração da Obra (meses)
- Toggle: "Lançamento em Etapas" — divide o projeto em fases para reduzir exposição de caixa

#### Aba VENDAS
- Prazo Parcelamento (meses) — ex: 180
- Taxa de Juros ao Cliente (% a.m.) — ex: 0,52
- Vendas à Vista (%) — ex: 5,0
- Desconto à Vista (%) — ex: 10,0
- Índice de Correção: IPCA (dropdown)
- IPCA Base (% a.a.) — ex: 0,40
- IPCA+ Taxa Adicional (% a.a.) — ex: 0,00
- Comissão de Vendas (%) — ex: 5,0
- Taxa de Inadimplência (%) — ex: 5,00
- Administração da Carteira → Modelo (dropdown: "Sem taxa de administração", etc.)

#### Aba TERRENO
- Modalidade de Aquisição: Parcelada / À Vista / Permuta
- Valor do Terreno (R$) — ex: 10.000.000,00
- Número de Parcelas
- **Comissão do Corretor** (sub-bloco):
  - Parte do Empreendedor: Valor Fixo (R$) + % do VGV Total
  - Parte do Terreneiro: Valor Fixo (R$) + % do VGV do Terreneiro

#### Aba CUSTOS
**Custo de Infraestrutura** (overview)
- R$/m² de lote (ex: R$ 130) → Total Estimado (ex: R$ 53.843.783)
- Tags: 920 lotes · 450m² médio · 414.182 m² total
- Badge: "SINAPI SP 02/2026" (referência de tabela oficial)

**Parâmetros do Sistema Viário**
- Área Viária (m²) — calculado
- Largura Total (m) · Pista (m) · Calçadas (m) · Concreto/lado (m) · Comprimento (m)
- **Visualização gráfica em tempo real**: desenho da rua com proporções (Calçada/Pista/Calçada) que muda conforme inputs

**Especificações de Acabamento** (3 dropdowns)
- Pavimentação: Paver R$ 116/m² (alto padrão, permeável) etc.
- Estilo Meio-Fio: Tradicional (Formas) etc.
- Rede Elétrica: Subterrânea R$ 900/m (com aviso: "~4x mais caro que aérea, comum em condomínios fechados")

**Itens de Infraestrutura** (tabela editável com toggles ON/OFF por item)
Categorias:
1. **Pavimentação e Calçadas**: Pavimentação (Paver), Base e Sub-Base, Calçada de Concreto, Meio-Fio com/sem Sarjeta
2. **Drenagem Pluvial**: Galeria de Águas Pluviais, Boca de Lobo, PV de Drenagem
3. **Saneamento**: (vários itens)
4. **Energia e Iluminação**: Rede Média Tensão (MT), Rede Baixa Tensão (BT), Transformador, Poste de Concreto, Luminária Pública LED, Aterramento e Proteção
5. **Equipamentos Especiais**: Centro de Reservação, Elevatória de Esgoto, ETE Compacta (com tooltip explicativo + referências KPMG/ABCON 2020 + PLANSAB 2023)
6. **Itens Complementares**: Sinalização Viária, Arborização de Calçadas, Rede de Telecomunicação (Dutos)
7. **Fechamento (Condomínio)**: Muro Perimetral (badge "KMZ" — perímetro tirado do KMZ), Portaria
8. **Áreas de Lazer & Extras**: Adicionar Área de Lazer (lista editável: Clube R$ 15M, Clube 2, etc.)

**Cada linha da tabela mostra**:
- Item (com tooltip)
- Unidade
- Quantidade
- Esp./un (cenário ideal — verde)
- Pess./un (cenário pessimista — vermelho)
- Total Esp. · Total Pess.
- Δ% (variação)

**Terraplanagem do Sistema Viário**
- Toggle ON/OFF
- Distribuição estimada baseada na declividade

**Taxas e Contingências**
- Despesas Gerais (% do VGV) — ex: 3,0
- Contingência (% da infraestrutura) — ex: 10,0
- Taxa de Desconto para VPL (% a.a.) — ex: 12,0

**Garantia para Prefeitura**
- Toggle: "Prefeitura exige garantia para vendas antecipadas?"
- Se ativo: simula impacto de seguro garantia ou lotes caucionados

**Total de Custos** (rodapé)
- Infraestrutura + Projetos + Marketing + Fechamento → R$ X

### 2.5 Análise Financeira (8 abas no projeto)

Tabs visíveis no topo: **Fluxo de Caixa · Recebimentos · Break-Even · Comparação · Sensibilidade · Performance · Estrutura Capital · Fronteira**

#### Aba FLUXO DE CAIXA
- Título: "Fluxo de Caixa Acumulado — Incorporador"
- Subtítulo: "Evolução do caixa ao longo do projeto com fases coloridas"
- Cards de fases:
  - 📋 Preparação: 24 meses
  - 🏗️ Obra: 24 meses (-R$ 53.843.783)
  - 🏗️📈 Obra + Vendas: 34 meses (+R$ 30.335.300)
  - ✅ Recebimentos: 180 meses (+R$ 134.230.152)
- Cronograma do projeto (barras horizontais coloridas com legenda "Obra e vendas simultâneas")
- Gráfico de linha interativo (mês × caixa em R$ Milhões)
  - Tooltip ao hover mostrando: Mês X · Caixa Acumulado · Movimentação do mês
- KPIs no rodapé: Exposição Máxima · Payback (mês) · Lucro Final (mês)

#### Aba RECEBIMENTOS
- "Fluxo de Recebimentos por Ano" — toggle "Valores Brutos"
- Tabela: Ano · Vendas à Vista · Parcelas Recebidas · Total Recebido (Bruto) · Desenvolvedor (Bruto) · Terreneiro (Bruto)
- Linha expansível por ano → "Detalhes Mensais - Ano X" com cada mês detalhado

#### Aba BREAK-EVEN
- (não visualizada em detalhe nos frames, mas existe a tab)

#### Aba COMPARAÇÃO
- "Fluxo de Caixa Acumulado - Comparação"
- 3 linhas no gráfico: 🔴 Conservador · 🟠 Ideal · 🟢 Agressivo
- Subtítulos: Payback Conservador / Ideal / Agressivo (em meses)
- Tooltip mostra os 3 valores num mês
- **Tabela Comparativa Completa**: Métrica × Conservador × Ideal × Agressivo × Trend
  - VPL, TIR, e outras métricas

#### Aba SENSIBILIDADE
- "Análise de Sensibilidade Interativa"
- Sliders (-30% a +30% / -50% a +50% / -10pp a +10pp):
  - Preço de Venda (R$/m²)
  - Velocidade de Vendas (mais lento ↔ mais rápido)
  - Taxa de Inadimplência (em pp)
  - Custo de Infraestrutura
- **VPL Ajustado** (card grande, atualiza ao vivo)
- **TIR Ajustada** (card grande, atualiza ao vivo)
- Mostra delta vs base ("+R$ X" ou "+X%")

#### Aba PERFORMANCE
- **Performance Score** (círculo grande, 0-100) — ex: 80 SCORE
- Comparação com Ideal (badge "+0 acima do ideal · Ideal: 80")
- Barra de progresso "Seu projeto / Potencial máximo"
- 4 KPIs: TIR · Exposição · Acessibilidade · Payback
- Banda inferior: "Salário formal: R$ 3.410/mês (Piracicaba · IBGE 2021)"
- **Cards expansíveis por dimensão** (cada um com peso e benchmark):
  - **Acessibilidade** (Crítico/Excelente): "Parcela: R$ 1.736 (51% da renda)" + barra benchmark + análise textual
  - **TIR**: "TIR de 25.3% a.a. está boa, dentro do esperado para o mercado" + dica de otimização ("Infraestrutura representa 18% do VGV. Uma redução de 10% aumentaria a margem bruta em 1.8 p.p.") + Benchmark ideal ≥ 20% a.a. · Peso 30%
  - **Exposição de Caixa** (Excelente): "18% do CAPEX total. Capital necessário R$ 10.747.957 de R$ 59.723.566" · Benchmark ≤ 30% · Peso 25%
  - **Payback** (Excelente): "9 meses para recuperar investimento"
- Footer: "Benchmarks baseados no mercado brasileiro de loteamentos urbanos (ABRAINC, SECOVI)"

#### Aba ESTRUTURA CAPITAL
- "% Financiamento Externo (Capital de Terceiros)"
- Legenda: Capital Próprio / Empréstimo / Venda Equity
- **Painel esquerdo — Financiamento via Dívida** (Capital de Terceiros)
  - Slider: Percentual do Investimento (0–100%) — ex: 40% / 70%
  - Taxa de Juros (% a.a.) — ex: 12
  - Sistema de Amortização — dropdown: SAC / Price
  - Prazo (meses) · Carência (meses) · Desembolso (mês)
  - Outputs: Valor do Empréstimo · Custo da Dívida (Kd) · Parcela Mensal (SAC) · Total de Juros · **Efeito Alavancagem (+%)**
  - Botão "Importar Estrutura de Capital"
- **Painel direito — Venda de Participação (SCP)** Equity Financing
  - Aviso: "Todos os valores consideram apenas a participação do incorporador (60%), descontando a parte do proprietário da terra (40%) configurada na permuta"
  - Slider: Lotes a Vender (0 - total)
  - Desconto para Investidores (%)
  - Outputs: Entrada de Caixa · Desconto Concedido · Custo Efetivo (a.a.) · Comparação vs Financiamento ("Equity X% mais caro/mais barato")
- **Análise abaixo**: gráfico de barras horizontais comparando -20% / +20% por variável (% Financiamento, Prazo Total, Carência, Taxa de Juros, Mês Desembolso)
- **Análise e Recomendações** (caixinha azul com dica IA): "Carência tem pouco impacto na TIR. Pode negociar carência menor para obter melhor taxa."
- **Bloco Referência - Conceitos de Finanças Corporativas** (acordions expansíveis):
  - WACC e Estrutura de Capital
  - Alavancagem Financeira
  - Equity vs. Debt Financing

#### Aba FRONTEIRA
- "Fronteira Eficiente de Financiamento"
- "Análise da relação entre alavancagem financeira e retorno do capital investido"
- (gráfico de fronteira eficiente — não detalhado nos frames)

#### Outros blocos visíveis
- **Curva de Vendas** (gráfico linha + área): Lotes/Mês × Acumulado, com info "Pico: 90 lotes no mês 1 · Duração: 17 meses · 50% vendido: Mês 7"
- **VGV de Referência (Tabela)**:
  - VGV Gross (R$ 227.800.621) — "Valor de tabela (área × preço/m²) para análise inicial"
  - VGV Net (R$ 196.751.396) — "VGV após comissões (5%), despesas gerais (2.7%) e impostos (5,93%)"
  - Aviso: "O fluxo real considera juros, correção monetária e inadimplência"
  - Card Payback (11 meses)
- **Impostos - Lucro Presumido**: R$ X · X% do VGV (acordion)

### 2.6 Submenu lateral / Outras seções
- Top do projeto: tabs "Estudo Urbanístico" + "Relatórios ▾" (dropdown)
- Botão "Voltar" no topo

---

## 3. Tipos de Arquivo Suportados (visto no upload)

**Aceitos para terreno:**
- `.kmz` (Google Earth) — **principal**, contém polígono + dados associados
- `.dwg` (AutoCAD) — projetos vetoriais
- `.kml` (Google Earth XML)

**Aparentemente também suportados/usados** (vistos no Finder do usuário):
- `.tif` / TIFF — ortomosaicos georreferenciados
- `.ecw` — formato comprimido de imagens georreferenciadas (ER Mapper)
- `.pdf` — relatórios e documentos legais
- `.xlsx` — planilhas auxiliares
- `.pptx` — apresentações

**Mostrado em Downloads/uso real do Marcelo**:
- ORTOMOSAICO TIFF.tif (8,84 GB)
- ORTOMOSAICO ECW.ecw (458 MB)
- PIRACICABA-R00.dwg (4,2 MB)
- Pira_PDF.pdf (107,1 MB)
- APRESENTAÇÃO - SPLENDORI PIRACICABA.pptx
- Polígono Somado- Área Total Bruta 480.452m².kmz (NDAPADO)
- Auditoria_Pira_1_ideal_2026-02-12.xlsx
- Auditoria_Pira_2_ideal_2026-02-12.xlsx

---

## 4. Princípios e Padrões UX Observados

1. **IA-native processing**: barra de progresso visível com etapas humanizadas ("Lendo terreno", "Buscando elevações") — torna a espera transparente e confiável
2. **Cálculo em tempo real**: sliders, inputs e toggles atualizam KPIs instantaneamente (sem botão "Recalcular")
3. **Comparação tripla constante**: Conservador / Ideal / Agressivo aparece em vários lugares (cores 🔴🟠🟢)
4. **Tooltips educativos**: ícones (i) com explicações contextuais — democratiza o acesso a quem não é especialista
5. **Benchmarks de mercado integrados**: SECOVI, ABRAINC, SINAPI, IBGE, KPMG/ABCON, PLANSAB — credibilidade técnica
6. **Visualizações ricas**: mapas (Mapbox), heatmaps de declividade, curvas de nível, gráficos interativos (linha, área, barras), desenhos esquemáticos (rua em proporção real)
7. **Análise de Sensibilidade interativa**: sliders ao vivo são o "wow factor" central
8. **Análise textual gerada por IA**: "Carência tem pouco impacto na TIR. Pode negociar carência menor..." — recomendações em linguagem natural
9. **Modais profundos com tabs**: o modal de Premissas tem 4 tabs, cada uma com 10+ campos — fica organizado
10. **Estado salvo**: indicador "● Salvo" no rodapé do modal (auto-save)
11. **Educação dentro do produto**: bloco "Referência - Conceitos de Finanças Corporativas" com WACC, Alavancagem, Equity vs Debt explicados em acordions
12. **Catálogo SINAPI integrado**: badge "SINAPI SP 02/2026" indica que os custos vêm de tabela oficial atualizada

---

## 5. Stack Técnico Inferido (do que foi observado)

- **Frontend**: web app responsivo (Chrome), provavelmente React/Next.js
- **Mapas**: Mapbox + OpenStreetMap (visto no copyright) + Maxar (satellite)
- **Topografia**: dados de elevação via API de satélite (provavelmente OpenTopography ou similar) — exatamente o que Marcelo já cadastrou no projeto Intentus
- **Processamento KMZ**: parser server-side ou client-side (turf.js?)
- **Geometria**: cálculo de áreas, perímetros, intersecções (APP, faixas de servidão)
- **Cálculo financeiro**: provavelmente engine própria — VPL, TIR, payback, SAC/Price, sensibilidade
- **Benchmarks**: base de dados própria com SECOVI/ABRAINC/SINAPI carregada periodicamente
- **IA**: análises textuais e recomendações (provavelmente LLM, aplicação semelhante ao Copilot Intentus)

---

## 6. Comparação com PRD atual (parcelamento-solo-PRD.md)

**Vou checar alinhamento na próxima etapa.** Alguns pontos óbvios:

✅ **Já estava no PRD/decisões D1-D5:**
- KMZ como entrada principal
- OpenTopography para curvas de nível (D3)
- DWG via ConvertAPI (D2)
- Schema unificado em `developments` (D1)
- 3 placeholders para extensões futuras (D4)
- IA-native desde v0.1 (D5)

🆕 **Observado no Lotelytics que pode ou não estar no PRD (precisa verificar):**
- Análise de sensibilidade interativa com sliders ao vivo
- 8 abas de análise financeira separadas
- Performance Score 0-100 com benchmarks SECOVI/ABRAINC
- Estrutura de Capital: SAC/Price + Equity Financing (SCP)
- Fronteira Eficiente
- Comparação tripla Conservador/Ideal/Agressivo em todos os gráficos
- Catálogo SINAPI integrado e atualizado mensalmente
- Mapa de declividade com 4 classes
- Visualização esquemática da rua (largura, calçadas, pista) atualizando em tempo real
- Itens de infraestrutura editáveis em tabela com toggle ON/OFF (8 categorias: Pavimentação, Drenagem, Saneamento, Energia, Equipamentos Especiais, Complementares, Fechamento, Áreas de Lazer)
- Cálculo de garantia para prefeitura (seguro garantia / lotes caucionados)
- Permuta com parte Empreendedor + parte Terreneiro (split de comissões)
- Acessibilidade vs salário formal IBGE
- Modelos de administração de carteira
- Bloco educativo "Conceitos de Finanças Corporativas" no próprio produto

---

## 7. Próximos Passos Sugeridos

1. **Comparar este documento linha-a-linha com o PRD atual** (`parcelamento-solo-PRD.md`) e gerar lista de gaps
2. **Decidir se a Intentus quer paridade total ou diferenciação** com Lotelytics (qual é o "moat" da Intentus?)
3. **Possíveis diferenciais Intentus**:
   - Integração nativa com CLM (contrato direto a partir do estudo de viabilidade)
   - Integração com Relationship/CRM (lead → estudo → venda → relacionamento)
   - Copilot agentic integrado
   - Multi-tenant para incorporadoras com várias squads
   - Conexão com a base de leads do CRM Intentus
4. **Repriorizar a roadmap de Fases**: a Fase 1 (schema das 8 tabelas) já cobre a base, mas podemos precisar de mais entidades para suportar tudo isso
5. **Agendar conversa com Buchecha (MiniMax)** para review do PRD ampliado

---

## 8. Frames Salvos

41 frames extraídos em `/sessions/relaxed-fervent-clarke/video-frames/` (não persistente — são temporários do sandbox)

**Arquivos relevantes**:
- frame_001 a frame_005: Dashboard + modal criar projeto + Finder uploads
- frame_006 a frame_011: Mapa do terreno com camadas + parâmetros urbanísticos
- frame_012 a frame_014: Processamento de topografia + mapa declividade
- frame_015 a frame_023: Análise financeira (Fluxo Caixa, Recebimentos, Comparação, Sensibilidade, Performance)
- frame_024 a frame_028: Estrutura de Capital, Curva de Vendas, VGV, Fluxo Caixa detalhado
- frame_029 a frame_041: Modal Premissas (Projeto, Vendas, Terreno, Custos completo)

---

**Última atualização:** 2026-04-07
**Próximo passo:** Comparar com PRD atual e atualizar `parcelamento-solo-PRD.md` com features ausentes.
