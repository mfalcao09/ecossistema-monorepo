# Sessão 27 — Completar onboarding + notificações (zero pendências)

- **Objetivo**: Fechar 100% das pendências de onboarding e notificações
- **3 Edge Functions criadas e deployadas**:
  1. **`clm-auto-notifications`** (~433 linhas): 4 triggers automáticos em paralelo via `Promise.all()`:
     - Vencimentos próximos (30/15/7 dias), rascunhos parados (7+ dias), reajustes pendentes, aprovações (2+ dias)
     - IA generativa: OpenRouter → Gemini 2.0 Flash para mensagens contextuais (fallback estático se sem API key)
     - Deduplicação via `wasNotifiedRecently(referenceId, category, daysAgo)`
     - Deploy → version 1, ID `8f23b60d-ceba-4457-a4b6-92d1dccb958d`, ACTIVE
  2. **`send-notification-digest`** (~272 linhas): Email digest diário via Resend:
     - Agrupa notificações não-lidas por usuário → por categoria
     - Respeita `notification_preferences` (email_enabled, frequency)
     - HTML branded com cores Intentus (#1a1a2e, #e2a93b), emojis por categoria, deep links
     - Deploy → version 1, ID `041422b8-e819-495d-8ff9-662fb3774bca`, ACTIVE
  3. **`clm-seed-demo`** (~431 linhas): Dados de demonstração para onboarding:
     - 3 actions: `seed` (criar), `cleanup` (remover), `check` (verificar existência)
     - Demo data: 3 propriedades Piracicaba, 4 pessoas (3 PF + 1 PJ), 3 contratos (ativo/rascunho/expirando), 2 templates
     - Todas entidades marcadas `is_demo: true` + contract_parties vinculadas
     - Deploy → version 1, ID `3403ca36-5b27-413e-a51b-db38011ef88a`, ACTIVE
- **Infraestrutura (via Supabase MCP)**:
  - **4 migrations**: `is_demo` boolean column (default false) nas tabelas `properties`, `contracts`, `people`, `legal_contract_templates` + índices parciais `idx_{table}_is_demo`
  - **2 pg_cron jobs**: `clm-auto-notifications-daily` (08:00 UTC) e `send-notification-digest-daily` (10:00 UTC = 07:00 BRT) via `extensions.http_post()`
- **Frontend — Demo Mode**:
  - **`src/hooks/useDemoMode.ts`** (~141 linhas): Hook com `useQuery` (check, 30s stale) + 2 `useMutation` (seed, cleanup) + `invalidateAll()` (9 query keys)
  - **`CLMOnboardingChecklist.tsx`**: Adicionado `DemoModeSection` component — botão "Experimentar com dados de exemplo" (seed) e "Remover dados de exemplo" (cleanup), com spinners e estados condicionais
- **Frontend — Empty States**: Integrados em `Contracts.tsx` e `TemplatesManager.tsx` (sessão anterior)
- **Arquivos criados/modificados**:
  - `supabase/functions/clm-auto-notifications/index.ts` (CRIADO)
  - `supabase/functions/send-notification-digest/index.ts` (CRIADO)
  - `supabase/functions/clm-seed-demo/index.ts` (CRIADO)
  - `src/hooks/useDemoMode.ts` (CRIADO)
  - `src/components/contracts/CLMOnboardingChecklist.tsx` (MODIFICADO — imports + DemoModeSection)
