
-- 1. payment_due_day on contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payment_due_day smallint;

-- 2. legal_representative_email and phone on people
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS legal_representative_email text;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS legal_representative_phone text;

-- 3. condominium_name on properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS condominium_name text;
