# Sessão 35 — Fixes Auditoria Sessão 34: Fase 1 Segurança Crítica (12/03/2026)

- **Objetivo**: Implementar Fase 1 (Segurança Crítica) do plano de ação da auditoria sessão 34, usando MiniMax como pair programmer (Thor + Mjölnir)
- **Metodologia**: Claude = Thor (commander/planner/reviewer), MiniMax = Mjölnir (heavy lifter/code generator). Claude SEMPRE revisa output do MiniMax antes de aplicar. Config salva em `memory/context/minimax-config.md`
- **7 fixes de segurança aplicados em 4 Edge Functions + 1 hook frontend**:
  1. **CORS whitelist (4 EFs)**: Substituído wildcard `*` por env var `ALLOWED_ORIGINS` + fallback regex para dev (`localhost`, `127.0.0.1`) e preview deploys (`intentus-plataform-.+.vercel.app`). Exact domain matching para produção (`intentus-plataform.vercel.app`)
  2. **Optimistic locking — contract transition** (`clm-contract-api`): UPDATE com WHERE `status = from_status` + `.select("id")` + check `updated.length === 0` → 409 CONCURRENT_MODIFICATION
  3. **Optimistic locking — approvals** (`clm-approvals-api`): approve/reject/delegate com WHERE `status = "pendente"` + check rows affected → 409
  4. **Approver identity check** (`clm-approvals-api`): `approval.approver_id !== user.id` → 403 "Você não é o aprovador designado"
  5. **Delegate same-tenant validation** (`clm-approvals-api`): Verifica que `delegate_to` pertence ao mesmo tenant via profiles lookup
  6. **Batch validation** (`clm-obligations-api`): `MAX_BATCH_SIZE = 100`, validação campo-a-campo (title required max 255, date format YYYY-MM-DD com roundtrip `Date` parse)
  7. **Atomic use_count** (`clm-templates-api`): RPC `increment_template_use_count` (fire-and-forget) substituindo read-then-write não-atômico
  8. **Optimistic locking — startWorkflow** (`useApprovalWorkflow.ts`): UPDATE contract status FIRST como lock atômico → verify lock → INSERT approval steps → rollback on failure
  9. **Error sanitization (4 EFs)**: `console.error(detail)` + mensagem genérica ao cliente (sem stack traces, column names, SQL errors)
- **4 Edge Functions deployadas no Supabase**:
  - `clm-contract-api` → version 12, ACTIVE
  - `clm-approvals-api` → version 10, ACTIVE
  - `clm-obligations-api` → version 10, ACTIVE
  - `clm-templates-api` → version 7, ACTIVE
- **Verificação MiniMax**: Code review pós-fixes aprovado. Achados foram falsos positivos do summary simplificado (código real correto)
- **Investigação false positive**: Audit flagou `createNotification` sem `tenant_id` em `ApprovalWorkflowPanel.tsx` — investigação revelou que `createNotification` já resolve tenant_id internamente via `getAuthTenantId()`. Sem fix necessário.
- **Arquivos modificados** (8 arquivos):
  - `supabase/functions/clm-contract-api/index.ts` — CORS + optimistic lock transition + error sanitization
  - `supabase/functions/clm-approvals-api/index.ts` — CORS + approver identity + delegate validation + optimistic lock + error sanitization
  - `supabase/functions/clm-obligations-api/index.ts` — CORS + batch validation (size limit, field validation, date parsing) + error sanitization
  - `supabase/functions/clm-templates-api/index.ts` — CORS + atomic RPC use_count + error sanitization
  - `src/hooks/useApprovalWorkflow.ts` — optimistic locking no startWorkflow (4-step: lock → verify → insert → rollback)
  - `src/lib/clmApi.ts` — (mantido com fixes anteriores)
  - `memory/context/minimax-config.md` — Thor + Mjölnir workflow config
  - `CLAUDE.md` — atualizado com sessão 35
