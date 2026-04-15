-- =============================================================================
-- Migration: parcelamento_solo_fase1_schema
-- Módulo: Parcelamento de Solo (Projetos Horizontais)
-- Data: 2026-04-07
-- Revisão: Buchecha (MiniMax M2.7) + Claudinho — fixes aplicados:
--   - Usa update_updated_at() existente (não cria função duplicada)
--   - allowed_transitions usa required_role (não allowed_role) sem entity_type
--   - ON CONFLICT explícito com colunas reais da tabela
--   - Índices tenant_id adicionados em todas as tabelas
--   - Índices is_active adicionados para compliance e reports
--   - RLS usa auth_tenant_id() (função real do banco, não get_auth_tenant_id())
--   - allowed_transitions tenant_id = '...0001' (global system tenant, confirmado via query)
-- Decisões: D1(Opção B), D2(ConvertAPI), D3(OpenTopography), D4(3 módulos MVP), D5(IA-native)
-- Nota crítica: reserva_legal_source rastreia fonte estadual vs federal (FUNDAMENTAL - sessão 117)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. PostGIS — requerido para tipo geography
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- 2. Estender enum development_type
-- ---------------------------------------------------------------------------
ALTER TYPE development_type ADD VALUE IF NOT EXISTS 'condominio';
ALTER TYPE development_type ADD VALUE IF NOT EXISTS 'misto';

-- ---------------------------------------------------------------------------
-- 3. Estender developments com colunas geoespaciais e parcelamento
--    Todas as colunas são nullable — sem lock em tabela com dados existentes
-- ---------------------------------------------------------------------------
ALTER TABLE developments
  -- Geometria (geography = cálculos em metros sem reprojeção)
  ADD COLUMN IF NOT EXISTS geometry               geography(MultiPolygon, 4326),
  ADD COLUMN IF NOT EXISTS centroid               geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS bbox                   jsonb,
  -- Medidas calculadas
  ADD COLUMN IF NOT EXISTS area_m2                numeric(14,2),
  ADD COLUMN IF NOT EXISTS area_ha                numeric(10,4),
  ADD COLUMN IF NOT EXISTS perimeter_m            numeric(12,2),
  -- Arquivo-fonte enviado pelo usuário
  ADD COLUMN IF NOT EXISTS source_file_url        text,
  ADD COLUMN IF NOT EXISTS source_file_format     text
    CHECK (source_file_format IN ('kml','kmz','dxf','geojson','shp','manual')),
  -- Elevação — OpenTopography SRTM 30m (D3)
  ADD COLUMN IF NOT EXISTS elevation_grid         jsonb,
  ADD COLUMN IF NOT EXISTS elevation_source       text,
  ADD COLUMN IF NOT EXISTS elevation_min          numeric(8,2),
  ADD COLUMN IF NOT EXISTS elevation_max          numeric(8,2),
  ADD COLUMN IF NOT EXISTS elevation_avg          numeric(8,2),
  ADD COLUMN IF NOT EXISTS slope_avg_pct          numeric(6,2),
  -- Fluxo de análise (4 passos do módulo)
  ADD COLUMN IF NOT EXISTS analysis_status        text DEFAULT 'pending'
    CHECK (analysis_status IN (
      'pending','geo_analyzing','geo_done',
      'financial_done','legal_done','complete','error'
    )),
  ADD COLUMN IF NOT EXISTS analysis_results       jsonb DEFAULT '{}'::jsonb,
  -- APP e Reserva Legal
  ADD COLUMN IF NOT EXISTS app_area_m2            numeric(14,2),
  ADD COLUMN IF NOT EXISTS reserva_legal_area_m2  numeric(14,2),
  ADD COLUMN IF NOT EXISTS reserva_legal_pct      numeric(5,2),
  -- CRÍTICO (sessão 117): fonte da RL — estadual é mais precisa e legalmente relevante
  -- Valores: 'estadual_sp' | 'estadual_ms' | 'estadual_mg' | 'sicar_federal' | 'estimativa'
  ADD COLUMN IF NOT EXISTS reserva_legal_source   text;

-- Índices geoespaciais (GIST para geography)
CREATE INDEX IF NOT EXISTS idx_developments_geometry
  ON developments USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_developments_centroid
  ON developments USING GIST (centroid);

-- Índice composto para queries de listagem por tenant + tipo
CREATE INDEX IF NOT EXISTS idx_developments_tenant_tipo
  ON developments (tenant_id, tipo);

-- GIN para busca por subcampo do JSONB (analysis_results.geo, .financial, .legal)
CREATE INDEX IF NOT EXISTS idx_developments_analysis_results_gin
  ON developments USING GIN (analysis_results);

-- Índice parcial para empreendimentos em análise (exclui os concluídos)
CREATE INDEX IF NOT EXISTS idx_developments_analysis_status_active
  ON developments (analysis_status)
  WHERE analysis_status NOT IN ('complete','error');

-- ---------------------------------------------------------------------------
-- 4. Tabelas-filhas development_parcelamento_*
-- ---------------------------------------------------------------------------

-- 4A. Arquivos (KML, KMZ, DXF, fotos drone, plantas, documentos)
CREATE TABLE IF NOT EXISTS development_parcelamento_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL,
  uploaded_by    uuid NOT NULL,
  file_name      text NOT NULL,
  file_size      bigint NOT NULL,
  file_type      text NOT NULL
    CHECK (file_type IN ('terrain','drone_photo','project_plan','document','other')),
  storage_path   text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'parcelamento-files',
  metadata       jsonb DEFAULT '{}'::jsonb,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpf_dev    ON development_parcelamento_files(development_id);
CREATE INDEX IF NOT EXISTS idx_dpf_tenant ON development_parcelamento_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dpf_active ON development_parcelamento_files(tenant_id)
  WHERE is_active = true;

-- Trigger updated_at usando função já existente no banco
CREATE TRIGGER trg_dpf_updated_at
  BEFORE UPDATE ON development_parcelamento_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4B. Cache de camadas geo (SIGEF/SICAR/DataGeo) — evita refetch custoso
CREATE TABLE IF NOT EXISTS development_parcelamento_geo_layers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL,
  layer_key      text NOT NULL,
  -- Valores: 'sigef_privado','hidrografia','sicar_rl','app_margem','ibama_ucf', etc.
  geojson        jsonb NOT NULL,
  feature_count  integer DEFAULT 0,
  source         text NOT NULL,
  -- Valores: 'sicar_federal','datageo_sp','ibama_pamgia','manual'
  fetched_at     timestamptz DEFAULT now(),
  expires_at     timestamptz,
  is_active      boolean DEFAULT true,
  UNIQUE (development_id, layer_key)
);

CREATE INDEX IF NOT EXISTS idx_dpgl_dev     ON development_parcelamento_geo_layers(development_id);
CREATE INDEX IF NOT EXISTS idx_dpgl_tenant  ON development_parcelamento_geo_layers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dpgl_expires ON development_parcelamento_geo_layers(expires_at)
  WHERE expires_at IS NOT NULL;

-- 4C. Análise financeira (versionada — D4)
CREATE TABLE IF NOT EXISTS development_parcelamento_financial (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id     uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id          uuid NOT NULL,
  version            integer NOT NULL DEFAULT 1,
  vgv_total          numeric(14,2),
  custo_obra_total   numeric(14,2),
  custo_terreno      numeric(14,2),
  custo_legalizacao  numeric(14,2),
  custo_marketing    numeric(14,2),
  custo_comissoes    numeric(14,2),
  cub_referencia     numeric(10,2),
  prazo_obra_meses   integer,
  fluxo_caixa        jsonb,       -- [{mes, entrada, saida, saldo}]
  payback_meses      integer,
  tir_anual          numeric(6,3),
  vpl                numeric(14,2),
  margem_liquida_pct numeric(6,2),
  premissas          jsonb,       -- {taxa_desconto, indice_correcao, ...}
  ai_summary         text,        -- D5: gerado por Gemini 2.0 Flash
  ai_summary_model   text,
  created_by         uuid NOT NULL,
  created_at         timestamptz DEFAULT now(),
  is_active          boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_dpfin_dev    ON development_parcelamento_financial(development_id);
CREATE INDEX IF NOT EXISTS idx_dpfin_tenant ON development_parcelamento_financial(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dpfin_dev_version
  ON development_parcelamento_financial(development_id, version)
  WHERE is_active = true;

-- 4D. Conformidade legal — Lei 6.766/79 + Código Florestal (D4)
CREATE TABLE IF NOT EXISTS development_parcelamento_compliance (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id   uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL,
  check_key        text NOT NULL,
  -- Valores: 'app_minima','rl_minima','sistema_viario','lote_minimo','area_publica_min', etc.
  check_label      text NOT NULL,
  legal_basis      text,          -- 'Lei 6.766/79 art. 4º', 'CF art. 4º, I', etc.
  required_value   text,
  actual_value     text,
  status           text NOT NULL
    CHECK (status IN ('pass','warn','fail','na','pending')),
  ai_explanation       text,       -- D5: explicação em linguagem natural
  ai_explanation_model text,
  metadata         jsonb DEFAULT '{}'::jsonb,
  evaluated_at     timestamptz DEFAULT now(),
  is_active        boolean DEFAULT true,
  UNIQUE (development_id, check_key)
);

CREATE INDEX IF NOT EXISTS idx_dpcomp_dev    ON development_parcelamento_compliance(development_id);
CREATE INDEX IF NOT EXISTS idx_dpcomp_tenant ON development_parcelamento_compliance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dpcomp_status ON development_parcelamento_compliance(status);
CREATE INDEX IF NOT EXISTS idx_dpcomp_active ON development_parcelamento_compliance(tenant_id)
  WHERE is_active = true;

-- 4E. Relatórios PDF gerados (D4 + D5)
CREATE TABLE IF NOT EXISTS development_parcelamento_reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id    uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL,
  report_type       text NOT NULL
    CHECK (report_type IN (
      'parecer_tecnico','memorial_descritivo','tabela_areas',
      'financial_summary','compliance_report','full'
    )),
  title             text NOT NULL,
  pdf_url           text,
  pdf_size          bigint,
  generated_by      uuid NOT NULL,
  ai_generated      boolean DEFAULT false,
  ai_model          text,
  generation_params jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  is_active         boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_dprep_dev    ON development_parcelamento_reports(development_id);
CREATE INDEX IF NOT EXISTS idx_dprep_tenant ON development_parcelamento_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dprep_active ON development_parcelamento_reports(tenant_id)
  WHERE is_active = true;

-- 4F. Cache global de RL (SICAR/DataGeo) — sem tenant, compartilhado entre todos
--     source_precision: 'estadual' > 'federal' > 'estimativa' (ordem de qualidade)
CREATE TABLE IF NOT EXISTS development_parcelamento_rl_cache (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bbox_key         text NOT NULL UNIQUE,   -- hash do bbox normalizado
  bbox             jsonb NOT NULL,
  source           text NOT NULL,
  -- Valores: 'sicar_federal','datageo_sp','estimativa'
  source_precision text NOT NULL DEFAULT 'federal'
    CHECK (source_precision IN ('estadual','federal','estimativa')),
  features         jsonb NOT NULL,
  feature_count    integer DEFAULT 0,
  fetched_at       timestamptz DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_dprlc_expires ON development_parcelamento_rl_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_dprlc_source  ON development_parcelamento_rl_cache(source_precision);

-- ---------------------------------------------------------------------------
-- 5. RLS Policies — PERMISSIVE (padrão PostgreSQL) antes de qualquer RESTRICTIVE
-- ---------------------------------------------------------------------------

-- 5A. files
ALTER TABLE development_parcelamento_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpf_select_own" ON development_parcelamento_files FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpf_insert_own" ON development_parcelamento_files FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id()
              AND uploaded_by = auth.uid());
CREATE POLICY "dpf_update_own" ON development_parcelamento_files FOR UPDATE
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpf_delete_own" ON development_parcelamento_files FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- 5B. geo_layers
ALTER TABLE development_parcelamento_geo_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpgl_select_own" ON development_parcelamento_geo_layers FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpgl_insert_own" ON development_parcelamento_geo_layers FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "dpgl_update_own" ON development_parcelamento_geo_layers FOR UPDATE
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpgl_delete_own" ON development_parcelamento_geo_layers FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- 5C. financial
ALTER TABLE development_parcelamento_financial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpfin_select_own" ON development_parcelamento_financial FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpfin_insert_own" ON development_parcelamento_financial FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id()
              AND created_by = auth.uid());
CREATE POLICY "dpfin_update_own" ON development_parcelamento_financial FOR UPDATE
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpfin_delete_own" ON development_parcelamento_financial FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- 5D. compliance
ALTER TABLE development_parcelamento_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpcomp_select_own" ON development_parcelamento_compliance FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpcomp_insert_own" ON development_parcelamento_compliance FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "dpcomp_update_own" ON development_parcelamento_compliance FOR UPDATE
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dpcomp_delete_own" ON development_parcelamento_compliance FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- 5E. reports
ALTER TABLE development_parcelamento_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dprep_select_own" ON development_parcelamento_reports FOR SELECT
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dprep_insert_own" ON development_parcelamento_reports FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id()
              AND generated_by = auth.uid());
CREATE POLICY "dprep_update_own" ON development_parcelamento_reports FOR UPDATE
  USING (tenant_id = auth_tenant_id());
CREATE POLICY "dprep_delete_own" ON development_parcelamento_reports FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- 5F. rl_cache — global, leitura/escrita para autenticados (sem tenant)
ALTER TABLE development_parcelamento_rl_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dprlc_select_auth" ON development_parcelamento_rl_cache
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "dprlc_insert_auth" ON development_parcelamento_rl_cache
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "dprlc_update_auth" ON development_parcelamento_rl_cache
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 6. Storage Bucket para arquivos do parcelamento
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'parcelamento-files',
  'parcelamento-files',
  false,
  52428800,   -- 50 MB por arquivo
  ARRAY[
    'application/vnd.google-earth.kml+xml',
    'application/vnd.google-earth.kmz',
    'application/dxf',
    'image/vnd.dxf',
    'application/geo+json',
    'application/json',
    'application/zip',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/pdf',
    'application/octet-stream'   -- DWG + binários CAD
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "parcelamento_upload_auth"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'parcelamento-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "parcelamento_read_auth"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'parcelamento-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "parcelamento_delete_auth"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'parcelamento-files' AND auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 7. RBAC — transições de estado do módulo parcelamento
--    Coluna real: required_role (não allowed_role)
--    Sem coluna entity_type — status geo_* são únicos deste módulo
--    ON CONFLICT usa colunas reais da unique constraint
-- ---------------------------------------------------------------------------
INSERT INTO allowed_transitions
  (tenant_id, from_status, to_status, required_role, description, conditions)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'pending',        'geo_analyzing',  'corretor',
   'Parcelamento: iniciar análise geoespacial',
   '{"entity_type":"development_parcelamento"}'::jsonb),

  ('00000000-0000-0000-0000-000000000001',
   'geo_analyzing',  'geo_done',       'corretor',
   'Parcelamento: análise geo concluída',
   '{"entity_type":"development_parcelamento"}'::jsonb),

  ('00000000-0000-0000-0000-000000000001',
   'geo_done',       'financial_done', 'gerente',
   'Parcelamento: análise financeira concluída',
   '{"entity_type":"development_parcelamento"}'::jsonb),

  ('00000000-0000-0000-0000-000000000001',
   'financial_done', 'legal_done',     'juridico',
   'Parcelamento: análise de conformidade legal concluída',
   '{"entity_type":"development_parcelamento"}'::jsonb),

  ('00000000-0000-0000-0000-000000000001',
   'legal_done',     'complete',       'gerente',
   'Parcelamento: empreendimento aprovado e completo',
   '{"entity_type":"development_parcelamento"}'::jsonb),

  ('00000000-0000-0000-0000-000000000001',
   'geo_analyzing',  'error',          'corretor',
   'Parcelamento: erro durante análise geoespacial',
   '{"entity_type":"development_parcelamento"}'::jsonb)

ON CONFLICT (tenant_id, from_status, to_status, required_role) DO NOTHING;

-- ---------------------------------------------------------------------------
-- FIM — Migration Fase 1: Parcelamento de Solo
-- Revisado por: Buchecha (MiniMax M2.7) + Claudinho (Claude Sonnet 4.6)
-- ---------------------------------------------------------------------------
