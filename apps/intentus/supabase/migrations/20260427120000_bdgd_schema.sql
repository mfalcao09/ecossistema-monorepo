-- ============================================================================
-- BDGD — Base de Dados Geográfica da Distribuidora (ANEEL/PRODIST V11)
-- ============================================================================
-- Sessão 154 (2026-04-27)
--
-- Tier 1 — Índice nacional simplificado (sempre presente):
--   - bdgd_distribuidoras       : registry das 114 concessionárias do BR
--   - bdgd_mt_segments          : Média Tensão (UNSEGMT) simplificado a ~10m
--   - bdgd_bt_segments          : Baixa Tensão (UNSEGBT) simplificado a ~10m
--   - bdgd_substations          : Subestações distribuição (SUB)
--   - bdgd_sync_log             : controle idempotência do ETL
--
-- Tier 2 — Alta precisão por projeto (estrutura criada, ETL on-demand):
--   - bdgd_segments_hd          : MT+BT sem simplify, FK developments(id)
--                                 cleanup automático via cron quando projeto
--                                 concluido > 90 dias
--
-- Dado público (ANEEL Open Data) — sem tenant_id, RLS apenas read-only para
-- authenticated. Writes só via service_role (script ETL).
-- ============================================================================

-- Garante PostGIS (já existe, mas idempotente)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ----------------------------------------------------------------------------
-- 1) bdgd_distribuidoras — registry das concessionárias
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bdgd_distribuidoras (
  id              SMALLSERIAL PRIMARY KEY,
  cod_aneel       TEXT NOT NULL UNIQUE,           -- ex: "63" (CPFL Paulista)
  nome            TEXT NOT NULL,                  -- ex: "CPFL Paulista"
  uf_principal    CHAR(2),                        -- estado predominante (best-effort)
  arcgis_item_id  TEXT NOT NULL,                  -- ex: "c174916eee534efa82df1485ce6e9790"
  ciclo           DATE,                           -- ex: 2024-12-31
  versao_prodist  TEXT,                           -- "V11"
  size_bytes      BIGINT,                         -- tamanho do .gdb.zip último HEAD
  bbox            geography(Polygon, 4326),       -- envelope cobertura (calculado pós-load)
  last_synced_at  TIMESTAMPTZ,                    -- última carga bem-sucedida
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bdgd_distribuidoras_bbox_idx
  ON bdgd_distribuidoras USING GIST (bbox);

-- ----------------------------------------------------------------------------
-- 2) bdgd_mt_segments — Média Tensão simplificada (Tier 1)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bdgd_mt_segments (
  id              BIGSERIAL PRIMARY KEY,
  distribuidora_id SMALLINT NOT NULL REFERENCES bdgd_distribuidoras(id) ON DELETE CASCADE,
  cod_id          TEXT,                           -- COD_ID UNSEGMT
  ctmt            TEXT,                           -- alimentador
  tensao_kv       NUMERIC(5,2),                   -- TEN_OPE
  fases           TEXT,                           -- FAS_CON
  comprimento_m   NUMERIC(10,2),                  -- COMP (do .gdb, comprimento original)
  tipo_cabo       TEXT,                           -- TIP_CND
  posicao         TEXT,                           -- POS_CAB (aéreo/subterrâneo)
  cod_municipio   TEXT,                           -- código IBGE 7 dígitos
  geom            geography(LineString, 4326) NOT NULL,
  imported_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bdgd_mt_geom_idx
  ON bdgd_mt_segments USING GIST (geom);
CREATE INDEX IF NOT EXISTS bdgd_mt_distribuidora_idx
  ON bdgd_mt_segments (distribuidora_id);
CREATE INDEX IF NOT EXISTS bdgd_mt_municipio_idx
  ON bdgd_mt_segments (cod_municipio);

-- ----------------------------------------------------------------------------
-- 3) bdgd_bt_segments — Baixa Tensão simplificada (Tier 1)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bdgd_bt_segments (
  id              BIGSERIAL PRIMARY KEY,
  distribuidora_id SMALLINT NOT NULL REFERENCES bdgd_distribuidoras(id) ON DELETE CASCADE,
  cod_id          TEXT,
  ctmt            TEXT,
  tensao_v        SMALLINT,                       -- TEN_OPE em volts (127, 220, 380)
  fases           TEXT,
  comprimento_m   NUMERIC(10,2),
  tipo_cabo       TEXT,
  cod_municipio   TEXT,
  geom            geography(LineString, 4326) NOT NULL,
  imported_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bdgd_bt_geom_idx
  ON bdgd_bt_segments USING GIST (geom);
CREATE INDEX IF NOT EXISTS bdgd_bt_distribuidora_idx
  ON bdgd_bt_segments (distribuidora_id);
CREATE INDEX IF NOT EXISTS bdgd_bt_municipio_idx
  ON bdgd_bt_segments (cod_municipio);

-- ----------------------------------------------------------------------------
-- 4) bdgd_substations — Subestações de distribuição (SUB)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bdgd_substations (
  id              BIGSERIAL PRIMARY KEY,
  distribuidora_id SMALLINT NOT NULL REFERENCES bdgd_distribuidoras(id) ON DELETE CASCADE,
  cod_id          TEXT,
  nome            TEXT,
  tensao_pri_kv   NUMERIC(5,2),                   -- TEN_PRI
  tensao_sec_kv   NUMERIC(5,2),                   -- TEN_SEC
  cod_municipio   TEXT,
  geom            geography(Point, 4326) NOT NULL,
  imported_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bdgd_sub_geom_idx
  ON bdgd_substations USING GIST (geom);
CREATE INDEX IF NOT EXISTS bdgd_sub_distribuidora_idx
  ON bdgd_substations (distribuidora_id);

-- ----------------------------------------------------------------------------
-- 5) bdgd_sync_log — controle idempotência do ETL
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bdgd_sync_log (
  id              BIGSERIAL PRIMARY KEY,
  cod_aneel       TEXT NOT NULL,
  arcgis_item_id  TEXT NOT NULL,
  ciclo           DATE,
  versao_prodist  TEXT,
  status          TEXT NOT NULL,                  -- 'started', 'success', 'failed'
  features_mt     INT,
  features_bt     INT,
  features_sub    INT,
  size_bytes      BIGINT,
  duration_seconds INT,
  error_message   TEXT,
  started_at      TIMESTAMPTZ DEFAULT now(),
  finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS bdgd_sync_log_cod_idx
  ON bdgd_sync_log (cod_aneel, started_at DESC);

-- ----------------------------------------------------------------------------
-- 6) bdgd_segments_hd — alta precisão por projeto (Tier 2, on-demand)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bdgd_segments_hd (
  id              BIGSERIAL PRIMARY KEY,
  development_id  UUID NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  distribuidora_id SMALLINT NOT NULL REFERENCES bdgd_distribuidoras(id),
  tipo            TEXT NOT NULL CHECK (tipo IN ('mt','bt','sub')),
  cod_id          TEXT,
  ctmt            TEXT,
  tensao_kv       NUMERIC(5,2),
  tensao_v        SMALLINT,
  fases           TEXT,
  comprimento_m   NUMERIC(10,2),
  cod_municipio   TEXT,
  geom            geography NOT NULL,             -- mantém precisão original
  imported_at     TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ                     -- cleanup pelo cron quando projeto concluido > 90d
);

CREATE INDEX IF NOT EXISTS bdgd_hd_dev_idx
  ON bdgd_segments_hd (development_id);
CREATE INDEX IF NOT EXISTS bdgd_hd_geom_idx
  ON bdgd_segments_hd USING GIST (geom);
CREATE INDEX IF NOT EXISTS bdgd_hd_expires_idx
  ON bdgd_segments_hd (expires_at) WHERE expires_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6.1) Colunas em developments pra rastrear estado Tier 2
-- ----------------------------------------------------------------------------
ALTER TABLE developments
  ADD COLUMN IF NOT EXISTS bdgd_hd_loaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bdgd_hd_buffer_km NUMERIC,
  ADD COLUMN IF NOT EXISTS bdgd_hd_status TEXT;  -- 'idle', 'queued', 'loading', 'loaded', 'failed'

-- ----------------------------------------------------------------------------
-- 7) RPC pra buscar BDGD próximo a um development (consumida pela EF)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bdgd_proximity_for_development(
  p_development_id UUID,
  p_buffer_km      NUMERIC DEFAULT 10
)
RETURNS TABLE (
  layer            TEXT,
  source_tier      TEXT,            -- 't1' (índice nacional simplificado) ou 't2' (HD)
  distribuidora    TEXT,
  cod_aneel        TEXT,
  cod_id           TEXT,
  tensao           TEXT,
  fases            TEXT,
  comprimento_buffer_m NUMERIC,
  geom_geojson     JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_has_hd BOOLEAN;
BEGIN
  -- Se o projeto tem dados HD carregados (Tier 2), preferimos eles
  SELECT EXISTS (
    SELECT 1 FROM bdgd_segments_hd WHERE development_id = p_development_id LIMIT 1
  ) INTO v_has_hd;

  IF v_has_hd THEN
    -- Usa Tier 2 (alta precisão)
    RETURN QUERY
    WITH dev AS (
      SELECT geometry::geography AS geom FROM developments WHERE id = p_development_id
    ),
    buf AS (SELECT ST_Buffer(geom, p_buffer_km * 1000) AS geom FROM dev)
    SELECT
      hd.tipo::TEXT AS layer,
      't2'::TEXT AS source_tier,
      d.nome AS distribuidora,
      d.cod_aneel,
      hd.cod_id,
      CASE
        WHEN hd.tipo = 'mt'  THEN COALESCE(hd.tensao_kv::TEXT,'') || ' kV'
        WHEN hd.tipo = 'bt'  THEN COALESCE(hd.tensao_v::TEXT,'')  || ' V'
        WHEN hd.tipo = 'sub' THEN COALESCE(hd.tensao_kv::TEXT,'') || ' kV'
      END AS tensao,
      hd.fases,
      CASE WHEN hd.tipo IN ('mt','bt')
        THEN ST_Length(ST_Intersection(hd.geom, buf.geom))::NUMERIC
        ELSE NULL
      END,
      CASE WHEN hd.tipo = 'sub'
        THEN ST_AsGeoJSON(hd.geom)::JSONB
        ELSE ST_AsGeoJSON(ST_Intersection(hd.geom, buf.geom))::JSONB
      END
    FROM bdgd_segments_hd hd
      JOIN bdgd_distribuidoras d ON d.id = hd.distribuidora_id
      CROSS JOIN buf
    WHERE hd.development_id = p_development_id
      AND ST_DWithin(hd.geom, (SELECT geom FROM dev), p_buffer_km * 1000);
  ELSE
    -- Fallback Tier 1 (índice nacional simplificado)
    RETURN QUERY
    WITH dev AS (
      SELECT geometry::geography AS geom FROM developments WHERE id = p_development_id
    ),
    buf AS (SELECT ST_Buffer(geom, p_buffer_km * 1000) AS geom FROM dev)
    -- MT
    SELECT
      'mt'::TEXT, 't1'::TEXT, d.nome, d.cod_aneel, s.cod_id,
      (s.tensao_kv::TEXT || ' kV'), s.fases,
      ST_Length(ST_Intersection(s.geom, buf.geom))::NUMERIC,
      ST_AsGeoJSON(ST_Intersection(s.geom, buf.geom))::JSONB
    FROM bdgd_mt_segments s
      JOIN bdgd_distribuidoras d ON d.id = s.distribuidora_id
      CROSS JOIN buf
    WHERE ST_DWithin(s.geom, (SELECT geom FROM dev), p_buffer_km * 1000)
    UNION ALL
    -- BT
    SELECT 'bt'::TEXT, 't1'::TEXT, d.nome, d.cod_aneel, s.cod_id,
      (s.tensao_v::TEXT || ' V'), s.fases,
      ST_Length(ST_Intersection(s.geom, buf.geom))::NUMERIC,
      ST_AsGeoJSON(ST_Intersection(s.geom, buf.geom))::JSONB
    FROM bdgd_bt_segments s
      JOIN bdgd_distribuidoras d ON d.id = s.distribuidora_id
      CROSS JOIN buf
    WHERE ST_DWithin(s.geom, (SELECT geom FROM dev), p_buffer_km * 1000)
    UNION ALL
    -- SUB
    SELECT 'sub'::TEXT, 't1'::TEXT, d.nome, d.cod_aneel, s.cod_id,
      (s.tensao_pri_kv::TEXT || '/' || s.tensao_sec_kv::TEXT || ' kV'),
      NULL, NULL,
      ST_AsGeoJSON(s.geom)::JSONB
    FROM bdgd_substations s
      JOIN bdgd_distribuidoras d ON d.id = s.distribuidora_id
    WHERE ST_DWithin(s.geom, (SELECT geom FROM dev), p_buffer_km * 1000);
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8) Função cleanup HD (Tier 2) — chamada por cron diário
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bdgd_cleanup_hd_expired()
RETURNS INT
LANGUAGE sql
AS $$
  WITH deleted AS (
    DELETE FROM bdgd_segments_hd
    WHERE expires_at IS NOT NULL AND expires_at < now()
    RETURNING 1
  )
  SELECT COUNT(*)::INT FROM deleted;
$$;

-- ----------------------------------------------------------------------------
-- 9) RLS — leitura aberta pra authenticated, write só service_role
-- ----------------------------------------------------------------------------
ALTER TABLE bdgd_distribuidoras  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdgd_mt_segments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdgd_bt_segments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdgd_substations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdgd_segments_hd     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdgd_sync_log        ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- read pra authenticated
  EXECUTE 'CREATE POLICY bdgd_dist_read ON bdgd_distribuidoras FOR SELECT TO authenticated USING (true)';
  EXECUTE 'CREATE POLICY bdgd_mt_read ON bdgd_mt_segments FOR SELECT TO authenticated USING (true)';
  EXECUTE 'CREATE POLICY bdgd_bt_read ON bdgd_bt_segments FOR SELECT TO authenticated USING (true)';
  EXECUTE 'CREATE POLICY bdgd_sub_read ON bdgd_substations FOR SELECT TO authenticated USING (true)';
  EXECUTE 'CREATE POLICY bdgd_hd_read ON bdgd_segments_hd FOR SELECT TO authenticated USING (true)';
  EXECUTE 'CREATE POLICY bdgd_log_read ON bdgd_sync_log FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE bdgd_mt_segments IS 'BDGD ANEEL — Média Tensão simplificada ~10m (Tier 1 nacional). Fonte: dadosabertos-aneel.opendata.arcgis.com (ETL anual).';
COMMENT ON TABLE bdgd_bt_segments IS 'BDGD ANEEL — Baixa Tensão simplificada ~10m (Tier 1 nacional).';
COMMENT ON TABLE bdgd_segments_hd IS 'BDGD alta precisão sem simplify — carregada on-demand por projeto, cleanup pelo cron quando projeto concluído > 90d.';
