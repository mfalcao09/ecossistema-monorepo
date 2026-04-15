-- Sessão 130 — Fix crítico de RLS da tabela developments.
--
-- Sintoma: mesmo com a CHECK constraint já corrigida em 20260408000002,
-- o wizard continuava retornando "new row violates row-level security policy
-- for table developments" ao salvar rascunho. Desta vez era RLS de verdade.
--
-- Root cause: as policies developments_insert/update/delete foram criadas
-- como AS RESTRICTIVE em migração anterior. No PostgreSQL, uma política
-- RESTRICTIVE é um FILTRO ADICIONAL — ela só restringe o que alguma
-- PERMISSIVE já permitiu. Como não existia nenhuma PERMISSIVE cobrindo
-- INSERT/UPDATE/DELETE para `authenticated`, TODAS essas operações eram
-- bloqueadas por padrão, mesmo com is_admin_or_gerente() = true e
-- tenant_id = auth_tenant_id(). SELECT funcionava porque tem 2 policies
-- PERMISSIVE (anon false + auth tenant match).
--
-- Fix: recriar as 3 policies como PERMISSIVE (default do Postgres). A
-- semântica da condição (tenant_id match + is_admin_or_gerente) fica
-- preservada; só muda o "modo" da policy, que agora passa a habilitar a
-- operação em vez de só filtrá-la.
--
-- Reproduzido via SQL direto como role=authenticated + request.jwt.claims:
--   INSERT com RESTRICTIVE  → ERROR 42501
--   INSERT com PERMISSIVE   → OK

DROP POLICY IF EXISTS developments_insert ON public.developments;
DROP POLICY IF EXISTS developments_update ON public.developments;
DROP POLICY IF EXISTS developments_delete ON public.developments;

CREATE POLICY developments_insert ON public.developments
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (tenant_id = auth_tenant_id())
    AND is_admin_or_gerente((SELECT auth.uid()))
  );

CREATE POLICY developments_update ON public.developments
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    (tenant_id = auth_tenant_id())
    AND (
      is_admin_or_gerente((SELECT auth.uid()))
      OR (created_by = (SELECT auth.uid()))
    )
  );

CREATE POLICY developments_delete ON public.developments
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    (tenant_id = auth_tenant_id())
    AND is_admin_or_gerente((SELECT auth.uid()))
  );
