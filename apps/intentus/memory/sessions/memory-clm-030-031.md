# Sessão 30-31 — Auditoria CLM completa com pair programming Claude + MiniMax (11/03/2026)

- **Objetivo**: Revisão completa do módulo CLM para encontrar erros sistemáticos, código quebrado, links/funcionalidades desconectadas e features órfãs
- **Metodologia**: Pair programming Claude (análise principal) + MiniMax M2.5 (`minimax_code_review` para second opinion em cada arquivo)
- **12 arquivos auditados**:
  1. `src/lib/clmApi.ts` (340 linhas) — API layer do CLM
  2. `src/pages/ClmCommandCenter.tsx` (783 linhas) — Dashboard principal
  3. `src/hooks/useClmDashboard.ts` (51 linhas) — Hook do dashboard
  4. `src/hooks/useClmLifecycle.ts` (139 linhas) — Hook de lifecycle/transições
  5. `src/hooks/useApprovalWorkflow.ts` (343 linhas) — Hook de aprovações (Supabase direto)
  6. `src/components/contracts/PendingApprovalsWidget.tsx` (191 linhas) — Widget de aprovações
  7. `src/components/contracts/ContractDetailDialog.tsx` (237 linhas) — Hub de detalhe do contrato
  8. `src/pages/ClmDashboardV2.tsx` (211 linhas) — Dashboard V2 (não ativo)
  9. `src/pages/ClmSettings.tsx` (61 linhas) — Página de configurações
  10. `src/pages/ClmCobranca.tsx` (23 linhas) — Página de cobrança
  11. `src/App.tsx` (270 linhas) — Rotas CLM
  12. `src/components/AppSidebar.tsx` (629 linhas) — Sidebar navigation
- **28 achados consolidados**:
  - **12 CRÍTICOS**: Falta de tenant_id em clmApi.ts, sem validação de auth, race conditions em aprovações, contractId nunca passado para EFs, sistema dual de aprovações (hook direto vs Edge Function), double data fetching no DashboardV2, helper function recriada a cada render, risco de CSS injection, sem boundary de erro em tabs lazy
  - **11 WARNINGS**: 2 páginas órfãs (ClmSettings e ClmCobranca com rotas mas sem entrada no sidebar), JSDoc incorreto no ClmSettings, PendingApprovalsWidget display-only (sem botões de ação prometidos no JSDoc), tipos `unknown` excessivos na API, sem retry/error handling em queries, tabs sem fallback de carregamento, query keys hardcoded
  - **5 INFO**: Inconsistência de padrões entre componentes, oportunidades de otimização de performance, documentação inline desatualizada, imports não utilizados, patterns de TypeScript subótimos
- **Entregável**: Relatório completo em Word (`docs/auditoria-clm-completa-claude-minimax.docx`, 19KB) com:
  - Capa com branding Intentus
  - Sumário executivo com tabela quantitativa
  - Achados detalhados por severidade
  - Tabela consolidada dos 28 achados
  - Plano de ação em 4 fases (~19h total): Fase 1 segurança (5h), Fase 2 arquitetura (6h), Fase 3 UX/navegação (4h), Fase 4 qualidade (4h)
  - Metodologia com lista de arquivos auditados
- **Arquivo gerado**:
  - `docs/auditoria-clm-completa-claude-minimax.docx` (CRIADO — relatório final)
