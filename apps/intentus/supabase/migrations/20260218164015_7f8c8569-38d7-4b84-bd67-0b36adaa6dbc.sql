
-- ============================================
-- P2: DIMOB, IR Withholding, Due Diligence
-- ============================================

-- 1. Due Diligence Checks
CREATE TYPE public.due_diligence_status AS ENUM ('pendente', 'em_andamento', 'aprovado', 'reprovado', 'inconclusivo');
CREATE TYPE public.due_diligence_check_type AS ENUM ('serasa', 'spc', 'tribunal_justica', 'receita_federal', 'certidao_negativa', 'outro');

CREATE TABLE public.due_diligence_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  deal_request_id uuid REFERENCES public.deal_requests(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  check_type public.due_diligence_check_type NOT NULL,
  status public.due_diligence_status NOT NULL DEFAULT 'pendente',
  result_summary text,
  score numeric,
  checked_at timestamp with time zone,
  expires_at timestamp with time zone,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.due_diligence_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_select" ON public.due_diligence_checks FOR SELECT USING (true);
CREATE POLICY "dd_insert" ON public.due_diligence_checks FOR INSERT WITH CHECK (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role) OR has_role(auth.uid(), 'corretor'::app_role)
);
CREATE POLICY "dd_update" ON public.due_diligence_checks FOR UPDATE USING (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)
);
CREATE POLICY "dd_delete" ON public.due_diligence_checks FOR DELETE USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_dd_checks_updated_at BEFORE UPDATE ON public.due_diligence_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. IR Withholdings (Carnê-Leão)
CREATE TYPE public.ir_withholding_status AS ENUM ('pendente', 'recolhido', 'cancelado');

CREATE TABLE public.ir_withholdings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_person_id uuid NOT NULL REFERENCES public.people(id),
  owner_person_id uuid NOT NULL REFERENCES public.people(id),
  reference_month text NOT NULL, -- formato YYYY-MM
  gross_rent numeric NOT NULL DEFAULT 0,
  ir_base numeric NOT NULL DEFAULT 0,
  ir_rate numeric NOT NULL DEFAULT 0,
  ir_deduction numeric NOT NULL DEFAULT 0,
  ir_value numeric NOT NULL DEFAULT 0,
  darf_due_date date,
  darf_code text DEFAULT '0190',
  status public.ir_withholding_status NOT NULL DEFAULT 'pendente',
  paid_at timestamp with time zone,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ir_withholdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ir_select" ON public.ir_withholdings FOR SELECT USING (true);
CREATE POLICY "ir_insert" ON public.ir_withholdings FOR INSERT WITH CHECK (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)
);
CREATE POLICY "ir_update" ON public.ir_withholdings FOR UPDATE USING (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)
);
CREATE POLICY "ir_delete" ON public.ir_withholdings FOR DELETE USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_ir_withholdings_updated_at BEFORE UPDATE ON public.ir_withholdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. DIMOB Entries (annual declaration entries)
CREATE TYPE public.dimob_entry_type AS ENUM ('venda', 'locacao_intermediacao', 'locacao_administracao');

CREATE TABLE public.dimob_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_year integer NOT NULL,
  entry_type public.dimob_entry_type NOT NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  buyer_seller_person_id uuid REFERENCES public.people(id),
  tenant_person_id uuid REFERENCES public.people(id),
  owner_person_id uuid REFERENCES public.people(id),
  transaction_value numeric NOT NULL DEFAULT 0,
  commission_value numeric NOT NULL DEFAULT 0,
  monthly_rent_values jsonb, -- array of 12 monthly values
  generated_at timestamp with time zone,
  exported boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dimob_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dimob_select" ON public.dimob_entries FOR SELECT USING (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)
);
CREATE POLICY "dimob_insert" ON public.dimob_entries FOR INSERT WITH CHECK (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)
);
CREATE POLICY "dimob_update" ON public.dimob_entries FOR UPDATE USING (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)
);
CREATE POLICY "dimob_delete" ON public.dimob_entries FOR DELETE USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_dimob_entries_updated_at BEFORE UPDATE ON public.dimob_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX idx_dd_checks_person ON public.due_diligence_checks(person_id);
CREATE INDEX idx_dd_checks_deal ON public.due_diligence_checks(deal_request_id);
CREATE INDEX idx_ir_withholdings_contract ON public.ir_withholdings(contract_id);
CREATE INDEX idx_ir_withholdings_month ON public.ir_withholdings(reference_month);
CREATE INDEX idx_dimob_year ON public.dimob_entries(reference_year);
