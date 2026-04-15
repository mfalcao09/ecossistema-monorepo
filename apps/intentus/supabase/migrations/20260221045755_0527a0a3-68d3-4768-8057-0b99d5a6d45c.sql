
-- Table to track PIX checkout attempts from the SaaS Shop landing page
CREATE TABLE public.pix_checkouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  plan_price_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  company_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  pix_charge_id UUID REFERENCES public.platform_pix_charges(id),
  txid TEXT,
  qr_code TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only service role accesses this table (edge functions with service_role_key)
ALTER TABLE public.pix_checkouts ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role can access

-- Enable realtime for polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.pix_checkouts;

-- Trigger for updated_at
CREATE TRIGGER update_pix_checkouts_updated_at
  BEFORE UPDATE ON public.pix_checkouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
