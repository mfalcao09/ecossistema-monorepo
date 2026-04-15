
ALTER TABLE public.market_evaluations
  ADD COLUMN IF NOT EXISTS preco_m2_venda numeric,
  ADD COLUMN IF NOT EXISTS preco_m2_locacao numeric,
  ADD COLUMN IF NOT EXISTS segmento_mercado text;
