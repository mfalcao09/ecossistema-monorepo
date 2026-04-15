# Parcelamento de Solo — Fase 5: Plano de Execução

**Data:** 2026-04-08
**Sessão:** 122
**Status:** 📋 Plano aprovado por Marcelo — aguardando início de Sprint 1 (Bloco A)

---

## Decisões de Marcelo (2026-04-08, sessão 122)

### Caminho de implementação
**SEQUENCIAL**: Bloco A → Bloco B → Bloco C → Bloco D → Bloco E (…)

Motivo: Marcelo prefere aprofundar um bloco por vez, garantindo qualidade máxima em cada etapa antes de avançar, em vez de MVP fatiado.

### Bloco A — Engenharia Financeira
- Marcelo quer **entender claramente os conceitos**: TIR, ROI, Margem Líquida, VPL, Payback, WACC
- **Foco pedagógico**: explicar como cada custo de execução impacta esses indicadores
- Claudinho deve atuar em modo "professor" durante todo o Bloco A — explicar antes de implementar cada cálculo
- Deliverable: `ParcelamentoFinanceiro.tsx` com 8 abas (Fluxo de Caixa, Recebimentos, Break-Even, Comparação, Sensibilidade, Performance, Estrutura de Capital, Fronteira Eficiente)

### Bloco B — Conformidade Legal
- **Modelo IA**: Gemini 3.1 Pro (Gemini 3.0 descontinuado em 2026-03-09, migrar direto para 3.1 Pro). Preço: $2/1M input, $12/1M output.
- **Checklist duplo obrigatório**:
  - **Lei 6.766/79** — parcelamento de solo urbano (loteamentos abertos)
  - **Lei 4.591/64** — incorporações (condomínios de lotes fechados)
- **Detector de zoneamento CRÍTICO**: precisa determinar módulo mínimo (tamanho mínimo de lote, coeficiente de aproveitamento, taxa de ocupação, gabarito) a partir de upload do Plano Diretor Municipal
- **Biblioteca de Conhecimento Jurídico (Skill Aprimorada)**:
  - Ideia de Marcelo: criar uma skill que receba upload de regras jurídicas, livros de orientação, manuais de execução prática
  - Funcionaria como RAG (Retrieval-Augmented Generation) sobre a base de conhecimento
  - Claudinho aprovou a ideia — é um diferencial competitivo real
  - Implementação sugerida: vetorização via pgvector no Supabase + embeddings Gemini text-embedding-004 + retrieval na EF de compliance
  - **Decisão técnica pendente**: detalhar arquitetura antes de iniciar Bloco B

### Bloco C — PDF para Investidores
- Decisão sobre mapas no PDF: **postergada** — decidir mais à frente
- Formatos: executivo (1-2 pág) + técnico (10-20 pág)

### Bloco D — Visualização 3D e CAD
- Three.js é o começo, mas **visão de longo prazo é trazer conceitos de AutoCAD/Civil 3D** para dentro da plataforma
- Próxima fase (ou projeto à parte): projetar 2D dentro do sistema — plantas baixas, quadras, lotes — e aplicar sobre a topografia do terreno (DEM)
- Isso é um produto dentro do produto. Precisa roadmap próprio.

### Riscos — Mitigações aprovadas
| Risco | Mitigação aprovada |
|-------|-------------------|
| Monte Carlo travar navegador | ✅ Rodar em Edge Function, retornar resultado cacheado |
| Three.js bundle size | ✅ Lazy load — só quando usuário abre aba 3D |
| PDF com mapas | ⏸️ Postergado — decidir mais à frente |
| Catálogo SINAPI | ⏸️ Ingerir mensalmente, discutir estratégia na frente |

---

## Estrutura de Execução — Ordem Sequencial

### Sprint 1 — Bloco A: Fundamentos Financeiros
**Estimativa:** 8-12 sessões

1. Criar tabelas no banco:
   - `parcelamento_financial_scenarios` (premissas + resultados calculados)
   - `parcelamento_cost_items` (catálogo SINAPI seed estático inicial)
   - `parcelamento_cash_flow` (série temporal mês-a-mês)
2. Edge Function `parcelamento-financial-calc` — cálculos pesados:
   - Fluxo de caixa mês-a-mês
   - VPL (Valor Presente Líquido) — fórmula: Σ (FCt / (1+i)^t) - Investimento Inicial
   - TIR (Taxa Interna de Retorno) — método iterativo Newton-Raphson
   - Payback simples + descontado
   - Monte Carlo (1000 iterações)
   - Amortização SAC e Price
   - WACC = (E/V × Re) + (D/V × Rd × (1-Tc))
3. Frontend: `ParcelamentoFinanceiro.tsx` — shell com 8 tabs
4. Aba 1 — Fluxo de Caixa (gráfico + KPIs)
5. Aba 2 — Recebimentos (tabela)
6. Aba 3 — Break-Even (gráfico de cruzamento)
7. Aba 4 — Comparação (3 cenários sobrepostos)
8. Aba 5 — Sensibilidade (sliders ao vivo) ⭐
9. Aba 6 — Performance Score (círculo 0-100 + 4 dimensões)
10. Aba 7 — Estrutura de Capital (Dívida vs SCP)
11. Aba 8 — Fronteira Eficiente

**Abordagem pedagógica por aba**: antes de codar, explicar o conceito financeiro à Marcelo em linguagem simples + exemplo numérico.

### Sprint 2 — Bloco B: Conformidade Legal (após Bloco A aprovado)
1. Biblioteca de Conhecimento Jurídico (RAG):
   - Setup pgvector no Supabase
   - Storage bucket `legal-knowledge-base` (PDFs)
   - EF `knowledge-base-ingest` (chunking + embedding + insert)
   - EF `knowledge-base-retrieve` (similarity search)
2. Checklist Lei 6.766/79 (loteamentos)
3. Checklist Lei 4.591/64 (condomínios de lotes)
4. Detector de Zoneamento Municipal (OCR + LLM sobre Plano Diretor)
5. Score de compliance 0-100
6. Parecer textual IA

### Sprint 3 — Bloco C: PDF Investidores (após Bloco B)
### Sprint 4 — Bloco D: Three.js 3D (após Bloco C)
### Sprint 5+ — Bloco E (futuro CAD/Civil 3D nativo)

---

## Observações Importantes

- **Auto-save absoluto**: toda decisão, cálculo, fórmula explicada deve ser salva nesta ou em arquivo derivado
- **Commit a cada feature**: formato conventional commits + Co-Authored-By
- **Buchecha (MiniMax M2.7)**: par-programar fórmulas financeiras e validação de cálculos (Marcelo não confirmou explicitamente, mas é recomendação forte de Claudinho)
- **Modo Professor ativado**: Marcelo é iniciante em programação e quer entender os conceitos — explicações passo-a-passo + alternativas
