CREATE TABLE public.guarantee_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termination_id uuid NOT NULL REFERENCES contract_terminations(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES contracts(id),
  guarantee_type_id uuid REFERENCES guarantee_types(id),
  guarantee_type_name text NOT NULL DEFAULT '',
  guarantee_value numeric DEFAULT 0,
  refund_amount numeric DEFAULT 0,
  checklist jsonb DEFAULT '[]',
  notes text,
  status text NOT NULL DEFAULT 'pendente',
  completed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL REFERENCES tenants(id)
);

ALTER TABLE public.guarantee_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.guarantee_releases
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE TRIGGER update_guarantee_releases_updated_at
  BEFORE UPDATE ON public.guarantee_releases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();