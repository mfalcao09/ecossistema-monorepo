
-- Tabela de automações financeiras
CREATE TABLE public.finance_automations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  trigger_event text NOT NULL,
  delay_days integer NOT NULL DEFAULT 0,
  action_type text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.finance_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.finance_automations
  FOR ALL USING (tenant_id = auth_tenant_id());

-- Trigger updated_at
CREATE TRIGGER update_finance_automations_updated_at
  BEFORE UPDATE ON public.finance_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
