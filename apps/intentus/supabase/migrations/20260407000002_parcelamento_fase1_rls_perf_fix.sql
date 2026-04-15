-- =============================================================================
-- Migration: parcelamento_fase1_rls_perf_fix
-- Fix: auth_rls_initplan — envolver auth.uid() em (select auth.uid())
-- Detectado via: get_advisors (performance) após Fase 1
-- Tabelas afetadas: _files, _financial, _reports, _rl_cache
-- =============================================================================

-- files: uploaded_by
DROP POLICY IF EXISTS "dpf_insert_own" ON development_parcelamento_files;
CREATE POLICY "dpf_insert_own" ON development_parcelamento_files FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND uploaded_by = (SELECT auth.uid()));

-- financial: created_by
DROP POLICY IF EXISTS "dpfin_insert_own" ON development_parcelamento_financial;
CREATE POLICY "dpfin_insert_own" ON development_parcelamento_financial FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND created_by = (SELECT auth.uid()));

-- reports: generated_by
DROP POLICY IF EXISTS "dprep_insert_own" ON development_parcelamento_reports;
CREATE POLICY "dprep_insert_own" ON development_parcelamento_reports FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND generated_by = (SELECT auth.uid()));

-- rl_cache: auth.uid() IS NOT NULL
DROP POLICY IF EXISTS "dprlc_select_auth" ON development_parcelamento_rl_cache;
CREATE POLICY "dprlc_select_auth" ON development_parcelamento_rl_cache
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "dprlc_insert_auth" ON development_parcelamento_rl_cache;
CREATE POLICY "dprlc_insert_auth" ON development_parcelamento_rl_cache
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "dprlc_update_auth" ON development_parcelamento_rl_cache;
CREATE POLICY "dprlc_update_auth" ON development_parcelamento_rl_cache
  FOR UPDATE USING ((SELECT auth.uid()) IS NOT NULL);
