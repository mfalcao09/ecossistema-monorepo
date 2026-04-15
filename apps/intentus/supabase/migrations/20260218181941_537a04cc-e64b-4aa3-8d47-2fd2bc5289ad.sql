
-- Item 14: Add admin_fee_percentage to contracts (distinct from commission_percentage for sales)
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS admin_fee_percentage numeric DEFAULT 10;

-- Ensure contracts has proper semantics:
-- commission_percentage = comissão de venda (used for venda contracts)
-- admin_fee_percentage = taxa de administração (used for locação contracts)
COMMENT ON COLUMN public.contracts.commission_percentage IS 'Comissão de venda (%) - used for sale contracts';
COMMENT ON COLUMN public.contracts.admin_fee_percentage IS 'Taxa de administração (%) - used for lease contracts';
