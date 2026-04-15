
CREATE TABLE public.deal_request_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_request_id UUID NOT NULL REFERENCES public.deal_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID REFERENCES public.tenants(id),
  UNIQUE(deal_request_id, user_id)
);

ALTER TABLE public.deal_request_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage followers"
  ON public.deal_request_followers FOR ALL
  USING (tenant_id = public.auth_tenant_id());
