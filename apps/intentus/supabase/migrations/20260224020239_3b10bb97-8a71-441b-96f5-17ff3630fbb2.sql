
-- Table to cache economic indices from BCB SGS API
CREATE TABLE public.economic_indices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  index_code text NOT NULL,
  reference_date date NOT NULL,
  monthly_value numeric,
  accumulated_12m numeric,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(index_code, reference_date)
);

-- No RLS needed - public economic data shared across all tenants
GRANT SELECT ON public.economic_indices TO anon, authenticated;
GRANT ALL ON public.economic_indices TO service_role;

-- Index for fast lookups
CREATE INDEX idx_economic_indices_code_date ON public.economic_indices (index_code, reference_date DESC);
