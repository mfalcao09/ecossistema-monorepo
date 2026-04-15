
ALTER TABLE public.market_evaluations
  ADD COLUMN IF NOT EXISTS preco_m2_estimado numeric,
  ADD COLUMN IF NOT EXISTS market_analysis_at timestamptz,
  ADD COLUMN IF NOT EXISTS market_analysis_status text DEFAULT 'pendente';

-- Enable realtime for market_evaluations
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_evaluations;
