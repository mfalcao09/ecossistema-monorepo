
-- Adicionar campo manual aos boletos
ALTER TABLE public.boletos 
  ADD COLUMN IF NOT EXISTS manual boolean NOT NULL DEFAULT false;

-- Adicionar campo notes aos boletos para faturas manuais
ALTER TABLE public.boletos 
  ADD COLUMN IF NOT EXISTS notes text;

-- Adicionar campo payment_method aos boletos para faturas manuais
ALTER TABLE public.boletos 
  ADD COLUMN IF NOT EXISTS payment_method text;

-- Tornar bank_credential_id opcional (necessario para manuais)
ALTER TABLE public.boletos 
  ALTER COLUMN bank_credential_id DROP NOT NULL;
