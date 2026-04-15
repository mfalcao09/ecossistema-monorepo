-- Session 145 — Bloco H Sprint 5 — US-125 Zoneamento Municipal
-- Create development_zoneamento_municipal table for storing municipal zoning parameters

CREATE TABLE IF NOT EXISTS development_zoneamento_municipal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL UNIQUE REFERENCES developments(id) ON DELETE CASCADE,

  -- Coeficiente de Aproveitamento (CA)
  ca_basico numeric,
  ca_maximo numeric,
  ca_minimo numeric,

  -- Taxa de Ocupação (TO)
  to_percentual numeric,

  -- Gabarito (building height)
  gabarito_andares integer,
  gabarito_altura_m numeric,

  -- Recuos (setbacks in meters)
  recuo_frontal_m numeric,
  recuo_lateral_m numeric,
  recuo_fundos_m numeric,

  -- Zoning classification
  zona_classificacao text,

  -- Permeability
  permeabilidade_percentual numeric,

  -- Allowed and forbidden uses
  usos_permitidos text[] DEFAULT '{}',
  usos_proibidos text[] DEFAULT '{}',

  -- Additional notes and metadata
  observacoes text,
  confidence_score integer DEFAULT 0,
  status text DEFAULT 'generated' CHECK (status IN ('generated', 'reviewed', 'approved', 'submitted')),

  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  -- Constraints
  CONSTRAINT ca_basico_positive CHECK (ca_basico IS NULL OR ca_basico > 0),
  CONSTRAINT ca_maximo_positive CHECK (ca_maximo IS NULL OR ca_maximo > 0),
  CONSTRAINT ca_minimo_positive CHECK (ca_minimo IS NULL OR ca_minimo > 0),
  CONSTRAINT to_percentual_range CHECK (to_percentual IS NULL OR (to_percentual >= 0 AND to_percentual <= 100)),
  CONSTRAINT gabarito_andares_positive CHECK (gabarito_andares IS NULL OR gabarito_andares > 0),
  CONSTRAINT gabarito_altura_positive CHECK (gabarito_altura_m IS NULL OR gabarito_altura_m > 0),
  CONSTRAINT recuos_positive CHECK (
    (recuo_frontal_m IS NULL OR recuo_frontal_m > 0) AND
    (recuo_lateral_m IS NULL OR recuo_lateral_m > 0) AND
    (recuo_fundos_m IS NULL OR recuo_fundos_m > 0)
  ),
  CONSTRAINT permeabilidade_range CHECK (permeabilidade_percentual IS NULL OR (permeabilidade_percentual >= 0 AND permeabilidade_percentual <= 100)),
  CONSTRAINT confidence_score_range CHECK (confidence_score >= 0 AND confidence_score <= 100)
);

-- Create indexes for faster queries
CREATE INDEX idx_development_zoneamento_municipal_development_id ON development_zoneamento_municipal(development_id);
CREATE INDEX idx_development_zoneamento_municipal_status ON development_zoneamento_municipal(status);
CREATE INDEX idx_development_zoneamento_municipal_created_at ON development_zoneamento_municipal(created_at DESC);
CREATE INDEX idx_development_zoneamento_municipal_updated_at ON development_zoneamento_municipal(updated_at DESC);

-- Enable RLS
ALTER TABLE development_zoneamento_municipal ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view zoneamento for their tenant's developments
CREATE POLICY "Users can view zoneamento for their tenant's developments" ON development_zoneamento_municipal
  FOR SELECT
  USING (
    development_id IN (
      SELECT id FROM developments
      WHERE tenant_id = auth_tenant_id()
    )
  );

-- RLS Policy: Users can insert/update zoneamento for their tenant's developments
CREATE POLICY "Users can insert/update zoneamento for their tenant's developments" ON development_zoneamento_municipal
  FOR INSERT
  WITH CHECK (
    development_id IN (
      SELECT id FROM developments
      WHERE tenant_id = auth_tenant_id()
    )
  );

CREATE POLICY "Users can update zoneamento for their tenant's developments" ON development_zoneamento_municipal
  FOR UPDATE
  USING (
    development_id IN (
      SELECT id FROM developments
      WHERE tenant_id = auth_tenant_id()
    )
  );

-- RLS Policy: Service role can insert/update/delete for backend operations
CREATE POLICY "Service role full access to zoneamento" ON development_zoneamento_municipal
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comment on table
COMMENT ON TABLE development_zoneamento_municipal IS 'Municipal zoning parameters extracted from Plano Diretor PDFs or entered manually. Supports AI extraction via Gemini 2.0 Flash multimodal.';
