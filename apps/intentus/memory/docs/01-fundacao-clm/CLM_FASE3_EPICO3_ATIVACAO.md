# CLM Fase 3 — Épico 3: IA Real via Edge Functions

## Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useContractAI.ts` | Hook unificado com 6 mutations para Edge Functions reais |
| `src/components/contracts/ContractDraftWizard.tsx` | Wizard de 6 etapas para gerar minutas via IA |
| `src/components/contracts/ClauseExtractor.tsx` | Extrator de cláusulas com análise de risco |
| `src/components/contracts/LegalChatbot.tsx` | Chatbot jurídico com histórico de conversa |

## Edge Functions Utilizadas

| Edge Function | Descrição | Hook |
|---------------|-----------|------|
| `contract-draft-ai` | Gera minutas completas de contratos | `useDraftContract()` |
| `extract-clauses-ai` | Extrai e analisa cláusulas de documentos | `useExtractClauses()` |
| `parse-contract-ai` | Parseia contrato completo (partes, valores, datas) | `useParseContract()` |
| `default-risk-ai` | Calcula risco de inadimplência | `useDefaultRisk()` |
| `clm-ai-insights` | Gera insights sobre contrato/portfólio | `useCLMAIInsights()` |
| `legal-chatbot` | Chatbot jurídico contextual | `useLegalChatbot()` |

## Dependências

Nenhuma dependência nova necessária — usa apenas libs já instaladas no projeto.

## Como Ativar

### Passo 1: Adicionar botões/triggers nos componentes existentes

No arquivo do dashboard CLM ou na lista de contratos, importe os 3 componentes:

```tsx
import ContractDraftWizard from "@/components/contracts/ContractDraftWizard";
import ClauseExtractor from "@/components/contracts/ClauseExtractor";
import LegalChatbot from "@/components/contracts/LegalChatbot";
```

### Passo 2: Adicionar states para controlar abertura dos diálogos

```tsx
const [showDraftWizard, setShowDraftWizard] = useState(false);
const [showClauseExtractor, setShowClauseExtractor] = useState(false);
const [showLegalChat, setShowLegalChat] = useState(false);
```

### Passo 3: Adicionar botões de ação

```tsx
<Button onClick={() => setShowDraftWizard(true)} className="gap-1">
  <Sparkles className="h-4 w-4" />
  Gerar Minuta com IA
</Button>

<Button onClick={() => setShowClauseExtractor(true)} variant="outline" className="gap-1">
  <FileSearch className="h-4 w-4" />
  Extrair Cláusulas
</Button>

<Button onClick={() => setShowLegalChat(true)} variant="outline" className="gap-1">
  <Scale className="h-4 w-4" />
  Chatbot Jurídico
</Button>
```

### Passo 4: Renderizar os componentes

```tsx
<ContractDraftWizard
  open={showDraftWizard}
  onOpenChange={setShowDraftWizard}
  onDraftCreated={(result) => {
    console.log("Minuta gerada:", result);
    // Opcional: salvar no banco, abrir editor, etc.
  }}
/>

<ClauseExtractor
  open={showClauseExtractor}
  onOpenChange={setShowClauseExtractor}
  contractId={selectedContractId} // opcional
/>

<LegalChatbot
  open={showLegalChat}
  onOpenChange={setShowLegalChat}
  contractId={selectedContractId} // opcional
  contractTitle={selectedContractTitle} // opcional
/>
```

### Passo 5: Importar ícones

```tsx
import { Sparkles, FileSearch, Scale } from "lucide-react";
```

## Funcionalidades por Componente

### ContractDraftWizard
- **6 etapas**: Tipo → Partes → Valores → Datas → Garantias → Cláusulas
- **12 tipos** de contrato suportados
- **10 qualificações** de partes (locador, locatário, comprador, etc.)
- **5 tipos** de garantia
- **5 índices** de reajuste
- Cláusulas especiais customizadas
- Instruções adicionais para a IA
- Preview da minuta gerada em HTML
- Copiar/baixar HTML gerado
- Stepper visual com navegação entre etapas

### ClauseExtractor
- Input via **texto colado** ou **URL de documento**
- Vinculação opcional a contrato existente
- Cards por risco: Alto / Médio / Baixo
- Accordion com cada cláusula extraída
- Categoria da cláusula com badge colorido
- Nível de risco por cláusula
- Notas da IA sobre cada cláusula
- Partes identificadas automaticamente
- Datas importantes extraídas
- Copiar cláusulas individuais

### LegalChatbot
- Interface de chat conversacional
- **6 perguntas sugeridas** para começar
- Histórico de conversa enviado ao backend
- Badge de **confiança** da resposta
- Fontes citadas na resposta
- Cláusulas relacionadas
- Contexto de contrato (quando vinculado)
- Indicador de carregamento (typing)
- Limpar conversa
- Disclaimer jurídico no rodapé

## Sobre as Edge Functions

Todas as Edge Functions são chamadas via `supabase.functions.invoke()` com JWT automático (RLS).
O hook `useContractAI.ts` substitui o antigo `useContractAIInsights.ts` que usava `rule_engine_v1` (simulação local).

> **Importante**: As Edge Functions precisam estar implantadas no Supabase com o código correto de IA. O hook apenas faz as chamadas — a inteligência reside no backend.

## Commit Sugerido

```
feat(clm): add real AI components via Edge Functions (Phase 3 Epic 3)

- Create useContractAI hook with 6 mutation hooks for Edge Functions
- Create ContractDraftWizard with 6-step wizard for AI contract drafting
- Create ClauseExtractor with risk analysis and clause parsing
- Create LegalChatbot with conversational interface and context
- Support all 6 Edge Functions: draft, extract, parse, risk, insights, chat
- Replace rule_engine_v1 simulation with real AI calls
```
