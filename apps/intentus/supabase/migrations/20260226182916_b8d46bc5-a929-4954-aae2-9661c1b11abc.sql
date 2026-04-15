
CREATE TABLE public.contract_redlining (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  clause_name TEXT NOT NULL,
  original_text TEXT,
  proposed_text TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'aceito', 'recusado', 'incorporado')),
  requested_by TEXT,
  created_by UUID,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_redlining ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view redlining"
  ON public.contract_redlining FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "Tenant members can insert redlining"
  ON public.contract_redlining FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "Tenant members can update redlining"
  ON public.contract_redlining FOR UPDATE
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "Tenant members can delete redlining"
  ON public.contract_redlining FOR DELETE
  USING (tenant_id = auth_tenant_id());

CREATE TRIGGER update_contract_redlining_updated_at
  BEFORE UPDATE ON public.contract_redlining
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_contract_redlining_contract_id ON public.contract_redlining(contract_id);
CREATE INDEX idx_contract_redlining_tenant_id ON public.contract_redlining(tenant_id);
CREATE INDEX idx_contract_redlining_clause_name ON public.contract_redlining(clause_name);
