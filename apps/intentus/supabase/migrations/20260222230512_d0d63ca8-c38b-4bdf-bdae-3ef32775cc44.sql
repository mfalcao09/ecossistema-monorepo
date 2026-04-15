
-- =============================================
-- 1. CONCILIAÇÃO BANCÁRIA
-- =============================================

CREATE TABLE public.bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id),
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'ofx',
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'pendente',
  total_entries integer NOT NULL DEFAULT 0,
  matched_entries integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.bank_reconciliations
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE TRIGGER update_bank_reconciliations_updated_at
  BEFORE UPDATE ON public.bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.bank_reconciliation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  reconciliation_id uuid NOT NULL REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE,
  transaction_date date NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  direction text NOT NULL DEFAULT 'credito',
  reference_code text,
  matched_installment_id uuid REFERENCES public.contract_installments(id),
  matched_transfer_id uuid REFERENCES public.owner_transfers(id),
  match_status text NOT NULL DEFAULT 'pendente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_reconciliation_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.bank_reconciliation_entries
  FOR ALL USING (tenant_id = auth_tenant_id());

-- =============================================
-- 2. GARANTIAS LOCATÍCIAS
-- =============================================

CREATE TABLE public.lease_guarantees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  guarantee_type_id uuid REFERENCES public.guarantee_types(id),
  guarantee_kind text NOT NULL DEFAULT 'caucao_dinheiro',
  deposit_value numeric,
  current_value numeric,
  correction_index text NOT NULL DEFAULT 'nenhum',
  deposit_date date,
  expiry_date date,
  insurer_name text,
  policy_number text,
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  status text NOT NULL DEFAULT 'ativa',
  alert_days_before integer NOT NULL DEFAULT 30,
  notes text,
  file_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lease_guarantees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.lease_guarantees
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE TRIGGER update_lease_guarantees_updated_at
  BEFORE UPDATE ON public.lease_guarantees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.lease_guarantee_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  guarantee_id uuid NOT NULL REFERENCES public.lease_guarantees(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  amount numeric NOT NULL,
  reference_date date NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lease_guarantee_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.lease_guarantee_movements
  FOR ALL USING (tenant_id = auth_tenant_id());

-- =============================================
-- 3. NOTAS FISCAIS DE SERVIÇO
-- =============================================

CREATE TABLE public.service_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  invoice_number text NOT NULL,
  series text,
  issue_date date NOT NULL,
  amount numeric NOT NULL,
  tax_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL,
  service_description text NOT NULL,
  tomador_name text NOT NULL,
  tomador_cpf_cnpj text,
  revenue_source text NOT NULL DEFAULT 'outro',
  reference_id text,
  reference_type text,
  status text NOT NULL DEFAULT 'emitida',
  substituted_by_id uuid,
  municipal_code text,
  verification_code text,
  pdf_url text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.service_invoices
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE TRIGGER update_service_invoices_updated_at
  BEFORE UPDATE ON public.service_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 5. ACORDOS DE RENEGOCIAÇÃO (melhoria)
-- =============================================

CREATE TABLE public.debt_agreement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  agreement_id uuid NOT NULL REFERENCES public.debt_agreements(id) ON DELETE CASCADE,
  installment_id uuid NOT NULL REFERENCES public.contract_installments(id),
  original_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.debt_agreement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.debt_agreement_items
  FOR ALL USING (tenant_id = auth_tenant_id());

ALTER TABLE public.debt_agreements
  ADD COLUMN IF NOT EXISTS interest_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_debt numeric NOT NULL DEFAULT 0;

-- =============================================
-- 6. CENTROS DE CUSTO
-- =============================================

CREATE TABLE public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  code text,
  center_type text NOT NULL DEFAULT 'customizado',
  reference_id text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.cost_centers
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE TRIGGER update_cost_centers_updated_at
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.cost_center_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id),
  entry_type text NOT NULL DEFAULT 'receita',
  amount numeric NOT NULL,
  description text NOT NULL,
  reference_date date NOT NULL,
  reference_type text NOT NULL DEFAULT 'manual',
  reference_id text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_center_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.cost_center_entries
  FOR ALL USING (tenant_id = auth_tenant_id());

-- =============================================
-- 7. ANTECIPAÇÃO DE RECEBÍVEIS
-- =============================================

CREATE TABLE public.receivables_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  owner_person_id uuid NOT NULL REFERENCES public.people(id),
  months_advanced integer NOT NULL,
  discount_rate numeric NOT NULL,
  gross_amount numeric NOT NULL,
  discount_amount numeric NOT NULL,
  net_amount numeric NOT NULL,
  advance_date date NOT NULL,
  status text NOT NULL DEFAULT 'simulacao',
  approved_by uuid,
  paid_at timestamptz,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receivables_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.receivables_advances
  FOR ALL USING (tenant_id = auth_tenant_id());

CREATE TRIGGER update_receivables_advances_updated_at
  BEFORE UPDATE ON public.receivables_advances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.receivables_advance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  advance_id uuid NOT NULL REFERENCES public.receivables_advances(id) ON DELETE CASCADE,
  installment_id uuid REFERENCES public.contract_installments(id),
  reference_month text NOT NULL,
  original_amount numeric NOT NULL,
  discounted_amount numeric NOT NULL,
  compensated boolean NOT NULL DEFAULT false,
  compensated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receivables_advance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.receivables_advance_items
  FOR ALL USING (tenant_id = auth_tenant_id());
