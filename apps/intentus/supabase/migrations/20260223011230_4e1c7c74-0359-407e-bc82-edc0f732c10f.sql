
-- 1. Owner Statements (Prestação de Contas ao Proprietário)
CREATE TABLE public.owner_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  owner_id UUID NOT NULL REFERENCES public.people(id),
  property_id UUID REFERENCES public.properties(id),
  reference_month TEXT NOT NULL,
  gross_rent NUMERIC(15,2) NOT NULL DEFAULT 0,
  admin_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
  ir_retained NUMERIC(15,2) NOT NULL DEFAULT 0,
  deductions_json JSONB DEFAULT '[]',
  net_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'gerado' CHECK (status IN ('gerado', 'enviado', 'confirmado')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.owner_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for owner_statements" ON public.owner_statements FOR ALL USING (tenant_id = public.auth_tenant_id()) WITH CHECK (tenant_id = public.auth_tenant_id());
CREATE TRIGGER update_owner_statements_updated_at BEFORE UPDATE ON public.owner_statements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX idx_owner_statements_tenant ON public.owner_statements(tenant_id, reference_month);

-- 2. Accounting Periods (Fechamento de Período)
CREATE TABLE public.accounting_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_fechamento', 'fechado')),
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  reopened_by UUID,
  reopened_at TIMESTAMPTZ,
  reopen_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period_start, period_end)
);
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for accounting_periods" ON public.accounting_periods FOR ALL USING (tenant_id = public.auth_tenant_id()) WITH CHECK (tenant_id = public.auth_tenant_id());
CREATE TRIGGER update_accounting_periods_updated_at BEFORE UPDATE ON public.accounting_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Expense Apportionments (Rateio de Despesas)
CREATE TABLE public.expense_apportionments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  cost_center_id UUID REFERENCES public.cost_centers(id),
  property_id UUID REFERENCES public.properties(id),
  percentage NUMERIC(7,4) NOT NULL DEFAULT 0,
  calculated_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  criteria TEXT NOT NULL DEFAULT 'manual' CHECK (criteria IN ('manual', 'area_m2', 'igualitario')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_apportionments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for expense_apportionments" ON public.expense_apportionments FOR ALL USING (tenant_id = public.auth_tenant_id()) WITH CHECK (tenant_id = public.auth_tenant_id());

-- 4. Accounting Exports (Exportação Contábil)
CREATE TABLE public.accounting_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  format TEXT NOT NULL DEFAULT 'csv_generico' CHECK (format IN ('csv_generico', 'dominio', 'fortes', 'prosoft')),
  file_name TEXT NOT NULL,
  records_count INT NOT NULL DEFAULT 0,
  exported_by UUID NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounting_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for accounting_exports" ON public.accounting_exports FOR ALL USING (tenant_id = public.auth_tenant_id()) WITH CHECK (tenant_id = public.auth_tenant_id());

-- 5. Account Mappings (De/Para contas)
CREATE TABLE public.account_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  internal_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  external_code TEXT NOT NULL,
  external_name TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'csv_generico',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, internal_account_id, format)
);
ALTER TABLE public.account_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for account_mappings" ON public.account_mappings FOR ALL USING (tenant_id = public.auth_tenant_id()) WITH CHECK (tenant_id = public.auth_tenant_id());
CREATE TRIGGER update_account_mappings_updated_at BEFORE UPDATE ON public.account_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Accounting Reconciliations (Conciliação Contábil)
CREATE TABLE public.accounting_reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  book_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  external_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'conciliado')),
  reconciled_by UUID,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounting_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for accounting_reconciliations" ON public.accounting_reconciliations FOR ALL USING (tenant_id = public.auth_tenant_id()) WITH CHECK (tenant_id = public.auth_tenant_id());
CREATE TRIGGER update_accounting_reconciliations_updated_at BEFORE UPDATE ON public.accounting_reconciliations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7. Accounting Reconciliation Items
CREATE TABLE public.accounting_reconciliation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reconciliation_id UUID NOT NULL REFERENCES public.accounting_reconciliations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  journal_entry_line_id UUID REFERENCES public.journal_entry_lines(id),
  external_reference TEXT,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  match_status TEXT NOT NULL DEFAULT 'pendente' CHECK (match_status IN ('pendente', 'conciliado', 'divergente')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.accounting_reconciliation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for accounting_reconciliation_items" ON public.accounting_reconciliation_items FOR ALL USING (tenant_id = public.auth_tenant_id()) WITH CHECK (tenant_id = public.auth_tenant_id());
