# Sessão 51 — Obligation Auto-Extraction via IA + Contract Versioning com Diff Visual (14/03/2026)

- **Objetivo**: Implementar 2 features do roadmap de gaps CLM (sessão 41): (1) Obligation auto-extraction via IA (~12h), (2) Contract versioning com diff visual (~8h)
- **Decisões do Marcelo** (via AskUserQuestion):
  - Obrigações: "Automático com revisão (Recomendado)" — extrair automaticamente mas mostrar preview para aprovar/editar antes de salvar
  - Diff: "Ambos (toggle)" — side-by-side e inline unificado com toggle
  - Ordem: "Obrigações IA primeiro"

#### Feature 1 — Obligation Auto-Extraction via IA
- **Backend**: `parse-contract-ai` v10 deployada — prompt expandido para extrair obrigações (title, description, obligation_type, responsible_party, due_date, recurrence, alert_days_before, source_clause)
- **Componente**: `ObligationPreviewPanel.tsx` (CRIADO, ~250 linhas) — preview/edit/select com checkboxes, edição inline de campos, badges de tipo/responsável, DatePicker
- **Fluxo 1 — Importação IA (novos contratos)**:
  - `AIContractImportDialog.tsx` — `AIPrefillData` expandido com `obligationsData?: AIExtractedObligation[]`
  - `ContractFormDialog.tsx` — Nova tab "Obrigações" com contagem de selecionadas, ObligationPreviewPanel, submit passa `obligationsData` ao `onSubmit`
  - `Contracts.tsx` — `handleCreate` recebe `obligationsData`, cascade insert em `contract_obligations` no `onSuccess` (após contrato criado)
  - **Nota técnica**: `source_clause` não existe na tabela `contract_obligations` — valor concatenado ao campo `description` como `(Ref: cláusula X)`
  - **Nota técnica**: `due_date` é NOT NULL na tabela — filtro `.filter(o => o.selected !== false && o.title && o.due_date)` antes do insert
- **Fluxo 2 — Standalone (contratos existentes)**:
  - `ContractObligationsTab.tsx` — Botão "Extrair com IA" ao lado de "Nova Obrigação"
  - Dialog com 3 steps: upload PDF → processing (extractTextFromPdf + parse-contract-ai) → preview (ObligationPreviewPanel)
  - Batch save com `tenant_id` via `getAuthTenantId()`

#### Feature 2 — Contract Versioning com Diff Visual
- **Lib**: `diff@8.0.3` instalada (com bundled types)
- **Utilitário**: `src/lib/diffUtils.ts` (CRIADO, ~135 linhas) — `stripHtml`, `computeWordDiff`, `computeLineDiff`, `computeSideBySide`, `computeDiffStats`. Interfaces `DiffSegment`, `SideBySideLine`
- **Dialog**: `src/components/contracts/VersionComparisonDialog.tsx` (CRIADO, ~220 linhas):
  - Props: open, onOpenChange, oldVersion, newVersion (ContractVersion)
  - Toggle: "Lado a lado" (side-by-side grid-cols-2 com line numbers) ↔ "Unificado" (inline word diff)
  - Stats bar: palavras adicionadas/removidas com ícones Plus/Minus
  - Suporta dark theme (dark:bg-red-950/20, dark:bg-green-950/20)
- **ContractVersionHistory.tsx** (MODIFICADO):
  - Botão "Comparar" com ícone GitCompareArrows em cada versão (exceto última)
  - `handleCompare(version, index)` — compara version[index+1] (anterior) vs version[index] (nova)
  - Renderiza VersionComparisonDialog
- **ContractRedliningTab.tsx** (MODIFICADO):
  - Import `computeWordDiff` + `DiffSegment` de diffUtils
  - Quando entry tem `original_text` E `proposed_text`: mostra seção "Diff Visual" abaixo dos boxes
  - `RedliningInlineDiff` component: word-level diff inline com spans coloridos (verde=adicionado, vermelho+line-through=removido)
  - Dark theme support

- **Build**: 0 erros TypeScript (`npx tsc --noEmit`)
- **Arquivos criados** (3):
  - `src/components/contracts/ObligationPreviewPanel.tsx` (~250 linhas)
  - `src/lib/diffUtils.ts` (~135 linhas)
  - `src/components/contracts/VersionComparisonDialog.tsx` (~220 linhas)
- **Arquivos modificados** (6):
  - `supabase/functions/parse-contract-ai/index.ts` — v10 com prompt de obrigações
  - `src/components/contracts/AIContractImportDialog.tsx` — obligationsData em AIPrefillData
  - `src/components/contracts/ContractFormDialog.tsx` — tab Obrigações + submit cascade
  - `src/pages/Contracts.tsx` — handleCreate com obligationsData cascade insert
  - `src/components/contracts/tabs/ContractObligationsTab.tsx` — standalone AI extraction dialog
  - `src/components/contracts/ContractVersionHistory.tsx` — botão Comparar + VersionComparisonDialog
  - `src/components/contracts/tabs/ContractRedliningTab.tsx` — inline word diff visual
- **Edge Functions — Versões atualizadas**:
  - `parse-contract-ai` → version 10 (obligation extraction prompt)
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
