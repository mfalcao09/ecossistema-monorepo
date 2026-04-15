# CLM Fase 2 — Épico 5: Templates e Insights com IA

## Resumo

Este épico entrega duas funcionalidades:
1. **Gerenciador de Templates** — CRUD completo para templates de contratos
2. **Painel de Insights com IA** — Análise de risco e sugestões por contrato e portfólio

---

## Arquivos Criados

### Hooks (lógica de dados)
| Arquivo | Função |
|---------|--------|
| `src/hooks/useContractTemplates.ts` | CRUD de templates (buscar, criar, editar, excluir, duplicar) |
| `src/hooks/useContractAIInsights.ts` | Análise IA, overview, insights de portfólio, simulação |

### Componentes (interface)
| Arquivo | Função |
|---------|--------|
| `src/components/contracts/TemplatesManager.tsx` | UI completa do gerenciador de templates |
| `src/components/contracts/AIInsightsPanel.tsx` | Painel de insights IA (portfólio + ranking + análise individual) |

---

## Passo a Passo para Ativação

### 1. Integrar na página ClmSettings.tsx

Abra `src/pages/ClmSettings.tsx` e adicione os imports e as novas tabs:

```tsx
// Adicionar estes imports no topo do arquivo:
import TemplatesManager from "@/components/contracts/TemplatesManager";
import AIInsightsPanel from "@/components/contracts/AIInsightsPanel";
```

No componente de tabs (Tabs/TabsList), adicione dois novos TabsTrigger:

```tsx
<TabsTrigger value="templates">Templates</TabsTrigger>
<TabsTrigger value="ai-insights">Insights IA</TabsTrigger>
```

E os respectivos TabsContent:

```tsx
<TabsContent value="templates">
  <TemplatesManager />
</TabsContent>

<TabsContent value="ai-insights">
  <AIInsightsPanel />
</TabsContent>
```

### 2. (Opcional) Usar análise individual em ContractDetail

Se você quiser mostrar a análise IA dentro da página de detalhes de um contrato, importe o `ContractAnalysisPanel`:

```tsx
import { ContractAnalysisPanel } from "@/components/contracts/AIInsightsPanel";

// Dentro do JSX, passe o ID do contrato:
<ContractAnalysisPanel
  contractId={contract.id}
  contractTitle={contract.title}
/>
```

Isso renderiza o painel completo com botão de "Executar Análise", score de risco, fatores, sugestões e histórico.

---

## Tabelas do Supabase Utilizadas

| Tabela | Uso |
|--------|-----|
| `legal_contract_templates` | Armazena os templates de contratos |
| `contract_ai_analysis` | Armazena resultados das análises IA |
| `v_contract_ai_overview` | View que combina contratos + análise (ranking) |
| `contracts` | Lida na análise simulada para gerar risk score |
| `contract_parties` | Verificada na análise para risco de partes ausentes |
| `contract_installments` | Verificada na análise para inadimplência |

---

## Como Funciona a Análise IA

### Versão Atual (rule_engine_v1)
A análise atual usa um **motor de regras** no frontend que verifica:
- Se o contrato tem partes vinculadas (se não → +20 risco)
- Se tem parcelas em atraso (cada parcela → +10 risco)
- Se tem data de término definida (se não → +10 risco)
- Se tem valor definido (se não → +15 risco)
- Gera sugestões baseadas no status e completude

### Evolução Futura (Edge Function + LLM)
Para produção com IA real, a função `simulateAIAnalysis` pode ser substituída por uma chamada a uma Edge Function do Supabase que:
1. Recebe o `contract_id`
2. Busca todos os dados do contrato (texto, partes, parcelas)
3. Envia para a API da OpenAI/Anthropic com prompt estruturado
4. Salva o resultado na tabela `contract_ai_analysis`

---

## Dados Existentes

A tabela `legal_contract_templates` já possui **7 templates** pré-cadastrados:
1. Contrato de Compra e Venda de Imóvel
2. Contrato de Locação Residencial
3. Contrato de Locação Comercial
4. Contrato de Prestação de Serviços
5. Contrato de Comissão de Corretagem
6. Termo de Confidencialidade (NDA)
7. Contrato de Exclusividade de Venda

---

## Funcionalidades do TemplatesManager

- Busca por nome
- Filtro por tipo (13 tipos disponíveis)
- Criar novo template com detecção automática de variáveis `{{nome}}`
- Editar template existente
- Duplicar template (cria cópia com " (Cópia)" no nome)
- Excluir template (com confirmação)
- Preview do template com metadados e variáveis
- Ativar/desativar template
- Grid responsivo (1/2/3 colunas)

## Funcionalidades do AIInsightsPanel

- **Visão Geral do Portfólio**: total de contratos, analisados, cobertura %, risco médio, distribuição
- **Ranking de Risco**: lista de contratos ordenados por risk score
- **Detalhes por contrato**: score, fatores de risco, cláusulas ausentes, sugestões, cláusulas flagradas
- **Análise Individual** (ContractAnalysisPanel): executar análise, ver resultados, histórico

---

## Commit Sugerido

```
feat(clm): add templates manager and AI insights panel (Epic 5)

- Create useContractTemplates hook with full CRUD + duplicate
- Create useContractAIInsights hook with risk analysis engine
- Build TemplatesManager component with search, filter, create/edit/preview
- Build AIInsightsPanel with portfolio overview and risk ranking
- Add ContractAnalysisPanel for individual contract analysis
- Support auto-detection of template variables ({{var}} pattern)
- Implement rule-based risk scoring engine (v1)
```
