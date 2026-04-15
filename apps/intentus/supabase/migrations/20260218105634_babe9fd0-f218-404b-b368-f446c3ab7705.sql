
-- Add missing columns to properties table based on the legacy system fields
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS property_code text,
  ADD COLUMN IF NOT EXISTS suites integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepts_exchange boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS exchange_value numeric,
  ADD COLUMN IF NOT EXISTS private_area numeric,
  ADD COLUMN IF NOT EXISTS industrial_area numeric,
  ADD COLUMN IF NOT EXISTS ceiling_height numeric,
  ADD COLUMN IF NOT EXISTS docks integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS show_on_website boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS highlight_web boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_sign boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_income boolean DEFAULT false;
