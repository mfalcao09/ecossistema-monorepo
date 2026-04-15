
-- Create api_integrations table
CREATE TABLE public.api_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  last_check_at timestamptz,
  last_error text,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, integration_key)
);

-- Enable RLS
ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant can view own integrations"
  ON public.api_integrations FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "Tenant can insert own integrations"
  ON public.api_integrations FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "Tenant can update own integrations"
  ON public.api_integrations FOR UPDATE
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "Tenant can delete own integrations"
  ON public.api_integrations FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- SuperAdmin access
CREATE POLICY "SuperAdmin can view all integrations"
  ON public.api_integrations FOR SELECT
  USING (superadmin_tenant_filter(tenant_id));

-- Updated_at trigger
CREATE TRIGGER update_api_integrations_updated_at
  BEFORE UPDATE ON public.api_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add new due diligence check types
ALTER TYPE public.due_diligence_check_type ADD VALUE IF NOT EXISTS 'cnd';
ALTER TYPE public.due_diligence_check_type ADD VALUE IF NOT EXISTS 'cadin';
ALTER TYPE public.due_diligence_check_type ADD VALUE IF NOT EXISTS 'divida_ativa';
