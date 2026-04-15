

## Estado Atual — O que já existe

O sistema tem:
- `ContractRenewalTab.tsx`: lista contratos vencidos/vencendo + dialogs de renovação
- `contract_renewals` (tabela): campos básicos de renovação (datas, valor, índice, checklist)
- `contract_documents` (tabela + bucket `contract-documents`): armazena arquivos vinculados ao contrato
- `ContractDocumentsTab.tsx`: upload/download/status de documentos
- `parse-contract-ai` (Edge Function): já usa Gemini para extrair dados de contratos PDF/DOCX

**O que o usuário pediu:**
1. Botão "Renovação Realizada" que lê o aditivo com IA e preenche os campos automaticamente
2. Aditivo deve ficar arquivado dentro do contrato
3. Soluções que o usuário não pensou
4. Meta: ser o software #3 do mercado

---

## Análise de Gaps e Oportunidades (o que o usuário não pensou)

### 1. IA Lendo o Aditivo (o pedido explícito)
Usar a Edge Function de IA já existente (`parse-contract-ai`) ou criar uma nova (`parse-addendum-ai`) para extrair do PDF/DOCX do aditivo:
- Nova data de vigência
- Novo valor mensal
- Índice e percentual de reajuste
- Cláusulas modificadas
- Qualificação das partes (se atualizada)

### 2. Rastreabilidade Completa de Histórico (não pensado)
Hoje a tabela `contract_renewals` não tem vínculo direto com o documento do aditivo. Falta:
- `addendum_document_id` (FK para `contract_documents`) — rastreia qual arquivo gerou a renovação
- `ai_extracted` (boolean) — sinaliza que os campos foram preenchidos por IA
- `ai_raw_output` (jsonb) — guarda a resposta bruta da IA para auditoria

### 3. Timeline de Vigência Visual (não pensado)
O contrato poderia exibir uma linha do tempo visual mostrando:
- Vigência original → Renovação 1 → Renovação 2 → Renovação Atual
- Cada ponto clicável que abre o aditivo correspondente
Isso é um diferencial competitivo enorme vs sistemas que mostram só a data atual.

### 4. Notificação Automática às Partes (não pensado)
Após formalização da renovação, disparar e-mail/WhatsApp automático para locatário e proprietário com:
- Resumo da renovação (nova vigência, novo valor)
- Link para download do aditivo assinado
- Próximo vencimento do reajuste

### 5. Score de Risco da Renovação por IA (não pensado — diferencial de mercado)
Ao enviar o aditivo, a IA analisa e gera um "score de risco da renovação":
- Verifica se o reajuste aplicado está dentro dos índices oficiais do período
- Alerta se o novo prazo ultrapassa o máximo recomendado para locação residencial (30 meses sem FGTS)
- Detecta cláusulas abusivas ou irregulares no aditivo importado

---

## Plano de Implementação

### Fase 1: Migração DB — Enriquecer `contract_renewals`

Adicionar colunas à tabela `contract_renewals`:
```sql
ALTER TABLE contract_renewals
  ADD COLUMN IF NOT EXISTS addendum_document_id uuid REFERENCES contract_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS addendum_file_path text,
  ADD COLUMN IF NOT EXISTS addendum_title text,
  ADD COLUMN IF NOT EXISTS ai_extracted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_raw_output jsonb,
  ADD COLUMN IF NOT EXISTS ai_risk_score integer,           -- 0-100
  ADD COLUMN IF NOT EXISTS ai_risk_flags jsonb,             -- array de alertas
  ADD COLUMN IF NOT EXISTS formalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS formalized_by uuid;
```

### Fase 2: Nova Edge Function `parse-addendum-ai`

Criar `supabase/functions/parse-addendum-ai/index.ts` que:
1. Recebe `addendum_text` (texto extraído do PDF/DOCX via `pdfjs-dist` no frontend)
2. Chama Gemini com prompt especializado para aditivos de renovação
3. Extrai: `new_end_date`, `new_value`, `adjustment_index`, `adjustment_pct`, `modified_clauses`, `parties_updated`, `detected_risks`
4. Retorna JSON estruturado + `risk_score` (0-100) baseado nas regras brasileiras

Schema de extração via tool-calling:
```typescript
tools: [{
  functionDeclarations: [{
    name: "extract_addendum_data",
    parameters: {
      type: "OBJECT",
      properties: {
        new_end_date: { type: "STRING" },          // ISO date
        new_value: { type: "NUMBER" },              // R$
        adjustment_index: { type: "STRING" },       // IGP-M, IPCA, etc.
        adjustment_pct: { type: "NUMBER" },         // %
        addendum_number: { type: "STRING" },        // ex: "1º Aditivo"
        effective_date: { type: "STRING" },         // data de assinatura
        modified_clauses: { type: "ARRAY" },        // cláusulas alteradas
        risk_flags: { type: "ARRAY" },              // alertas detectados
        risk_score: { type: "INTEGER" },            // 0-100
        summary: { type: "STRING" },               // resumo executivo
      }
    }
  }]
}]
```

### Fase 3: Dialog `RenovacaoRealizadaDialog` — Fluxo em 3 Etapas

```
PASSO 1: Upload do Aditivo
┌─────────────────────────────────────────────────────┐
│ 📎 Arraste ou selecione o aditivo assinado          │
│    (PDF, DOCX, JPG) — máx. 20MB                     │
│                                                      │
│ [Analisar com IA] ← chama parse-addendum-ai         │
└─────────────────────────────────────────────────────┘

PASSO 2: Dados Extraídos (pré-preenchidos pela IA)
┌─────────────────────────────────────────────────────┐
│ ✓ IA identificou: "1º Aditivo de Renovação"         │
│                                                      │
│ Nova Vigência *   [25/06/2026] ← pré-preenchido    │
│ Novo Valor        [R$ 3.500,00] ← pré-preenchido   │
│ Índice            [IGP-M ▼] ← pré-preenchido       │
│ % Reajuste        [4,83%] ← pré-preenchido         │
│ Data Assinatura   [10/02/2026]                      │
│ Observações       [...]                             │
│                                                      │
│ ⚠️ Score de Risco: 85/100 — "Reajuste dentro       │
│    do índice oficial. Prazo compatível com lei."    │
└─────────────────────────────────────────────────────┘

PASSO 3: Confirmação
┌─────────────────────────────────────────────────────┐
│ Resumo das alterações no contrato:                  │
│  • Vigência: 25/06/2024 → 25/06/2026               │
│  • Valor: R$ 3.200,00 → R$ 3.500,00 (+9,37%)       │
│  • Aditivo arquivado em: Documentos do Contrato    │
│                                                      │
│ [◀ Voltar]        [✔ Confirmar e Formalizar]        │
└─────────────────────────────────────────────────────┘
```

### Fase 4: Ações automáticas ao confirmar

1. **Upload** do arquivo para bucket `contract-documents`
2. **Insert** em `contract_documents` com `document_type = "aditivo"`, `status = "assinado"`
3. **Insert** em `contract_renewals` com `status = "formalizada"`, `addendum_document_id`, `ai_extracted = true`, `ai_raw_output`
4. **Update** no contrato: `end_date`, `monthly_value` (se alterado)
5. **Insert** em `contract_audit_trail`: ação `"renovacao_formalizada"` com detalhes
6. **Insert** em `property_price_history` (se valor mudou)
7. **Update** em `properties.rental_price` (se valor mudou)

### Fase 5: Badge "Aditivo" no Histórico de Renovações

Na tabela de renovações formalizadas, adicionar coluna "Aditivo" com:
- ícone de clipe 📎 + nome do arquivo
- clique abre download via signed URL do bucket

### Botão "Renovação Realizada" — Posicionamento

Aparece em **ambas** as seções (Vencidos + Próximos do Vencimento), ao lado de "Iniciar Renovação":

```
Antes:
[↺ Iniciar Renovação]

Depois:
[↺ Iniciar Renovação]  [✔ Renovação Realizada]
                           (verde, ícone CheckCircle)
```

Para a seção "Em andamento", o botão "Renovação Realizada" também aparece no final da linha de cada renovação, permitindo finalizar uma renovação que estava em rascunho importando o aditivo.

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `supabase/migrations/xxx.sql` | ADD COLUMNS em `contract_renewals`, ADD action label em `contract_audit_trail` |
| `supabase/functions/parse-addendum-ai/index.ts` | CRIAR — Edge Function Gemini para extrair dados do aditivo |
| `src/components/contracts/ContractRenewalTab.tsx` | MODIFICAR — novo `RenovacaoRealizadaDialog` (3 passos), botões nas tabelas, badge de aditivo no histórico |
| `src/hooks/useContractRenewals.ts` | MODIFICAR — `useCreateRenewal` e `useApplyRenewal` para suportar `addendum_document_id`, `ai_extracted`, etc. |
| `src/lib/clmSchema.ts` | MODIFICAR — adicionar `"renovacao_formalizada"` em `auditActionLabels` |

---

## Diferenciais Competitivos Exclusivos ("software #3 do mercado")

| Feature | Concorrentes | Nossa Solução |
|---------|-------------|---------------|
| Import de aditivo | Manual (digita tudo) | IA extrai todos os campos + score de risco |
| Rastreabilidade | Data de renovação | Timeline visual de toda a história do contrato |
| Compliance | Nenhuma validação | IA alerta sobre reajuste acima do índice oficial |
| Arquivo | Pasta genérica | Aditivo vinculado diretamente à renovação + download 1-clique |
| Auditoria | Log básico | Quem fez, quando, o que a IA extraiu, o que foi editado manualmente |

