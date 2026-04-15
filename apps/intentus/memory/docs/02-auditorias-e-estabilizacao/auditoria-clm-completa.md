# Auditoria CLM Completa — Claude + MiniMax (Sessões 30-31)

**Data**: 11/03/2026
**Metodologia**: Pair programming — Claude (análise principal) + MiniMax M2.5 (second opinion via `minimax_code_review`)
**Entregável**: `docs/auditoria-clm-completa-claude-minimax.docx`

## Resumo Quantitativo

| Severidade | Quantidade |
|-----------|-----------|
| CRITICAL | 12 |
| WARNING | 11 |
| INFO | 5 |
| **TOTAL** | **28** |

## 12 Arquivos Auditados

1. `src/lib/clmApi.ts` — API layer
2. `src/pages/ClmCommandCenter.tsx` — Dashboard principal
3. `src/hooks/useClmDashboard.ts` — Hook dashboard
4. `src/hooks/useClmLifecycle.ts` — Hook lifecycle
5. `src/hooks/useApprovalWorkflow.ts` — Hook aprovações
6. `src/components/contracts/PendingApprovalsWidget.tsx` — Widget aprovações
7. `src/components/contracts/ContractDetailDialog.tsx` — Hub detalhe
8. `src/pages/ClmDashboardV2.tsx` — Dashboard V2
9. `src/pages/ClmSettings.tsx` — Configurações
10. `src/pages/ClmCobranca.tsx` — Cobrança
11. `src/App.tsx` — Rotas
12. `src/components/AppSidebar.tsx` — Sidebar

## Achados Principais (CRITICAL)

1. **clmApi.ts sem tenant_id** — Nenhuma chamada passa tenant_id para as Edge Functions
2. **clmApi.ts sem validação de auth** — Não verifica sessão ativa antes de chamar EFs
3. **useApprovalWorkflow race conditions** — approve/reject sem transaction, possível double-approval
4. **useApprovalWorkflow sem tenant_id** — Queries diretas no Supabase sem filtro tenant
5. **useApprovalWorkflow sem authorization** — Não verifica se user tem permissão para aprovar
6. **useClmLifecycle contractId nunca passado** — `contractId` param nunca enviado para EFs
7. **Sistema dual de aprovações** — useApprovalWorkflow (Supabase direto) vs useClmLifecycle (Edge Functions) = arquitetura conflitante
8. **ClmDashboardV2 double data fetching** — Renderiza ClmCommandCenter como sub-componente, duplicando ALL queries
9. **ContractDetailDialog helper recriada por render** — `getStatusColor()` inline no componente
10. **ContractDetailDialog CSS injection risk** — String interpolation no className sem sanitização
11. **ContractDetailDialog sem ErrorBoundary** — Lazy tabs sem boundary de erro = crash propaga
12. **Tipos `unknown` excessivos** — clmApi.ts usa `unknown` em vez de tipos específicos

## Plano de Ação (4 Fases, ~19h)

| Fase | Foco | Estimativa | Prioridade |
|------|------|-----------|------------|
| 1 | Segurança (tenant_id, auth, race conditions) | 5h | URGENTE |
| 2 | Arquitetura (unificar aprovações, eliminar DashboardV2) | 6h | ALTA |
| 3 | UX/Navegação (páginas órfãs, sidebar, empty states) | 4h | MÉDIA |
| 4 | Qualidade (types, performance, error boundaries) | 4h | NORMAL |

## Status
- ✅ Auditoria concluída
- ✅ Relatório .docx entregue
- 📋 Plano de ação pendente de execução (aguardando decisão de Marcelo)
