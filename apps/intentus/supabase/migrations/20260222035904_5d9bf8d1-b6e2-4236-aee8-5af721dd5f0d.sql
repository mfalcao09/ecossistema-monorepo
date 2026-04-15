
-- Tabela de itens do calculo rescisorio por processo
CREATE TABLE public.termination_calc_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termination_id uuid NOT NULL REFERENCES contract_terminations(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'outro',
  description text NOT NULL DEFAULT '',
  direction text NOT NULL DEFAULT 'debito',
  amount numeric NOT NULL DEFAULT 0,
  formula_notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL REFERENCES tenants(id)
);

ALTER TABLE public.termination_calc_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.termination_calc_items
  FOR ALL USING (tenant_id = auth_tenant_id());

-- Template de itens padrao por tenant
CREATE TABLE public.termination_calc_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  item_type text NOT NULL DEFAULT 'outro',
  description text NOT NULL DEFAULT '',
  direction text NOT NULL DEFAULT 'debito',
  default_formula text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.termination_calc_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.termination_calc_templates
  FOR ALL USING (tenant_id = auth_tenant_id());

-- Resumo do calculo na rescisao
ALTER TABLE public.contract_terminations ADD COLUMN IF NOT EXISTS calc_summary jsonb DEFAULT '{}';
