---
name: Hardening RLS Sessão 028
description: 5 achados do Supabase advisors na Sprint 1 foram fechados via migration 20260408_sprint1_hardening_rls — processo_arquivos agora com RLS ON
type: project
---

Hardening RLS aplicado em 08/04/2026 (sessão 028, commit `b0a38d7`, deploy `dpl_4nVQXZqHjaxy3MfgxnboNcS6nEjR` READY):

**Achados fechados:**
- ERROR `rls_disabled_in_public` em `processo_arquivos` (tabela legada da sessão 013, nasceu sem RLS)
- WARN `rls_policy_always_true` em `extracao_sessoes` (1 policy) e `diploma_documentos_comprobatorios` (4 policies)
- WARN `function_search_path_mutable` em `update_processo_arquivos_updated_at`

**Estado final:**
- `processo_arquivos`: RLS ON + 1 policy `authenticated_full_access_processo_arquivos` com `auth.uid() IS NOT NULL`
- `extracao_sessoes`: policy `auth_full_access_extracao` (USING true) → `authenticated_full_access_extracao_sessoes` (auth.uid() IS NOT NULL)
- `diploma_documentos_comprobatorios`: 4 policies recriadas com `auth.uid() IS NOT NULL` (SELECT/INSERT/UPDATE/DELETE separadas)
- `update_processo_arquivos_updated_at()`: `SET search_path = public, pg_temp`

**Why:** Sprint 1 tocou essas 3 tabelas e `get_advisors` expôs dívida de segurança legada. Marcelo optou por fechar antes de Sprint 2 para não carregar o débito adiante.

**How to apply:** Modelo de segurança do ERP é single-tenant FIC — `authenticated` tem acesso total via API routes (cookies ou service_role), `anon` não tem acesso a tabela nenhuma. Novas tabelas devem nascer com RLS ON + policy `auth.uid() IS NOT NULL` para authenticated. Nunca aceitar `USING (true)` — o linter Supabase marca como risco e está certo.
