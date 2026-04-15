# PRD — Módulo Parcelamento de Solo v0.2 (AMPLIADO)

> **Versão:** 0.2 (paridade Lotelytics + diferenciação IA + diferenciais brasileiros)
> **Owner:** Marcelo Silva (CEO Intentus)
> **Engenharia:** Claudinho + Buchecha (pair programming obrigatório)
> **Skills aplicadas:** `product-management:write-spec`, `saas-product`, `real-estate`, `engineering:architecture`
> **Data:** 07/04/2026
> **Status:** 🟢 PRD APROVADO por Marcelo (07/04/2026) — pronto para review com Buchecha e iniciar implementação na próxima sessão (117)
> **Decisão estratégica:** Caminho A + C + Diferenciais Brasil (Marcelo, 07/04/2026)
> **Substitui:** v0.1 (que continha apenas US-01 a US-47)
> **Stack confirmada:** Mapbox (paridade visual Lotelytics) + PostGIS (autorizado)
> **Pricing:** postergado — discutido após validação interna

---

## 0. Decisão Estratégica (Marcelo, 07/04/2026)

Após análise do vídeo de referência do **Lotelytics** (~17min, 41 frames extraídos), Marcelo decidiu:

1. **Caminho A — Paridade Total com Lotelytics**: o Intentus Parcelamento entregará tudo o que o Lotelytics entrega, com a mesma profundidade visual e funcional.
2. **Caminho C — Diferenciação por IA**: além da paridade, o produto terá uma camada de inteligência artificial proprietária que nenhum concorrente tem (Copilot agentic, Otimizador automático de massa, Recomendador de infraestrutura, Análise preditiva de viabilidade).
3. **Diferenciais brasileiros desde já**: integração nativa com CAR, SICAR, MapBiomas, Código Florestal (Lei 12.651/2012), Lei 6.766/79, SINAPI mensal, IBGE para benchmarks de renda. Isso é o nosso "moat" contra o Lotelytics no mercado nacional.
4. **Geoespacial é prioridade máxima**: declividade, topografia e linhas de influência (APP, rodovias, rios, ferrovias, linhas de transmissão) **devem ser o mais próximo possível da referência Lotelytics**. Esse é o coração do produto, não acessório.

### 0.1 Confirmações finais de Marcelo (07/04/2026, sessão 116)

Após apresentação do PRD v0.2 a Marcelo, ele aprovou as 5 perguntas finais:

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Aprovação geral do PRD v0.2 (137 user stories) | ✅ **APROVADO** — seguir conforme escrito |
| 2 | Mapbox vs MapLibre (open-source) | ✅ **MAPBOX** — igual Lotelytics, paridade visual |
| 3 | Habilitar PostGIS no Supabase | ✅ **AUTORIZADO** — `CREATE EXTENSION IF NOT EXISTS postgis;` |
| 4 | Prazo de 28 semanas (~141 dias úteis) | ✅ **CONFORTÁVEL** — sem cortes de escopo |
| 5 | Pricing | ⏸️ **POSTERGADO** — "vamos falar de preço mais adiante" |

**Pedido final de Marcelo**: "Registre isso, o plano todo e vamos iniciar a implementação em uma nova sessão."

→ Esta sessão (116) **NÃO inicia implementação**. Próxima sessão (117) abre com a Fase 1A já planejada e validada com Buchecha.

---

## 1. Problema (mantido da v0.1)

Empresas e empreendedores que querem **parcelar terras** (loteamentos urbanos abertos, condomínios horizontais de lotes, chácaras de recreio, glebas de chácaras urbanas) hoje precisam:

1. Contratar consultores caros para fazer estudo de viabilidade preliminar
2. Ou usar planilhas frágeis sem inteligência geoespacial
3. Ou usar ferramentas internacionais que não conhecem a regulação brasileira (Lei 6.766/79, Código Florestal, SICAR, zoneamento municipal)
4. Ou usar o **Lotelytics**, que é a referência de mercado mas é **caro, isolado** (não conecta com CRM/CLM) e **não tem IA agentic profunda**.

O processo típico hoje leva **2-6 semanas** entre receber a proposta de um terreno e ter uma decisão qualificada de "vai/não vai".

## 2. Visão do Produto (atualizada)

Um módulo **dentro do Intentus** que permite, a partir do upload de um arquivo georreferenciado (KMZ/KML/DWG/Shapefile/GeoJSON), gerar em **menos de 10 minutos** um estudo de viabilidade completo com:

- **Análise geoespacial profunda**: terreno, declividade real (4 classes), curvas de nível, APP automática, linhas de influência (rodovias, rios, ferrovias, linhas de transmissão, dutos), camadas SICAR/CAR/MapBiomas
- **Análise urbanística**: área líquida, lotes, taxa de aproveitamento, sistema viário desenhado em proporção real
- **Análise legal**: Lei 6.766/79, Lei 12.651/12 (APP), zoneamento municipal, alvarás
- **Análise financeira em 8 abas**: Fluxo de Caixa, Recebimentos, Break-Even, Comparação (Conservador/Ideal/Agressivo), Sensibilidade Interativa, Performance Score, Estrutura de Capital, Fronteira Eficiente
- **Premissas em 4 abas**: Projeto, Vendas, Terreno, Custos (com 8 categorias de infraestrutura usando catálogo SINAPI mensal)
- **Visualização 2D + 3D**: terreno em mapa, heatmap de declividade, simulação 3D do loteamento
- **Performance Score 0-100**: benchmarks reais SECOVI/ABRAINC/SINAPI/IBGE (mercado brasileiro)
- **Parecer técnico em linguagem natural** gerado por IA (diferencial Intentus)
- **Copilot agentic** que sugere otimizações em tempo real (diferencial Intentus)
- **Relatório PDF profissional** pronto para apresentar a investidores
- **Integração nativa com CRM/CLM** do Intentus (estudo → contrato → relacionamento)

## 3. Personas (mantidas da v0.1)

### 3.1 Marcelo (founder + incorporador)
Avalia ~10-30 terrenos/mês. Hoje gasta horas no Google Earth + Excel. Quer decisão rápida e fundamentada para apresentar a sócios/investidores.

### 3.2 Incorporador parceiro
Pequeno/médio incorporador que quer profissionalizar análises sem time de geoprocessamento. Disposto a pagar por ferramenta que substitua consultor.

### 3.3 Corretor especializado em terrenos
Capta terrenos e quer "vender" o terreno com estudo pronto.

### 3.4 Investidor / fundo
Compara múltiplas oportunidades. Precisa de relatório padronizado para comitê.

### 3.5 Urbanista / engenheiro civil parceiro (NOVA)
Profissional que valida o estudo automatizado e assina o projeto urbanístico oficial. Quer ferramenta que adiantasse 80% do trabalho dele.

---

## 4. Casos de Uso (User Stories)

### 4.1 Núcleo (US-01 a US-18) — mantidas da v0.1

| ID | Como... | Eu quero... | Para... |
|---|---|---|---|
| US-01 | Usuário | Fazer login no Intentus e ver módulo Parcelamento na sidebar | Acessar a ferramenta junto com o resto da plataforma |
| US-02 | Usuário | Criar novo projeto preenchendo nome, UF e cidade | Começar análise rápida |
| US-03 | Usuário | Subir um arquivo KMZ/KML por drag-drop | Importar limites do terreno |
| US-04 | Sistema | Calcular área do terreno automaticamente em hectares | Eliminar trabalho manual |
| US-05 | Sistema | Detectar se a localização do KMZ bate com a UF/cidade informada | Evitar erros de cadastro |
| US-06 | Sistema | Consultar SICAR/SIGEF/IBAMA em background | Obter dados oficiais sem usuário precisar buscar |
| US-07 | Sistema | Calcular APP/Reserva Legal por interseção real (não estimativa) | Precisão jurídica |
| US-08 | Usuário | Ajustar % de área pública, verde, viário, APP e área mínima do lote | Personalizar a análise |
| US-09 | Sistema | Calcular área líquida vendável, total de lotes e taxa de aproveitamento | Decisão rápida de viabilidade |
| US-10 | Usuário | Visualizar o terreno em mapa 2D com camadas SICAR/SIGEF/IBAMA sobrepostas | Validar visualmente |
| US-11 | Usuário | Visualizar o terreno em 3D com elevação real | Entender topografia |
| US-12 | Usuário | Simular um loteamento em 3D sobre o terreno | Ver como ficará na prática |
| US-13 | Usuário | Importar layout CAD (DXF/DWG) com traçado pronto | Reaproveitar projetos existentes |
| US-14 | Usuário | Editar parâmetros e re-simular sem recomeçar | Iterar rapidamente |
| US-15 | Usuário | Salvar projeto com status (em análise / viável / rejeitado / monitorando) | Gestão de pipeline |
| US-16 | Usuário | Mover projeto para lixeira | Limpar dashboard |
| US-17 | Super admin | Restaurar projeto da lixeira ou apagar permanentemente | Recuperação de erros |
| US-18 | Usuário | Convidar colaboradores com role específico | Trabalho em equipe multi-tenant |

### 4.2 Placeholders v0.1 (US-20 a US-32) — mantidas

| ID | Como... | Eu quero... | Para... |
|---|---|---|---|
| US-20 | Usuário | Cadastrar custos do terreno e infraestrutura | Análise financeira |
| US-21 | Usuário | Definir cronograma físico-financeiro (24-48 meses) | Projetar fluxo de caixa |
| US-22 | Usuário | Definir velocidade de venda esperada | Projetar receita |
| US-23 | Sistema | Calcular VPL, TIR, Payback, Margem Líquida, ROI | Indicadores financeiros |
| US-24 | Sistema | Mostrar 3 cenários (conservador/realista/otimista) | Análise de sensibilidade |
| US-25 | Usuário | Marcar itens de checklist Lei 6.766/79 como atendidos | Conformidade legal |
| US-26 | Sistema | Calcular score de compliance 0-100 | Visão rápida de risco regulatório |
| US-27 | Sistema | Alertar sobre itens críticos (declividade >47%, APP invadida) | Evitar problemas de aprovação |
| US-28 | Usuário | Gerar relatório executivo PDF (1-2 páginas) | Apresentar a decision-maker |
| US-29 | Usuário | Gerar relatório técnico PDF (10-20 páginas) | Documentação completa |
| US-30 | Usuário | Exportar memorial descritivo | Agilizar protocolo na prefeitura |
| US-31 | Usuário | Compartilhar relatório por link expirável | Enviar a investidor |
| US-32 | Usuário | Exportar para Excel | Análise externa |

### 4.3 IA-native v0.1 (US-40 a US-47) — mantidas como base, evoluem em §4.7

| ID | Como... | Eu quero... | Para... |
|---|---|---|---|
| US-40 | Usuário | Receber parecer técnico em linguagem natural gerado por IA | Entender o estudo sem ser engenheiro |
| US-41 | Usuário | Ativar modo "autopilot" e a IA escolher melhor configuração | Decisão automatizada |
| US-42 | Usuário | Comparar 5 terrenos lado a lado | Priorizar investimentos |
| US-43 | Sistema | Sugerir parâmetros baseado em zoneamento municipal | Conformidade automática |
| US-44 | Sistema | Detectar declividade real por pixel (a partir do grid de elevação) | Análise de movimentação de terra |
| US-45 | Sistema | Otimizar traçado por algoritmo genético | Maximizar nº de lotes mantendo legalidade |
| US-46 | Sistema | Integrar com MapBiomas (Google Earth Engine) | Histórico de uso/cobertura do solo |
| US-47 | Sistema | Alimentar CRM com lotes calculados (twin digital) | Fechar ciclo Intentus completo |

---

### 4.4 🆕 PARIDADE LOTELYTICS — Geoespacial Profundo (US-48 a US-65)

> **Categoria crítica.** Marcelo enfatizou: "isso é importantíssimo no projeto, gostaria muito que isso fosse o mais próximo possível da referência."

| ID | Como... | Eu quero... | Para... | Prioridade |
|---|---|---|---|---|
| US-48 | Sistema | Processar topografia do terreno em 5 etapas visíveis (Lendo terreno → Buscando elevações → Criando superfície → Gerando curvas → Finalizando) com barra de progresso por pontos (X de Y) e tempo restante estimado | UX transparente e confiável durante operação demorada | P0 |
| US-49 | Sistema | Buscar dados de elevação de alta resolução via OpenTopography (DEM SRTM 30m + ALOS PALSAR 12.5m) com fallback automático | Precisão topográfica real | P0 |
| US-50 | Sistema | Gerar curvas de nível automáticas a partir do DEM (intervalos configuráveis: 1m, 2m, 5m, 10m) e renderizar no mapa | Visualização padrão da engenharia | P0 |
| US-51 | Usuário | Visualizar mapa de declividade (heatmap) com 4 classes coloridas: 🟢 0-10% Ideal · 🟡 10-18% Atenção · 🟠 18-25% Difícil · 🔴 >25% Inviável | Decidir áreas viáveis e custo de movimentação de terra | P0 |
| US-52 | Usuário | Toggle entre visualização "Declividade" e "Elevação" no mesmo mapa | Análise multi-camada | P0 |
| US-53 | Sistema | Calcular e exibir: área total (ha), altimetria total (m), declividade média (%), volume estimado de movimentação de terra (m³ corte/aterro) | Indicadores rápidos de viabilidade física | P0 |
| US-54 | Sistema | Detectar automaticamente **linhas de influência** num raio configurável do terreno: rodovias federais/estaduais/municipais, ferrovias, rios, córregos, linhas de transmissão de energia, dutos (gás/petróleo) — via OpenStreetMap Overpass API + camadas IBGE | Mapeamento completo de restrições | P0 |
| US-55 | Sistema | Gerar **buffers automáticos** das faixas não-edificantes conforme norma legal: 15m de rios <10m, 30m de rios 10-50m, 50m de rios 50-200m (Código Florestal); 15m de rodovias federais; 15m de ferrovias; faixa de servidão de linhas de transmissão (varia por tensão) | Conformidade automática | P0 |
| US-56 | Usuário | Visualizar todas as camadas sobrepostas no mapa Mapbox + Maxar satellite com legenda interativa: 🟦 Terreno · 🟥 APP · 🟧 Rodovias · 🟨 L. Transmissão · 🟪 Rios · 🟫 Ferrovias · 🟩 Reserva Legal | Análise visual integrada | P0 |
| US-57 | Sistema | Calcular automaticamente APP por interseção geométrica real (PostGIS ST_Intersection) entre o polígono do terreno e os buffers de rios/nascentes/encostas, conforme Lei 12.651/2012 (Código Florestal) | Precisão jurídica | P0 |
| US-58 | Sistema | Calcular automaticamente faixa de servidão (% do terreno comprometido por rodovias + LT + ferrovias + dutos) com composição detalhada (ex: "11,4% — Rodovias 10,5% + L. Transmissão 1,0%") | Quantificar restrições | P0 |
| US-59 | Usuário | Ligar/desligar cada camada individualmente no mapa | Análise focada | P1 |
| US-60 | Usuário | Exportar geometria processada em KMZ, KML, Shapefile, GeoJSON, DWG/DXF (via ConvertAPI) | Compatibilidade com workflow tradicional | P1 |
| US-61 | Sistema | Suportar upload de ortomosaicos em GeoTIFF (.tif) e ECW (.ecw) e renderizar como camada raster sobreposta | Imagens próprias do drone/levantamento | P1 |
| US-62 | Sistema | Detectar inconsistências geométricas no KMZ (polígono auto-intersectante, área zero, projeção incorreta) e oferecer correção automática | Robustez | P0 |
| US-63 | Usuário | Visualizar cortes transversais do terreno em qualquer eixo (selecionado por clique) | Análise topográfica detalhada | P1 |
| US-64 | Sistema | Gerar **modelo 3D navegável** (Three.js + heightmap do DEM) com texturização opcional do ortomosaico | Visualização imersiva | P1 |
| US-65 | Usuário | Marcar manualmente áreas de exclusão custom (ex: lago, área de risco) e ter recálculo automático da área líquida | Flexibilidade | P1 |

---

### 4.5 🆕 PARIDADE LOTELYTICS — Premissas Profundas (US-66 a US-78)

| ID | Como... | Eu quero... | Para... | Prioridade |
|---|---|---|---|---|
| US-66 | Usuário | Modal "Editar Premissas" com 4 abas: **Projeto · Vendas · Terreno · Custos** com auto-save (indicador "● Salvo") | UX espelhando Lotelytics | P0 |
| US-67 | Usuário | Aba **Projeto**: nome, tipo (Aberto/Fechado), Total de Lotes, Área Média/Lote, Preço/m², Mês Início Obra, Mês Início Vendas, Duração da Obra, toggle "Lançamento em Etapas" | Configuração base do empreendimento | P0 |
| US-68 | Usuário | Aba **Vendas**: Prazo Parcelamento (meses), Taxa de Juros ao Cliente (% a.m.), Vendas à Vista (%), Desconto à Vista (%), Índice de Correção (IPCA/INCC/IGPM/CDI), IPCA Base, IPCA+ Adicional, Comissão de Vendas, Taxa de Inadimplência, Modelo de Administração de Carteira | Modelagem completa de receita | P0 |
| US-69 | Usuário | Aba **Terreno**: Modalidade (Parcelada/À Vista/Permuta), Valor do Terreno, Número de Parcelas, sub-bloco "Comissão do Corretor" com split Empreendedor/Terreneiro (Valor Fixo + % VGV) | Modelagem completa de aquisição | P0 |
| US-70 | Usuário | Aba **Custos**: overview com R$/m² de lote × Total Estimado, badge de tabela de referência (SINAPI SP atual), tags de contexto (lotes, m² médio, m² total) | Visão consolidada do CAPEX | P0 |
| US-71 | Usuário | Em Custos: bloco **Parâmetros do Sistema Viário** com Largura Total, Pista, Calçadas, Concreto/lado, Comprimento, e **visualização gráfica em tempo real** (desenho proporcional Calçada/Pista/Calçada que muda conforme inputs) | Visualização imediata do que está configurando | P0 |
| US-72 | Usuário | Em Custos: bloco **Especificações de Acabamento** com 3 dropdowns: Pavimentação (Paver/CBUQ/Bloco intertravado/etc), Estilo Meio-Fio (Tradicional/Pré-moldado), Rede Elétrica (Aérea/Subterrânea) cada um exibindo R$/m e nota explicativa | Customização de padrão construtivo | P0 |
| US-73 | Usuário | Em Custos: tabela **Itens de Infraestrutura** editável com toggle ON/OFF por item, organizada em **8 categorias**: 1) Pavimentação e Calçadas · 2) Drenagem Pluvial · 3) Saneamento · 4) Energia e Iluminação · 5) Equipamentos Especiais · 6) Itens Complementares · 7) Fechamento (Condomínio) · 8) Áreas de Lazer & Extras | Detalhamento granular de infraestrutura | P0 |
| US-74 | Sistema | Cada linha da tabela de infra mostrar: Item (com tooltip), Unidade, Quantidade, Esp./un (cenário ideal — verde), Pess./un (pessimista — vermelho), Total Esp., Total Pess., Δ% (variação) | Comparação ideal vs pessimista | P0 |
| US-75 | Usuário | Em Custos: toggle "Terraplanagem do Sistema Viário" com distribuição estimada baseada em declividade do DEM | Custo realista de movimentação de terra | P0 |
| US-76 | Usuário | Em Custos: bloco **Taxas e Contingências** — Despesas Gerais (% do VGV), Contingência (% da infraestrutura), Taxa de Desconto para VPL (% a.a.) | Realismo financeiro | P0 |
| US-77 | Usuário | Em Custos: toggle **Garantia para Prefeitura** ("Prefeitura exige garantia para vendas antecipadas?") simulando impacto de seguro garantia ou lotes caucionados | Simular obrigação legal regional | P0 |
| US-78 | Sistema | Rodapé do modal de Custos exibindo **Total de Custos**: Infraestrutura + Projetos + Marketing + Fechamento → R$ X | Total consolidado | P0 |

---

### 4.6 🆕 PARIDADE LOTELYTICS — Análise Financeira em 8 Abas (US-79 a US-100)

| ID | Como... | Eu quero... | Para... | Prioridade |
|---|---|---|---|---|
| US-79 | Usuário | Tela de Análise Financeira com 8 abas no topo: **Fluxo de Caixa · Recebimentos · Break-Even · Comparação · Sensibilidade · Performance · Estrutura Capital · Fronteira** | Espelhar Lotelytics | P0 |
| US-80 | Usuário | Aba **Fluxo de Caixa**: gráfico de linha interativo (mês × caixa em R$ Milhões) com tooltip mostrando Mês X · Caixa Acumulado · Movimentação do mês | Visualização macro | P0 |
| US-81 | Usuário | Cards de fases sobre o gráfico de Fluxo de Caixa: 📋 Preparação (X meses) · 🏗️ Obra (X meses, valor) · 🏗️📈 Obra+Vendas (X meses, valor) · ✅ Recebimentos (X meses, valor) | Contexto por fase | P0 |
| US-82 | Usuário | KPIs no rodapé do Fluxo de Caixa: Exposição Máxima · Payback (mês) · Lucro Final (mês) | Indicadores chave | P0 |
| US-83 | Usuário | Aba **Recebimentos**: tabela "Fluxo de Recebimentos por Ano" com colunas Ano, Vendas à Vista, Parcelas Recebidas, Total Recebido (Bruto), Desenvolvedor (Bruto), Terreneiro (Bruto), com linhas expansíveis por ano para detalhamento mensal | Detalhamento de receita | P0 |
| US-84 | Usuário | Toggle "Valores Brutos" / "Valores Líquidos" no Recebimentos | Análise contábil/gerencial | P1 |
| US-85 | Usuário | Aba **Break-Even**: gráfico mostrando o ponto de equilíbrio (mês exato em que o caixa acumulado vira positivo) com destaque visual e KPIs (lotes vendidos no break-even, % do total) | Decisão de exposição máxima | P0 |
| US-86 | Usuário | Aba **Comparação**: gráfico de linha com 3 cenários sobrepostos 🔴 Conservador · 🟠 Ideal · 🟢 Agressivo | Análise de risco visual | P0 |
| US-87 | Usuário | Tabela Comparativa Completa: Métrica × Conservador × Ideal × Agressivo × Trend (VPL, TIR, ROI, Payback, Exposição Máxima, Lucro Final, etc.) | Comparação numérica | P0 |
| US-88 | Usuário | Aba **Sensibilidade Interativa** com sliders ao vivo (sem botão "Recalcular"): Preço de Venda (-30% a +30%), Velocidade de Vendas (-50% a +50%), Taxa de Inadimplência (-10pp a +10pp), Custo de Infraestrutura (-30% a +30%) | "Wow factor" central — testar hipóteses ao vivo | P0 |
| US-89 | Sistema | Cards grandes mostrando **VPL Ajustado** e **TIR Ajustada** atualizando em tempo real conforme o usuário move sliders, com delta vs base ("+R$ X" ou "+X%") | Feedback imediato | P0 |
| US-90 | Usuário | Aba **Performance** com **Performance Score 0-100** (círculo grande) e badge comparativo ("+X acima do ideal · Ideal: 80") | Indicador resumo | P0 |
| US-91 | Sistema | Performance Score calculado a partir de 4 dimensões com pesos: TIR (30%) · Exposição de Caixa (25%) · Acessibilidade (25%) · Payback (20%) — pesos configuráveis | Metodologia transparente | P0 |
| US-92 | Sistema | Cards expansíveis por dimensão na aba Performance: cada um com nome da dimensão, status (Crítico/Atenção/Bom/Excelente), valor calculado, barra benchmark visual, análise textual gerada por IA, peso e benchmark de referência | Drill-down de cada dimensão | P0 |
| US-93 | Sistema | Footer da aba Performance: "Benchmarks baseados no mercado brasileiro de loteamentos urbanos (ABRAINC, SECOVI, IBGE)" + bloco "Salário formal: R$ X/mês (cidade · IBGE 2021)" para contextualizar acessibilidade | Credibilidade técnica | P0 |
| US-94 | Usuário | Aba **Estrutura de Capital** com 2 painéis lado a lado: **Esquerdo — Financiamento via Dívida** (% Investimento, Taxa de Juros, Sistema SAC/Price, Prazo, Carência, Mês Desembolso) e **Direito — Venda de Participação SCP** (Lotes a Vender, Desconto para Investidores) | Modelagem de capital sofisticada | P0 |
| US-95 | Sistema | Outputs do painel Dívida: Valor do Empréstimo · Custo da Dívida (Kd) · Parcela Mensal · Total de Juros · **Efeito Alavancagem (+%)** | Indicadores financeiros | P0 |
| US-96 | Sistema | Outputs do painel SCP: Entrada de Caixa · Desconto Concedido · Custo Efetivo (a.a.) · Comparação vs Financiamento ("Equity X% mais caro/mais barato") | Comparação Equity vs Debt | P0 |
| US-97 | Usuário | Bloco "Análise e Recomendações" gerado por IA na aba Estrutura de Capital (ex: "Carência tem pouco impacto na TIR. Pode negociar carência menor para obter melhor taxa.") | Educação contextual | P0 |
| US-98 | Usuário | Bloco **Referência - Conceitos de Finanças Corporativas** (acordions expansíveis) na aba Estrutura de Capital: WACC, Alavancagem Financeira, Equity vs Debt Financing | Educação dentro do produto | P1 |
| US-99 | Usuário | Aba **Fronteira Eficiente**: gráfico de fronteira eficiente mostrando trade-off entre alavancagem financeira e retorno do capital investido (eixo X = % de dívida, eixo Y = TIR ou ROE), com pontos coloridos por nível de risco | Decisão de estrutura ótima de capital | P0 |
| US-100 | Sistema | Bloco **VGV de Referência** em destaque permanente: VGV Gross (área × preço/m²) · VGV Net (após comissões, despesas, impostos) · aviso "O fluxo real considera juros, correção monetária e inadimplência" · Card Payback | Visão rápida de tamanho do negócio | P0 |

---

### 4.7 🆕 DIFERENCIAL IA — Camada Proprietária Intentus (US-101 a US-115)

> **Esta seção é o "moat" do Intentus contra Lotelytics.** Nenhum concorrente tem isso.

| ID | Como... | Eu quero... | Para... | Prioridade |
|---|---|---|---|---|
| US-101 | Usuário | **Copilot Agentic Parcelamento**: chat lateral integrado que entende todo o contexto do projeto (terreno, premissas, financeiro) e responde perguntas em linguagem natural ("Por que minha TIR caiu 3 pp?", "O que acontece se eu reduzir o prazo de venda?") | Atendimento especializado on-demand | P0 |
| US-102 | Sistema | Copilot pode **executar ações** no projeto (não só responder): "Mude o sistema viário para 22% e me mostre o impacto" → Copilot altera o parâmetro e apresenta delta automaticamente | Automação por linguagem natural | P0 |
| US-103 | Sistema | **Otimizador Automático de Massa** (algoritmo genético + LLM): dado um terreno e parâmetros urbanísticos, sugere 5 disposições alternativas de quadras/lotes que maximizam VPL respeitando declividade, APP, faixas de servidão e área mínima de lote | Autopilot urbanístico | P0 |
| US-104 | Sistema | Otimizador retorna cada cenário com: layout visual no mapa, total de lotes, área média, VPL projetado, justificativa textual ("Esta disposição evita a área >25% de declividade no quadrante NE, ganhando 12 lotes a mais") | Explicabilidade | P0 |
| US-105 | Sistema | **Recomendador de Infraestrutura**: IA sugere itens da tabela de SINAPI baseado no perfil do terreno (declividade, área, padrão de empreendimento) e similaridade com projetos passados do mesmo incorporador | Reduzir erro de subestimação | P0 |
| US-106 | Sistema | **Análise Preditiva de Viabilidade**: dado um terreno apenas com KMZ e localização, IA prediz em 30 segundos VPL, TIR, payback estimados com banda de confiança, baseado em dataset interno + benchmarks regionais | "Pré-análise" antes de detalhar premissas | P1 |
| US-107 | Sistema | **Gerador de Parecer Técnico em Linguagem Natural**: ao final do estudo, IA escreve 1-2 páginas de parecer estruturado (Sumário Executivo, Análise Técnica, Análise Financeira, Riscos, Recomendação) que vai direto no PDF | Entregar valor instantâneo | P0 |
| US-108 | Sistema | **Comparador Multi-Terreno IA**: usuário seleciona até 10 projetos e IA gera ranking ponderado por critérios customizáveis (peso VPL, peso TIR, peso risco, peso prazo) com justificativa por ranking | Decisão de portfólio | P1 |
| US-109 | Sistema | **Detector de Red Flags**: IA escaneia o projeto e sinaliza riscos não-óbvios (ex: "Atenção: 38% do terreno tem declividade >18%, custo de movimentação pode estourar contingência de 10%") | Prevenção de erros | P0 |
| US-110 | Sistema | **Sugerir Pontos de Melhoria**: ao salvar projeto, IA sugere 3 ações para melhorar Performance Score (ex: "Reduzir comissão de venda de 5% para 4% aumentaria seu Score em 4 pontos") | Otimização contínua | P1 |
| US-111 | Sistema | **Memória de Projetos do Incorporador**: IA aprende com projetos anteriores do incorporador (custos reais vs estimados, tempo de venda real vs projetado) e recalibra estimativas futuras | Aprendizado contínuo | P1 |
| US-112 | Sistema | **Simulador de Cenários Climáticos** (futuro pós-2030): com base em projeções de mudança climática regional, IA simula impacto de aumento de chuvas em drenagem pluvial e custos | Diferencial de longo prazo | P2 |
| US-113 | Sistema | **Voice Mode**: Marcelo pode descrever o projeto por voz ("Olha, peguei um terreno de 50ha em Piracicaba, quero fazer um loteamento aberto com lotes de 300m²...") e a IA preenche todos os campos | Acessibilidade extrema | P2 |
| US-114 | Sistema | **Análise de Sentiment do Mercado Local**: IA analisa anúncios recentes da região (Zap, Viva Real, OLX) para validar se preço/m² da premissa está coerente | Validação externa de premissas | P1 |
| US-115 | Sistema | **Auto-PRD do Empreendimento**: IA gera o "PRD do empreendimento" (visão, público, posicionamento, justificativa, próximos passos) que vira material para investidores | Saída executiva pronta | P1 |

---

### 4.8 🆕 DIFERENCIAL BRASIL — Conformidade e Integração Nacional (US-116 a US-135)

> **Este é o nosso "moat regional" contra Lotelytics.** Nada disso é fácil de replicar para um produto internacional.

| ID | Como... | Eu quero... | Para... | Prioridade |
|---|---|---|---|---|
| US-116 | Sistema | Integração nativa com **CAR (Cadastro Ambiental Rural)** via API SiCAR: dado o polígono do terreno, retornar automaticamente APPs declaradas, Reserva Legal, áreas embargadas, áreas de uso consolidado | Conformidade ambiental automática | P0 |
| US-117 | Sistema | Integração com **MapBiomas Coleções via Google Earth Engine**: histórico de uso e cobertura do solo dos últimos 10 anos sobreposto ao terreno (vegetação nativa, agricultura, pastagem, urbano) | Análise histórica de uso | P0 |
| US-118 | Sistema | Cálculo automático de APP conforme **Lei 12.651/2012 (Código Florestal)**: aplicar buffers corretos para cada tipo de curso d'água, nascente, encosta com declividade >45°, topo de morro | Conformidade legal automática | P0 |
| US-119 | Sistema | **Checklist automatizado Lei 6.766/79**: validar todos os requisitos do parcelamento de solo urbano (área mínima de lote 125m² ou conforme lei municipal, % de áreas públicas mínimas, larguras mínimas de via, etc.) com indicação visual de atendido/não atendido | Conformidade urbanística automática | P0 |
| US-120 | Sistema | Integração com **Google Geocoding** para resolver endereço ↔ coordenadas e validar localização automaticamente | Auto-validação | P0 |
| US-121 | Sistema | Catálogo **SINAPI atualizado mensalmente** por estado (SP, RJ, MG, PR, RS, etc.) — pipeline de ingestão automática a partir do site da CEF | Custos sempre atualizados | P0 |
| US-122 | Sistema | Catálogo de **benchmarks SECOVI** (preços médios por m² por cidade, velocidade de venda) atualizados trimestralmente | Validação de premissas comerciais | P0 |
| US-123 | Sistema | Catálogo de **benchmarks ABRAINC** (% de lançamentos por região, performance de incorporadoras públicas) | Comparação setorial | P0 |
| US-124 | Sistema | Integração com **IBGE** para dados de renda média por município/setor censitário (usado no cálculo de Acessibilidade do Performance Score) | Performance Score com base local real | P0 |
| US-125 | Sistema | **Detector de zoneamento municipal**: dado o município, baixar o Plano Diretor local (quando disponível em formato aberto) ou permitir upload manual de PDF e usar OCR + LLM para extrair parâmetros (Coeficiente de Aproveitamento, taxa de ocupação, gabarito) | Conformidade municipal | P1 |
| US-126 | Sistema | **Detector de área embargada**: cruzar com base IBAMA/ICMBio de áreas com restrição ambiental | Risco regulatório | P0 |
| US-127 | Sistema | **Cálculo de ITBI** estimado por município (alíquota varia 1-3%) | Custo de aquisição realista | P1 |
| US-128 | Sistema | **Cálculo de outorga onerosa** (quando aplicável conforme plano diretor municipal) | Custo regulatório | P1 |
| US-129 | Sistema | **Check de Lei do Verde** municipal (em cidades como SP, há obrigação de % de cobertura vegetal preservada além da APP federal) | Conformidade municipal | P1 |
| US-130 | Sistema | **Memorial Descritivo** gerado automaticamente em formato compatível com **Cartório de Registro de Imóveis** (Lei 6.015/73) | Reduzir tempo de registro | P0 |
| US-131 | Sistema | **Pré-projeto urbanístico** em formato compatível com prefeituras (DWG via ConvertAPI + plantas exportáveis) | Acelerar processo de aprovação | P1 |
| US-132 | Sistema | Integração com **Receita Federal** para validar CNPJ do incorporador / SPE | Compliance | P1 |
| US-133 | Sistema | **Integração com CRI** (Cartório de Registro de Imóveis) para consulta pública de matrícula do imóvel (quando API disponível) | Due diligence | P2 |
| US-134 | Sistema | **Integração com CRA** (Certificados de Recebíveis Agrícolas/Imobiliários) para simulação de securitização da carteira de recebíveis | Estrutura financeira avançada | P2 |
| US-135 | Sistema | **Calculadora de FII** (Fundo de Investimento Imobiliário) — simulação de constituição de FII com o empreendimento como ativo | Estrutura financeira avançada | P2 |

---

### 4.9 🆕 DIFERENCIAL INTENTUS — Integração com CRM/CLM/Relationship (US-136 a US-145)

| ID | Como... | Eu quero... | Para... | Prioridade |
|---|---|---|---|---|
| US-136 | Usuário | Ao marcar projeto como "Viável", criar automaticamente **lead/oportunidade no CRM Intentus** com todos os dados do estudo anexados | Fechar ciclo Intentus | P0 |
| US-137 | Usuário | Quando vender lotes, cada lote vira **unidade no CRM** automaticamente (twin digital) com os dados do estudo (área, posição, declividade) | Continuidade pós-venda | P0 |
| US-138 | Usuário | Gerar contrato de compra do terreno automaticamente no **CLM Intentus** a partir dos dados do estudo (valor, parcelas, modalidade) | Aceleração comercial | P0 |
| US-139 | Usuário | Cada lote vendido pode disparar contrato de compra e venda automaticamente via **CLM** (template parametrizado) | Volume operacional | P0 |
| US-140 | Usuário | Adicionar prospects de compradores ao **Relationship Module** do Intentus para nurturing automático | LTV pós-venda | P0 |
| US-141 | Sistema | Quando lote é vendido, registrar churn risk no Relationship (taxa de inadimplência simulada vira input no scoring) | Antecipação de risco | P1 |
| US-142 | Usuário | Pipeline visual estilo Kanban: Terreno Captado → Estudo Completo → Viabilidade Aprovada → Negociação → Fechado → Em Obra → Em Vendas → Encerrado | Gestão de portfolio | P0 |
| US-143 | Usuário | Dashboard executivo consolidado mostrando portfolio de empreendimentos (paridade total com Lotelytics: 9 de 120 projetos · VGV R$ X · VPL R$ Y) com filtros por status | Visão de portfolio | P0 |
| US-144 | Usuário | Multi-tenant para incorporadoras com várias squads: cada squad vê só seus projetos, com agregação no nível da empresa | Modelo de negócio escalável | P0 |
| US-145 | Sistema | Webhook/API pública para integrar Parcelamento com sistemas externos (ERPs, BIs do incorporador) | Extensibilidade enterprise | P1 |

---

## 5. Métricas de Sucesso (atualizadas)

### 5.1 Métricas de produto
- **Tempo médio "do KMZ ao parecer"** — meta: <10 minutos (P0)
- **Tempo médio "do KMZ ao Performance Score"** — meta: <3 minutos (P0)
- **# de projetos analisados/mês** — baseline: 0 → meta Q3/2026: 50
- **Taxa de uso do Copilot** — meta: 40% dos projetos (P0)
- **Taxa de conversão "viável → contrato"** (via CLM) — meta: 25% (P0)
- **NPS do módulo** — meta: >50

### 5.2 Métricas técnicas
- **Tempo de upload + parse de KMZ** — meta: <5s
- **Tempo de cálculo de declividade** (DEM 30m, terreno 100ha) — meta: <30s
- **Tempo de cálculo APP automática** — meta: <5s
- **Tempo de carregamento 3D** — meta: <8s
- **Erro rate das EFs externas** — meta: <2%
- **Taxa de cache hit do CAR/SICAR** — meta: >60%
- **Latência do Copilot agentic** — meta: <3s primeira resposta

### 5.3 Métricas de negócio
- **# de incorporadores parceiros usando** — meta Q3/2026: 10 · Q4/2026: 30
- **MRR atribuível ao módulo** — meta Q3/2026: R$ 50k · Q4/2026: R$ 200k
- **# de empreendimentos completos no Intentus end-to-end** (estudo → CLM → CRM → entrega): meta 5 em Q4/2026

---

## 6. Restrições e Premissas

### 6.1 Stack técnico (mantido)
- React + Vite + TS + shadcn + Supabase (igual ao resto do Intentus)
- PostgreSQL (Supabase) — projeto `bvryaopfjiyxjgsuhjsb`
- **PostGIS** habilitado (necessário para US-48 a US-65)
- Multi-tenant RLS com `getAuthTenantId()`
- RBAC 7 roles do Intentus
- Pair programming obrigatório com Buchecha (CLAUDE.md)
- Naming: prefixo `development_parcelamento_*` (tabelas) e `development-*` (EFs)

### 6.2 Restrições legais (ampliadas)
- **Lei 6.766/79** — parcelamento de solo urbano
- **Lei 12.651/2012** — Código Florestal (APP/RL)
- **Lei 6.015/73** — Registros Públicos (memorial)
- **NBR 12.721** — cálculo de áreas
- **LGPD** — dados de localização e CPFs
- **Plano Diretor municipal** — variável por cidade

### 6.3 Premissas
- Marcelo é o primeiro usuário (dogfooding com Splendori Piracicaba)
- Pricing definido após validação interna
- Lotelytics é referência **funcional**, não código (vamos reescrever do zero respeitando nossos padrões)
- Buchecha valida toda migration antes de aplicar em produção

---

## 7. Não-Objetivos (out of scope para v1)

- ❌ Não substitui projeto urbanístico oficial assinado por arquiteto/urbanista
- ❌ Não substitui EIV (Estudo de Impacto de Vizinhança)
- ❌ Não faz licenciamento ambiental
- ❌ Não emite documentos com força legal
- ❌ Não suporta verticalização (apenas parcelamento horizontal)
- ❌ Não compete com Lotelytics no mercado internacional (foco Brasil)
- ❌ Não substitui o role do engenheiro civil/agrimensor (mas reduz drasticamente o tempo dele)

---

## 8. Roadmap em fases (REPRIORIZADO)

### Fase 0 — Auditoria ✅ COMPLETO
- Auditoria das 5 EFs externas, listagem de tabelas, decisões D1-D5

### Fase 1A — Schema Geoespacial Profundo (PRIORIDADE MÁXIMA — 4-5 dias)
- Habilitar PostGIS no Supabase
- Migration `add_parcelamento_geospatial.sql` com:
  - `developments` (unificado, conforme D1)
  - `development_parcelamento_terrain` (geometria PostGIS)
  - `development_parcelamento_topography` (DEM + curvas de nível)
  - `development_parcelamento_slope_analysis` (4 classes)
  - `development_parcelamento_influence_lines` (rodovias, rios, ferrovias, LT, dutos)
  - `development_parcelamento_app_calculation` (APP automática)
  - `development_parcelamento_overlays` (KMZ, KML, GeoTIFF, ECW)
  - `development_parcelamento_car_data` (cache CAR/SICAR)
  - `development_parcelamento_mapbiomas` (cache MapBiomas)
- RLS multi-tenant + GIN indexes em colunas geométricas
- Storage bucket `parcelamento-geospatial`

### Fase 1B — Schema Financeiro + Premissas (3-4 dias)
- Migration `add_parcelamento_financial.sql` com:
  - `development_parcelamento_premises` (4 tabs Projeto/Vendas/Terreno/Custos)
  - `development_parcelamento_infrastructure_items` (catálogo SINAPI + custom)
  - `development_parcelamento_cash_flow` (fluxo mensal projetado)
  - `development_parcelamento_scenarios` (Conservador/Ideal/Agressivo)
  - `development_parcelamento_sensitivity` (cache de sensibilidade)
  - `development_parcelamento_performance_score` (cache do score 0-100)
  - `development_parcelamento_capital_structure` (Debt + SCP)
  - `development_parcelamento_pareto_frontier` (cache da fronteira)

### Fase 1C — Schema Catálogos Brasil (2 dias)
- Migration `add_parcelamento_catalogs.sql` com:
  - `parcelamento_sinapi_catalog` (atualizado mensalmente)
  - `parcelamento_secovi_benchmarks` (trimestral)
  - `parcelamento_abrainc_benchmarks` (trimestral)
  - `parcelamento_ibge_income` (renda média por município)
  - `parcelamento_municipal_zoning` (Plano Diretor parsed)

### Fase 2 — Edge Functions Geoespaciais (5-7 dias)
- `development-parse-kmz` — extrai polígono
- `development-fetch-elevation` — OpenTopography
- `development-compute-slope` — gradiente DEM em 4 classes
- `development-detect-influence-lines` — Overpass API
- `development-compute-app` — Lei 12.651/2012
- `development-fetch-car` — SiCAR API
- `development-fetch-mapbiomas` — Google Earth Engine
- `development-overlay-tiff-ecw` — raster overlay
- `development-export-geometry` — KMZ/KML/SHP/DWG

### Fase 3 — Edge Functions Financeiras (5-7 dias)
- `development-compute-cash-flow`
- `development-compute-scenarios`
- `development-compute-sensitivity`
- `development-compute-performance-score`
- `development-compute-capital-structure`
- `development-compute-pareto-frontier`
- `development-fetch-sinapi` (cron mensal)
- `development-fetch-secovi` (cron trimestral)
- `development-fetch-ibge` (one-time + atualizações)

### Fase 4 — Edge Functions IA (Diferencial Intentus, 7-10 dias)
- `development-copilot-agentic` (chat com tool use)
- `development-mass-optimizer` (genético + LLM)
- `development-infra-recommender` (similarity search)
- `development-predictive-viability` (modelo preditivo)
- `development-tech-opinion-generator` (parecer textual)
- `development-multi-comparator` (ranking IA)
- `development-red-flag-detector`

### Fase 5 — Frontend Geoespacial (8-10 dias)
- Componentes Mapbox + camadas
- Heatmap de declividade
- Curvas de nível
- Toggle de camadas
- Modo 3D (Three.js)
- Upload KMZ/DWG/TIFF/ECW

### Fase 6 — Frontend Premissas (Modal 4 abas) (5-7 dias)
- Modal com auto-save
- Aba Projeto / Vendas / Terreno / Custos
- Tabela editável de infraestrutura
- Visualização gráfica do sistema viário em tempo real

### Fase 7 — Frontend Financeiro (8 abas) (8-10 dias)
- 8 abas: Fluxo Caixa, Recebimentos, Break-Even, Comparação, Sensibilidade, Performance, Estrutura Capital, Fronteira
- Sliders interativos
- Performance Score visual
- Cards expansíveis

### Fase 8 — Frontend Copilot Agentic + IA (5-7 dias)
- Chat lateral
- Tool use para alterar parâmetros
- Voice mode (US-113)

### Fase 9 — Integrações Intentus (CRM/CLM/Relationship) (5-7 dias)
- Webhooks para criar lead/contrato/twin
- Pipeline Kanban
- Dashboard de portfolio

### Fase 10 — Relatórios PDF + Memoriais (4-5 dias)
- PDF executivo (1-2p)
- PDF técnico (10-20p)
- Memorial descritivo (Lei 6.015/73)

### Fase 11 — Testes e qualidade (5-7 dias)

### Fase 12 — Documentação + Lançamento (3-4 dias)

**Estimativa total revisada: ~80-110 dias úteis (~16-22 semanas)** — vs Lotelytics que provavelmente levou >2 anos.

---

## 9. Decisões abertas (atualizadas)

| Decisão | Status | Prazo |
|---|---|---|
| ~~Caminho A vs B vs C~~ | ✅ A + C + Brasil (07/04/2026) | — |
| ~~Diferenciais brasileiros desde já?~~ | ✅ Sim (07/04/2026) | — |
| Provedor do gateway de DWG (ConvertAPI vs alternativas) | ✅ ConvertAPI (D2) | — |
| Provedor de elevação | ✅ OpenTopography (D3) — chave já recebida | — |
| Pricing do módulo | ⏳ Após Fase 7 (MVP funcional) | Out/2026 |
| Modelo de monetização (per-project / per-seat / per-volume) | ⏳ Estudo de mercado | Sep/2026 |
| Decidir se Performance Score usa modelo aberto ou fechado | ⏳ | Fase 4 |
| Open-source o catálogo SINAPI parser? | ⏳ | Pós-MVP |

---

## 10. Próximos passos imediatos

1. ✅ PRD v0.2 escrito
2. ⏭️ Apresentar PRD v0.2 a Marcelo para aprovação final
3. ⏭️ Revisar PRD v0.2 com Buchecha (MiniMax pair programming)
4. ⏭️ Atualizar `parcelamento-solo-FASE1-PLANO.md` com 1A + 1B + 1C ampliados (PostGIS + financeiro + catálogos)
5. ⏭️ Habilitar PostGIS no Supabase (`CREATE EXTENSION IF NOT EXISTS postgis;`)
6. ⏭️ Configurar secrets: `OPENTOPO_API_KEY` (✅ temos), `CONVERT_API_SECRET` (Marcelo cadastra), `MAPBOX_PUBLIC_TOKEN` (Marcelo gera), `GOOGLE_MAPS_API_KEY` (futuro)
7. ⏭️ Aplicar migration Fase 1A na produção (Alternativa 4 — direto na produção com salvaguardas BEGIN/COMMIT + advisors)
8. ⏭️ Iniciar Fase 1B logo após validação da 1A

---

## 11. Estimativa de Esforço por Categoria

| Categoria | # de US | Prioridade média | Estimativa (dias úteis) |
|---|---|---|---|
| Núcleo (US-01 a US-18) | 18 | P0 | ~15 dias |
| Placeholders v0.1 (US-20 a US-32) | 13 | P0 | ~12 dias |
| IA-native v0.1 (US-40 a US-47) | 8 | P0 | ~10 dias |
| 🆕 Geoespacial Profundo (US-48 a US-65) | 18 | P0 | ~20 dias |
| 🆕 Premissas Profundas (US-66 a US-78) | 13 | P0 | ~12 dias |
| 🆕 Análise Financeira 8 abas (US-79 a US-100) | 22 | P0 | ~22 dias |
| 🆕 Diferencial IA (US-101 a US-115) | 15 | P0/P1 | ~18 dias |
| 🆕 Diferencial Brasil (US-116 a US-135) | 20 | P0/P1 | ~22 dias |
| 🆕 Integração Intentus (US-136 a US-145) | 10 | P0 | ~10 dias |
| **TOTAL** | **137** | — | **~141 dias úteis (~28 semanas)** |

---

## 12. Histórico de versões

- **v0.1 (07/04/2026)** — rascunho inicial com 47 user stories baseado em código Lovable
- **v0.2 (07/04/2026)** — ampliação para 137 user stories após análise do vídeo Lotelytics + decisão A+C+Brasil de Marcelo. Adiciona 4 categorias: Geoespacial Profundo, Premissas Profundas, Análise Financeira 8 abas, Diferencial IA, Diferencial Brasil, Integração Intentus.

---

**Data:** 07/04/2026
**Próximo step:** Apresentar a Marcelo para validação, depois review com Buchecha, depois iniciar Fase 1A (PostGIS + tabelas geoespaciais).
