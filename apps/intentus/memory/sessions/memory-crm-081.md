# Sessão 81 — CRM F1 Item #8: Cards Customizáveis no Pipeline (~8h, P0) (15/03/2026)

- **Objetivo**: Implementar oitavo item da Fase 1 do plano CRM IA-Native (sessão 73): P02 — Cards Customizáveis no Pipeline. Per-user kanban card customization: toggling field visibility, reordering fields, compact mode
- **Metodologia**: Pair programming Claude (Claudinho) + MiniMax M2.5 (Buchecha). 100% frontend — sem DB migration (reusa `user_table_preferences` existente com `page_key = "kanban-card-fields"`)
- **Decisão arquitetural**: Reutilizar tabela `user_table_preferences` com `page_key = "kanban-card-fields"`. CardPreferences armazenadas como JSON string dentro da coluna `visible_columns` text[]. Sem migração de banco necessária
- **8 tasks implementadas**:
  1. **useCardPreferences.ts** (CRIADO — ~275 linhas): Hook central modelado no useTablePreferences. `ALL_CARD_FIELDS` (9 campos com ícones lucide-react), `REQUIRED_FIELD_IDS` (property_title, status_badge — sempre visíveis), `CardPreferences` interface (visibleFields + compact). Read/write via `user_table_preferences` com upsert on `(user_id, page_key, tenant_id)`. Debounced 500ms save com optimistic update. `ensureRequiredFields()` utility
  2. **CardFieldsCustomizer.tsx** (CRIADO — ~307 linhas): Dialog UI com checkboxes per field (required fields locked com Lock icon), reorder up/down, compact mode Switch, reset to defaults. Local draft state synced on dialog open
  3. **KanbanBoard.tsx** (MODIFICADO): Props expandidas com `isFieldVisible?: (fieldId: string) => boolean` e `compact?: boolean`. KanbanCard condiciona 7 campos opcionais: `isFieldVisible?.("field_id") !== false` (backward compatible). CSS compact mode via ternary
  4. **DealsList.tsx** (MODIFICADO): Integração useCardPreferences + CardFieldsCustomizer dialog + botão SlidersHorizontal. Passa `isFieldVisible` e `compact` ao KanbanBoard
  5. **MiniMax code review**: 4 achados — (1) Double-negative visibility intentional, (2) useEffect sync race low risk, (3) **Debounce cleanup on unmount — FIXADO**, (4) Missing rollback low risk
  6. **Build verification**: `npx tsc --noEmit` = 0 erros ✅
- **MiniMax (Buchecha) code review — achado principal fixado**:
  - **Debounce cleanup on unmount**: `debounceRef` timeout não era limpo no unmount → podia causar state update em componente desmontado. **Fix**: `useEffect` cleanup com `clearTimeout(debounceRef.current)` adicionado em useCardPreferences.ts
  - **Nota técnica**: `minimax_code_review` e `minimax_ask` com `thinking: true` causam timeout. Pattern confiável: `minimax_ask` sem `thinking` com prompt curto
- **Build**: 0 erros TypeScript ✅
- **Arquivos criados** (2):
  - `src/hooks/useCardPreferences.ts` — hook central card preferences (~275 linhas)
  - `src/components/deals/CardFieldsCustomizer.tsx` — dialog UI customização (~307 linhas)
- **Arquivos modificados** (2):
  - `src/components/deals/KanbanBoard.tsx` — isFieldVisible + compact props em KanbanCard
  - `src/pages/DealsList.tsx` — integração useCardPreferences + CardFieldsCustomizer + botão
- **Cronograma CRM IA-Native**: F1 Item #8 ✅ concluído (P02 Cards Customizáveis). **CRM F1: 8/13 itens concluídos**. Próximo: F1 Item #9
- **CLAUDE.md**: Atualizado automaticamente (auto-save rule sessão 36)
