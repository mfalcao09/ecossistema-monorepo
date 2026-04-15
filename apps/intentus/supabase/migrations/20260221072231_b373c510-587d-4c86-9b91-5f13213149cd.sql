
-- SaaS sales pipeline leads table
CREATE TYPE public.saas_pipeline_stage AS ENUM (
  'lead',
  'contato_realizado',
  'demonstracao',
  'proposta_enviada',
  'checkout_iniciado',
  'convertido',
  'perdido'
);

CREATE TABLE public.saas_pipeline_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  stage public.saas_pipeline_stage NOT NULL DEFAULT 'lead',
  source TEXT, -- e.g. 'site', 'indicacao', 'google_ads', 'instagram'
  plan_interest TEXT, -- plan slug they showed interest in
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES public.tenants(id), -- null until converted, then links to provisioned tenant
  lost_reason TEXT,
  converted_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saas_pipeline_leads ENABLE ROW LEVEL SECURITY;

-- Only superadmins can access
CREATE POLICY "Superadmins full access to saas_pipeline_leads"
ON public.saas_pipeline_leads
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin')
);

-- Timestamp trigger
CREATE TRIGGER update_saas_pipeline_leads_updated_at
  BEFORE UPDATE ON public.saas_pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
