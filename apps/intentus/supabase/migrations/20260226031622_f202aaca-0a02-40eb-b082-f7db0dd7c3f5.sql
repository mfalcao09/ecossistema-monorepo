
ALTER TABLE public.contract_renewals
  ADD COLUMN IF NOT EXISTS addendum_document_id uuid REFERENCES public.contract_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS addendum_file_path text,
  ADD COLUMN IF NOT EXISTS addendum_title text,
  ADD COLUMN IF NOT EXISTS ai_extracted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_raw_output jsonb,
  ADD COLUMN IF NOT EXISTS ai_risk_score integer,
  ADD COLUMN IF NOT EXISTS ai_risk_flags jsonb,
  ADD COLUMN IF NOT EXISTS formalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS formalized_by uuid;
