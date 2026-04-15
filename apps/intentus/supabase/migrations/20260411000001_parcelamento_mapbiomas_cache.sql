-- ============================================================
-- Migration: MapBiomas Cache Table
-- Sessão 144 — Bloco H Sprint 4 — US-117
-- Cache de dados MapBiomas via Google Earth Engine
-- ============================================================

-- Tabela de cache para resultados MapBiomas (uso/cobertura do solo)
CREATE TABLE IF NOT EXISTS development_parcelamento_mapbiomas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,

  -- Coordenadas do centroid consultado
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,

  -- Raio do buffer em metros (padrão 1000m)
  buffer_radius_m integer NOT NULL DEFAULT 1000,

  -- Ano de referência (ex: 2014, 2015, ..., 2023)
  reference_year integer NOT NULL CHECK (reference_year >= 2000 AND reference_year <= 2030),

  -- Dados de classificação MapBiomas (Collection 8+)
  -- JSONB com breakdown de classes: { "class_id": int, "class_name": str, "area_ha": float, "percentage": float }
  land_use_classes jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Resumo agregado
  dominant_class text,            -- Classe predominante
  native_vegetation_pct double precision,  -- % vegetação nativa
  agriculture_pct double precision,        -- % agropecuária
  urban_pct double precision,              -- % área urbana
  water_pct double precision,              -- % corpos d'água

  -- Metadata da consulta GEE
  collection_version text NOT NULL DEFAULT 'collection8',  -- Ex: collection8, collection9
  pixel_count integer,           -- Quantidade de pixels na amostra
  spatial_resolution_m integer DEFAULT 30,  -- Resolução MapBiomas (30m Landsat)

  -- Tendência temporal (preenchido quando se consulta múltiplos anos)
  trend_data jsonb,  -- { "deforestation_trend": "increasing|stable|decreasing", "years_analyzed": [...], "change_summary": {...} }

  -- Cache control
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),  -- Cache 90 dias

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Unique constraint: um registro por development + ano + buffer
  UNIQUE (development_id, reference_year, buffer_radius_m)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mapbiomas_dev_id ON development_parcelamento_mapbiomas(development_id);
CREATE INDEX IF NOT EXISTS idx_mapbiomas_tenant ON development_parcelamento_mapbiomas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mapbiomas_year ON development_parcelamento_mapbiomas(reference_year);
CREATE INDEX IF NOT EXISTS idx_mapbiomas_expires ON development_parcelamento_mapbiomas(expires_at);

-- RLS
ALTER TABLE development_parcelamento_mapbiomas ENABLE ROW LEVEL SECURITY;

-- Policy PERMISSIVE para tenant isolation
CREATE POLICY "mapbiomas_tenant_isolation"
  ON development_parcelamento_mapbiomas
  FOR ALL
  USING (tenant_id = (SELECT auth.uid()))
  WITH CHECK (tenant_id = (SELECT auth.uid()));

-- Policy para service role (EF usa service role pra cache)
CREATE POLICY "mapbiomas_service_role"
  ON development_parcelamento_mapbiomas
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Trigger updated_at
CREATE OR REPLACE TRIGGER set_mapbiomas_updated_at
  BEFORE UPDATE ON development_parcelamento_mapbiomas
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

COMMENT ON TABLE development_parcelamento_mapbiomas IS 'Cache de dados MapBiomas (uso/cobertura do solo) consultados via Google Earth Engine. TTL 90 dias. US-117 Bloco H.';
