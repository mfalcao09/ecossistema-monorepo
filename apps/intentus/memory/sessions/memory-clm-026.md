# Sessão 26 — 4 CLM Edge Functions para Command Center (criação + deploy)

- **Problema**: Command Center do CLM não funcionava — 4 Edge Functions referenciadas pelo frontend (`clmApi.ts`, `useClmDashboard.ts`, `useClmLifecycle.ts`) eram inexistentes no Supabase
  - Frontend tinha API layer completo: interfaces TypeScript, `callClmFunction()` wrapper, React Query hooks (queries + mutations)
  - Todas as chamadas falhavam com erro porque as Edge Functions não existiam
- **Diagnóstico**: Analisou `src/lib/clmApi.ts` (340 linhas) como contrato definitivo — interfaces `ClmDashboardData`, `ApprovalItem`, `ObligationDashboard`, `ContractTemplate` definem exatamente o shape esperado
- **Implementação — 4 Edge Functions criadas do zero**:
  1. **`clm-contract-api`** (~251 linhas): Dashboard CLM + transições de status
     - `dashboard`: 5 queries paralelas (`Promise.all`) — contratos por status, expirando 30d, aprovações pendentes, obrigações vencidas, pagamentos atrasados + 10 lifecycle events recentes
     - `transition`: Valida contra `VALID_TRANSITIONS` map (state machine), atualiza status, registra `contract_lifecycle_events`
  2. **`clm-approvals-api`** (~352 linhas): Workflow de aprovações
     - `pending`: Filtra por `user.id` + status pendente
     - `history`: Aprovações decididas do usuário (limit 50)
     - `approve`: Atualiza + verifica se TODAS etapas aprovadas → auto-transição contrato `em_aprovacao → aguardando_assinatura` + lifecycle event
     - `reject`: Atualiza + retorna contrato para `em_revisao` + lifecycle event (comments obrigatório)
     - `delegate`: Marca original como delegado, cria nova aprovação para `delegate_to` com mesmo step_order/step_name/tenant_id
  3. **`clm-obligations-api`** (~275 linhas): Gestão de obrigações
     - `dashboard`: Classifica por proximidade (active, overdue, due_this_week, due_this_month, future, completed_this_month) + agregação `by_type`
     - `overdue`: Lista detalhada (limit 50), `upcoming`: Próximos N dias (default 30)
     - `batch-create`: Cria múltiplas obrigações em lote, resolve `tenant_id` do contrato
  4. **`clm-templates-api`** (~139 linhas): Templates de contrato
     - `list`: Templates ativos ordenados por nome
     - `render`: Substituição de variáveis `{{var}}` com regex case-insensitive + espaços opcionais + `escapeRegex()` safety + fire-and-forget `use_count` increment
- **Padrão comum**: Todas seguem o mesmo pattern — Deno `serve()`, CORS headers estendidos, Supabase client per-request com auth do usuário, action-based routing, `.maybeSingle()` para lookups
- **Deploy**: 4 Edge Functions deployadas via Supabase MCP (`deploy_edge_function`, verify_jwt: false):
  - `clm-contract-api` → version 7, ID `11b89796-7dc6-4bdb-8b06-cd066e756a4b`, ACTIVE
  - `clm-approvals-api` → version 6, ID `fb19b79e-d896-4cd4-9e20-9c5e49837aa8`, ACTIVE
  - `clm-obligations-api` → version 5, ID `af074a92-3e25-428c-bcc1-f0972fb2cfb3`, ACTIVE
  - `clm-templates-api` → version 2, ID `84aa2100-c26d-4bde-9b6a-0db7c56d6634`, ACTIVE
- **Arquivos criados**:
  - `supabase/functions/clm-contract-api/index.ts` (~251 linhas)
  - `supabase/functions/clm-approvals-api/index.ts` (~352 linhas)
  - `supabase/functions/clm-obligations-api/index.ts` (~275 linhas)
  - `supabase/functions/clm-templates-api/index.ts` (~139 linhas)
