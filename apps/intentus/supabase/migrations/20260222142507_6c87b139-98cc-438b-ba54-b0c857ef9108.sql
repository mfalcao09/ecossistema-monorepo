
-- Tabela de renovações de contrato
CREATE TABLE public.contract_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  previous_end_date date,
  new_end_date date NOT NULL,
  previous_value numeric,
  new_value numeric,
  adjustment_index text,
  adjustment_pct numeric DEFAULT 0,
  renewal_term_months int DEFAULT 12,
  checklist jsonb DEFAULT '[]',
  notes text,
  status text NOT NULL DEFAULT 'rascunho',
  deal_request_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL REFERENCES tenants(id)
);

ALTER TABLE public.contract_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.contract_renewals
  FOR ALL USING (tenant_id = auth_tenant_id());

-- Trigger de updated_at
CREATE TRIGGER update_contract_renewals_updated_at
  BEFORE UPDATE ON public.contract_renewals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Template de renovação por tenant
CREATE TABLE public.renewal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  items jsonb DEFAULT '[]',
  default_term_months int DEFAULT 12,
  auto_create_addendum boolean DEFAULT true,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.renewal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.renewal_templates
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE TRIGGER update_renewal_templates_updated_at
  BEFORE UPDATE ON public.renewal_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
