# Parcelamento de Solo — Fase 5: Plano OTIMIZADO para Execução

**Criado em:** 2026-04-09 (sessão 132, encerramento)
**Para:** Nova sessão dedicada à Fase 5
**Status:** 🚀 Pronto para iniciar — Marcelo aprovou abordagem sequencial

---

## 🎯 Como usar este arquivo

Quando Marcelo abrir a nova sessão dizendo "vamos para a Fase 5", Claudinho deve:

1. **Ler este arquivo PRIMEIRO** (`parcelamento-solo-FASE5-PLANO-OTIMIZADO.md`)
2. **Ler também**: `parcelamento-solo-FASE5-PLANO.md` (decisões originais de Marcelo) e `parcelamento-solo-KNOWLEDGE-BASE.md` (arquitetura RAG para Bloco B)
3. **Apresentar este plano a Marcelo** como "briefing de abertura" igual ao que foi feito na sessão 132
4. **Perguntar qual Sprint começar** (default: Sprint 1 Bloco A)
5. **Ativar modo Professor** (Marcelo é iniciante em programação)

---

## 📐 Estimativa Realista por Bloco

| Bloco | Descrição | Sessões estimadas | Risco | Valor entregue |
|-------|-----------|-------------------|-------|----------------|
| **A** | Engenharia Financeira (8 abas, Monte Carlo, VPL, TIR, Payback, WACC, Sensibilidade, Fronteira Eficiente) | **1-2 dedicadas** | Baixo — matemática inline no EF | Alto — Marcelo testa viabilidade financeira na hora |
| **B** | Conformidade Legal + RAG pgvector (Lei 6.766 + Lei 4.591 + Detector Zoneamento + Gemini 3.1 Pro) | **3-5 dedicadas** | Alto — RAG + ingestão + embeddings + Gemini 3.1 Pro é um mini-produto | Muito alto — diferencial competitivo único |
| **C** | PDF Executivo Investidores (1-2 pág) + Técnico (10-20 pág) | **1 dedicada** | Médio — bibliotecas Deno de PDF | Alto — materiais profissionais de captação |
| **D** | Visualização 3D Three.js (terreno + lotes + edificações) | **1-2 dedicadas** | Médio — bundle size + lazy load | Médio — "uau factor" visual |
| **E** | CAD/Civil 3D nativo (futuro, projeto à parte) | **Roadmap próprio** | Muito alto | Produto dentro do produto |

**Total Fase 5 A→D:** 6-10 sessões dedicadas.

---

## 🏗️ Sprint 1 — Bloco A Otimizado (iniciar na nova sessão)

### Objetivo
Entregar a página `ParcelamentoFinanceiro.tsx` com 8 abas funcionais, conectada ao EF `parcelamento-financial-calc` completo.

### Estado atual (herdado da sessão 131)
- ✅ Schema: `parcelamento_urbanistic_params`, `developments` (com geometry EWKT funcionando), `parcelamento_financial_scenarios` criadas
- ✅ EF `parcelamento-financial-calc v3` (895 linhas, ACTIVE) com 4 actions + 3 stubs:
  - `simulate` ✅ (VPL, TIR, Payback, WACC inline)
  - `save_scenario` ✅
  - `get_financial` ✅
  - `list_scenarios` ✅
  - `monte_carlo` 🚧 STUB (implementar)
  - `sensitivity` 🚧 STUB (implementar)
  - `efficient_frontier` 🚧 STUB (implementar)
- ⚠️ Frontend `ParcelamentoFinanceiro.tsx` NÃO EXISTE ainda

### Passos sequenciais (ordem obrigatória)

#### Passo 1 — Auditoria (15min)
- `get_edge_function` no slug `parcelamento-financial-calc`
- Ler os 3 stubs e o contrato de request/response
- Listar campos de `parcelamento_urbanistic_params` para mapear inputs
- **Entregar a Marcelo**: resumo em bullet do que existe + o que falta

#### Passo 2 — Modo Professor: Fundamentos (30min)
Explicar a Marcelo, com exemplos numéricos, antes de qualquer código:
- **VPL** = Σ (FCt / (1+i)^t) − Investimento Inicial. Taxa de desconto = custo de oportunidade. Exemplo: R$ 1M investido, 5 anos, FC anuais R$ 300k, i=10% → VPL ≈ R$ 137k (projeto viável).
- **TIR** = taxa que zera o VPL. Newton-Raphson iterativo. Critério: TIR > WACC → aceitar.
- **Payback simples vs descontado**: simples ignora valor do dinheiro no tempo, descontado considera.
- **WACC** = (E/V)·Re + (D/V)·Rd·(1−Tc). Custo médio ponderado de capital próprio + dívida.
- **Monte Carlo**: rodar 1000-10000 simulações variando premissas (VGV, custo, velocidade de venda) por distribuições (triangular, normal) → distribuição de VPL → P5/P50/P95.
- **Sensibilidade (tornado chart)**: variar cada input isoladamente ±20% → medir impacto no VPL → ranquear do maior para o menor.
- **Fronteira Eficiente (Markowitz adaptado)**: plotar cenários por risco (desvio-padrão VPL) × retorno (VPL esperado) → curva ótima.

#### Passo 3 — EF: Implementar Monte Carlo (45min)
- Função `runMonteCarlo(inputs, iterations=1000)`:
  - Distribuição triangular para vgv, custo_m2, velocidade_vendas
  - Loop → para cada iteração, sorteia valores, chama `calculateVPL()` existente, armazena
  - Retorna: `{ simulations: number[], p5, p25, p50, p75, p95, mean, stdev, probPositive }`
- Deploy via MCP `deploy_edge_function`
- Teste com MCP `execute_sql` via `SELECT http_post(...)` OU via frontend depois

#### Passo 4 — EF: Implementar Sensibilidade (30min)
- Função `runSensitivity(baseInputs)`:
  - Lista de inputs a variar: vgv, custo_obra, tir_desconto, velocidade_venda, wacc
  - Para cada: calcula VPL com input-20%, input, input+20% → delta
  - Retorna array ordenado por `|delta|` desc (tornado chart ready)
- Deploy

#### Passo 5 — EF: Implementar Fronteira Eficiente (45min)
- Função `runEfficientFrontier(baseInputs)`:
  - Gera 50-100 combinações de (%equity, %debt) de 0/100 a 100/0
  - Para cada: calcula WACC, VPL, stdev via mini-Monte-Carlo (100 iters)
  - Retorna array `{ equity, debt, wacc, vpl, stdev }` plottable em scatter
- Deploy

#### Passo 6 — Frontend: Shell com 8 tabs (30min)
- Criar `src/pages/parcelamento/ParcelamentoFinanceiro.tsx`
- shadcn Tabs component com 8 tabs vazias (Fluxo, Recebimentos, Break-Even, Comparação, Sensibilidade, Performance, Capital, Fronteira)
- Hook `useFinancialScenario(projectId)` consumindo `parcelamento-financial-calc` action `get_financial`
- Rota `/parcelamento/projeto/:id/financeiro` em App.tsx
- Link na sidebar contextual do parcelamento

#### Passo 7 — Frontend: Tabs 1-4 (60min)
- Tab 1 Fluxo: `Recharts` LineChart cumulativo + KPI cards (VPL, TIR, Payback)
- Tab 2 Recebimentos: `Table` shadcn com amortização mês-a-mês
- Tab 3 Break-Even: `Recharts` ComposedChart — receita vs custo acumulado
- Tab 4 Comparação: 3 cenários sobrepostos (otimista/realista/pessimista) — multi-line

#### Passo 8 — Frontend: Tabs 5-8 (90min)
- Tab 5 Sensibilidade ⭐: sliders shadcn disparando `simulate` a cada onChange (debounced 300ms) + tornado chart consumindo `runSensitivity`
- Tab 6 Performance Score: círculo SVG 0-100 + 4 dimensões (liquidez, risco, retorno, prazo)
- Tab 7 Estrutura de Capital: donut Dívida vs SCP vs Equity
- Tab 8 Fronteira Eficiente: `Recharts` ScatterChart consumindo `runEfficientFrontier`

#### Passo 9 — Deploy + Commit (20min)
- `npx tsc --noEmit` → exit 0
- Commit conventional: `feat(parcelamento): bloco A engenharia financeira (8 abas + Monte Carlo + Sensibilidade + Fronteira)`
- Push via Desktop Commander
- Monitorar Vercel até READY (regra inviolável: tarefa só termina com state=READY)
- Marcar como ✅ no backlog

### Total Sprint 1 estimado: 5-6 horas de sessão = **1 sessão longa OU 2 sessões médias**

---

## 🏛️ Sprint 2 — Bloco B Foundation (Legal/RAG)

**NÃO executar na mesma sessão do Bloco A.** É um mini-produto.

### Decisões já aprovadas (sessão 122)
- Modelo: **Gemini 3.1 Pro** ($2/1M input, $12/1M output)
- Checklist DUPLO: Lei 6.766/79 (loteamentos) + Lei 4.591/64 (incorporações)
- RAG via **pgvector + text-embedding-004**
- Detector de Zoneamento via OCR do Plano Diretor Municipal

### Ordem de ataque (próxima sessão do Bloco B)
1. Extension pgvector + schema `legal_knowledge_chunks` (chunk_id, source_doc, chapter, text, embedding vector(768), metadata jsonb)
2. EF `knowledge-base-ingest`: aceita PDF → extrai texto → chunking semântico (janelas de 500 tokens com overlap de 50) → embedding Gemini → insert
3. Download e ingestão manual Lei 6.766/79 (PDF do planalto.gov.br)
4. Download e ingestão manual Lei 4.591/64
5. EF `parcelamento-legal-analysis`: recebe project_id → busca params → retrieval top-K chunks relevantes → prompt Gemini 3.1 Pro com tool-use → retorna `{ score_compliance, violations: [], warnings: [], parecer_textual, citacoes }`
6. Frontend `ParcelamentoConformidade.tsx` — rendering estruturado da resposta
7. Deploy + monitor

### Riscos conhecidos do Bloco B
- **Rate limits Gemini 3.1 Pro**: 60 req/min free tier. Implementar cache de embeddings por chunk hash.
- **PDF parsing no Deno**: `pdf-lib` não extrai texto. Usar `unpdf` ou enviar para service externo.
- **Custo**: 1 análise legal ≈ 20k tokens input + 2k output = $0.04 + $0.024 = **~$0.07/análise**. Cache agressivo obrigatório.

---

## 📄 Sprint 3 — Bloco C (PDF)

- Template Deno `pdf-lib` ou `jspdf` (server-side via EF)
- 2 variantes: executivo (1-2 pág, capa + KPIs + recomendação) + técnico (10-20 pág, tudo detalhado)
- Decisão sobre incluir mapas: POSTERGADA (sessão 122)
- Estimativa: 1 sessão

## 🎮 Sprint 4 — Bloco D (Three.js)

- Lazy load `three` + `@react-three/fiber`
- Importar DEM do terreno (GeoTIFF → heightmap)
- Extrusão de lotes como boxes sobre o DEM
- OrbitControls, lighting, materials básicos
- NÃO criar `THREE.CapsuleGeometry` (introduzido em r142, Cloudflare CDN usa r128)
- Estimativa: 1-2 sessões

## 🏗️ Sprint 5+ — Bloco E (futuro)

CAD/Civil 3D nativo. Roadmap próprio. Discutir em sessão de planejamento separada.

---

## 🚨 Regras invioláveis para a nova sessão

1. **Auto-save absoluto**: toda decisão, fórmula, trade-off → memória ou arquivo
2. **Commit a cada feature**: conventional commits + Co-Authored-By Claude Opus 4.6
3. **Tarefa só termina com Vercel READY**: monitorar via MCP após push
4. **Desktop Commander é primário** para git/shell (Keychain resolve auth)
5. **Modo Professor ativado**: Marcelo é iniciante, explicar antes de codar
6. **Pair programming obrigatório com Buchecha (MiniMax M2.7)** em fórmulas financeiras e validação de cálculos
7. **Contexto é finito**: nova sessão começa com budget limpo mas o Bloco A usa ~50% dele. Se começar a passar de 60% de uso, PARAR e encerrar.

---

## 📋 Checklist de abertura da nova sessão (Claudinho fazer)

- [ ] Ler este arquivo completo
- [ ] Ler `parcelamento-solo-FASE5-PLANO.md` (decisões originais)
- [ ] Ler `parcelamento-solo-KNOWLEDGE-BASE.md` (arquitetura RAG Bloco B)
- [ ] Ler as últimas 3 linhas de `.auto-memory/MEMORY.md` para pegar estado pós-sessão 132
- [ ] Rodar `git status` via Desktop Commander para confirmar árvore limpa
- [ ] Confirmar com Marcelo: "Sprint 1 (Bloco A) ou outro?"
- [ ] Ativar TodoWrite com os 9 passos do Sprint 1
- [ ] Iniciar Passo 1 (Auditoria do EF atual)
