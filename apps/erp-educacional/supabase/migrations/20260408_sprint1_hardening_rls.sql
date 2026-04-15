-- Sprint 1 — Hardening RLS (Sessão 028)
-- Corrige 5 achados de get_advisors:
--   1. processo_arquivos: RLS disabled → enable + policy authenticated
--   2. extracao_sessoes: policy USING(true) → auth.uid() IS NOT NULL
--   3. diploma_documentos_comprobatorios: 4 policies USING(true) → auth.uid() IS NOT NULL
--   4. update_processo_arquivos_updated_at: search_path mutável → fixo em public,pg_temp
-- Modelo: single-tenant FIC, authenticated = staff, anon sem acesso.
-- API routes usam service_role (bypassa RLS) ou cookies authenticated.

-- 1) processo_arquivos — habilitar RLS + policy
ALTER TABLE public.processo_arquivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_full_access_processo_arquivos ON public.processo_arquivos;
CREATE POLICY authenticated_full_access_processo_arquivos
  ON public.processo_arquivos
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2) extracao_sessoes — trocar policy USING(true) por auth.uid() IS NOT NULL
DROP POLICY IF EXISTS auth_full_access_extracao ON public.extracao_sessoes;
CREATE POLICY authenticated_full_access_extracao_sessoes
  ON public.extracao_sessoes
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3) diploma_documentos_comprobatorios — substituir as 4 policies USING(true)
DROP POLICY IF EXISTS ddc_authenticated_select ON public.diploma_documentos_comprobatorios;
DROP POLICY IF EXISTS ddc_authenticated_insert ON public.diploma_documentos_comprobatorios;
DROP POLICY IF EXISTS ddc_authenticated_update ON public.diploma_documentos_comprobatorios;
DROP POLICY IF EXISTS ddc_authenticated_delete ON public.diploma_documentos_comprobatorios;

CREATE POLICY ddc_authenticated_select
  ON public.diploma_documentos_comprobatorios
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY ddc_authenticated_insert
  ON public.diploma_documentos_comprobatorios
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY ddc_authenticated_update
  ON public.diploma_documentos_comprobatorios
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY ddc_authenticated_delete
  ON public.diploma_documentos_comprobatorios
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 4) Função trigger com search_path fixo
ALTER FUNCTION public.update_processo_arquivos_updated_at()
  SET search_path = public, pg_temp;

COMMENT ON POLICY authenticated_full_access_processo_arquivos ON public.processo_arquivos IS
  'Sprint 1 hardening (sessão 028): bloqueia anon, authenticated tem acesso total. API routes usam service_role (bypass) ou cookies authenticated.';
COMMENT ON POLICY authenticated_full_access_extracao_sessoes ON public.extracao_sessoes IS
  'Sprint 1 hardening (sessão 028): substituiu auth_full_access_extracao que tinha USING(true) — modelo single-tenant FIC.';
