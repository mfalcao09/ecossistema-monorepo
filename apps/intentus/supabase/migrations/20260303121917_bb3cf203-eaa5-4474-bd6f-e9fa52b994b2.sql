ALTER TABLE public.market_evaluations
  ADD COLUMN IF NOT EXISTS market_results jsonb,
  ADD COLUMN IF NOT EXISTS ai_market_analysis text;