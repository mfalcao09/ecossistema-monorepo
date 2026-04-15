# Sessão 57 — F1 Item #5: Bulk Operations em Contratos (14/03/2026)

- **Objetivo**: Implementar quinto item do cronograma IA-Native (F1): Operações em lote para contratos — seleção múltipla + 6 ações bulk
- **Decisões do Marcelo** (via AskUserQuestion):
  - Escopo: "Completo (Recomendado)" — 6 ações: transição status, export CSV, export PDF (futuro), excluir, atribuir responsável, renovação em lote. Toolbar flutuante com contagem de seleção
  - Localização: "Página Contratos + Command Center (Recomendado)" — checkboxes na tabela de contratos + integração no Command Center
- **3 arquivos criados**:
  1. **`src/hooks/useBulkContractOps.ts`** (CRIADO, ~280 linhas): Hook central com 5 sub-hooks + 1 export function:
     - `useBulkSelection(contracts)`: Set<string> selection state, toggle/toggleAll/clearSelection, isAllSelected/isPartiallySelected, selectedContracts filtered array
     - `useBulkTransition()`: Promise.allSettled, update status + lifecycle event, succeeded/failed counts
     - `useBulkDelete()`: Cascade delete (parties, installments, obligations, redlining) then contract, tenant-scoped
     - `useBulkAssign()`: Update contract notes com nome do responsável
     - `useBulkRenewal()`: Transiciona ativo/expirado → renovado com lifecycle event
     - `exportContractsCsv()`: Client-side CSV com BOM UTF-8, 12 colunas, Blob download
  2. **`src/components/contracts/BulkActionsToolbar.tsx`** (CRIADO, ~297 linhas): Floating bottom toolbar:
     - Aparece quando 1+ contratos selecionados, animate-in from bottom
     - 6 botões: Transição (ArrowRightLeft), CSV (Download), Atribuir (UserPlus), Renovar (RefreshCw), Excluir (Trash2), Limpar (X)
     - RBAC guards: `canDeleteContract` para excluir, `canTransitionContract` para transição
     - Common transition targets: interseção das transições válidas de TODOS os contratos selecionados
     - 4 AlertDialogs: transição (com Select de status), exclusão (destructive), atribuição (text input), renovação
     - isPending tracking para desabilitar botões durante mutations
  3. **`src/pages/Contracts.tsx`** (MODIFICADO): Integração completa:
     - Import `useBulkSelection`, `BulkActionsToolbar`, `Checkbox`
     - Checkbox column no header (com "select all" e indeterminate state)
     - Checkbox em cada row com `data-state="selected"` para highlight visual
     - `BulkActionsToolbar` renderizado após a tabela
     - `colSpan` do empty state atualizado para incluir coluna checkbox
- **Build**: 0 erros TypeScript (`npx tsc --noEmit`) ✅
- **Arquivos criados** (2):
  - `src/hooks/useBulkContractOps.ts` — hook de seleção + 5 mutations + CSV export
  - `src/components/contracts/BulkActionsToolbar.tsx` — toolbar flutuante com 6 ações
- **Arquivos modificados** (1):
  - `src/pages/Contracts.tsx` — checkbox column + useBulkSelection + BulkActionsToolbar
- **Cronograma IA-Native**: F1 Item #5 ✅ concluído. F1 completa (5/5 itens). Próximo: F2 Item #1 Auto-Compliance Monitoring
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
