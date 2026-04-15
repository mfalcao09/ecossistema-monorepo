# Sessão 33 — Fixes da Auditoria CLM: Fase 3 (UX/Nav) + Fase 4 (Qualidade) (12/03/2026)

- **Fase 3 — UX/Navegação** (4 tasks):
  - **Task 7 — Páginas órfãs no sidebar**: `AppSidebar.tsx` — adicionados 2 NavItems na seção CLM:
    - "Configurações CLM" (`/contratos/configuracoes`, ícone Settings, roles: admin/gerente)
    - "Cobrança" (`/contratos/cobranca`, ícone DollarSign)
  - **Task 8 — ClmSettings completo**: `ClmSettings.tsx` — adicionado TemplatesManager abaixo de ApprovalRulesManager + JSDoc atualizado
  - **Task 9 — Header ClmCobranca**: `ClmCobranca.tsx` — header padronizado com ícone DollarSign, botão voltar (ArrowLeft → Command Center), título e descrição
  - **Task 10 — Error states no detalhe**: `ContractDetailDialog.tsx` — adicionado estado de erro entre loading e contract (error UI com mensagem), `overflow-x-auto` na TabsList para tabs que não cabem
- **Fase 4 — Qualidade de Código** (3 tasks):
  - **Task 11 — Remoção de `as unknown as`**: `useApprovalWorkflow.ts` — 3 edits:
    1. `fetchContractApprovals()`: `(data || []) as unknown as` → `(data ?? []) as`
    2. `fetchMyPendingApprovals()`: Removido `Record<string, unknown>` intermediário, substituído `as string`/`as number` por `String()`/`Number()`, `||` → `??`, `as const` no Map
    3. `startApprovalWorkflow()`: Removido `.insert(steps as Record<string, unknown>[])` → `.insert(steps)`
  - **Task 12 — Performance helpers**: Já concluído na sessão 32 (helpers extraídos fora do render)
  - **Task 13 — Retry config**: `useClmDashboard.ts` — adicionado `retry: 2` nos 3 hooks (useClmDashboard, useClmObligationsDashboard, useClmPendingApprovals)
- **Build**: 0 erros TypeScript após todas as alterações
- **Resultado**: Plano de ação da auditoria CLM 100% concluído (4 fases, ~19h estimadas)
- **Arquivos alterados** (7 arquivos):
  - `src/components/AppSidebar.tsx` — 2 novos NavItems CLM
  - `src/pages/ClmSettings.tsx` — TemplatesManager + JSDoc
  - `src/pages/ClmCobranca.tsx` — header padronizado com navegação
  - `src/components/contracts/ContractDetailDialog.tsx` — error state + overflow-x-auto
  - `src/hooks/useApprovalWorkflow.ts` — type safety (removido as unknown as, String/Number, ??)
  - `src/hooks/useClmDashboard.ts` — retry: 2 em 3 hooks
