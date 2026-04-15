
-- Add earnest_money (arras/sinal) tracking to deal_requests for sales
ALTER TABLE public.deal_requests
ADD COLUMN IF NOT EXISTS earnest_money numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS earnest_money_date date,
ADD COLUMN IF NOT EXISTS earnest_money_status text DEFAULT 'pendente';

-- Add a column to track blocked transfers visually
ALTER TABLE public.owner_transfers
ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_reason text;
