
-- ============================================================
-- P1: Rent Adjustments, Debt Agreements, Leads CRM
-- ============================================================

-- ENUM: adjustment index type
CREATE TYPE public.adjustment_index_type AS ENUM ('igpm', 'ipca', 'inpc', 'manual');

-- ENUM: adjustment status
CREATE TYPE public.adjustment_status AS ENUM ('pendente', 'aplicado', 'cancelado');

-- ENUM: agreement status
CREATE TYPE public.agreement_status AS ENUM ('proposta', 'ativo', 'quitado', 'quebrado', 'cancelado');

-- ENUM: lead status
CREATE TYPE public.lead_status AS ENUM ('novo', 'contatado', 'qualificado', 'visita_agendada', 'proposta', 'convertido', 'perdido');

-- ENUM: lead source
CREATE TYPE public.lead_source AS ENUM ('site', 'portal', 'indicacao', 'whatsapp', 'telefone', 'walk_in', 'outro');

-- ─── Rent Adjustments ─────────────────────────────────────
CREATE TABLE public.rent_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  adjustment_date DATE NOT NULL,
  index_type public.adjustment_index_type NOT NULL DEFAULT 'igpm',
  index_percentage NUMERIC NOT NULL DEFAULT 0,
  previous_value NUMERIC NOT NULL DEFAULT 0,
  new_value NUMERIC NOT NULL DEFAULT 0,
  status public.adjustment_status NOT NULL DEFAULT 'pendente',
  applied_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rent_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rent_adj_select" ON public.rent_adjustments FOR SELECT USING (true);
CREATE POLICY "rent_adj_insert" ON public.rent_adjustments FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "rent_adj_update" ON public.rent_adjustments FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "rent_adj_delete" ON public.rent_adjustments FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_rent_adjustments_updated_at
  BEFORE UPDATE ON public.rent_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Debt Agreements ──────────────────────────────────────
CREATE TABLE public.debt_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id),
  original_debt NUMERIC NOT NULL DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0,
  agreed_value NUMERIC NOT NULL DEFAULT 0,
  installments_count INTEGER NOT NULL DEFAULT 1,
  first_due_date DATE NOT NULL,
  status public.agreement_status NOT NULL DEFAULT 'proposta',
  confession_term_notes TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.debt_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debt_agr_select" ON public.debt_agreements FOR SELECT USING (true);
CREATE POLICY "debt_agr_insert" ON public.debt_agreements FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "debt_agr_update" ON public.debt_agreements FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "debt_agr_delete" ON public.debt_agreements FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_debt_agreements_updated_at
  BEFORE UPDATE ON public.debt_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Leads CRM ────────────────────────────────────────────
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID REFERENCES public.people(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source public.lead_source NOT NULL DEFAULT 'outro',
  status public.lead_status NOT NULL DEFAULT 'novo',
  assigned_to UUID,
  property_id UUID REFERENCES public.properties(id),
  interest_type TEXT, -- venda, locacao, ambos
  budget_min NUMERIC,
  budget_max NUMERIC,
  preferred_region TEXT,
  notes TEXT,
  last_contact_at TIMESTAMPTZ,
  converted_person_id UUID REFERENCES public.people(id),
  converted_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select" ON public.leads FOR SELECT
  USING (is_admin_or_gerente(auth.uid()) OR created_by = auth.uid() OR assigned_to = auth.uid() OR has_role(auth.uid(), 'corretor'::app_role));
CREATE POLICY "leads_insert" ON public.leads FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role));
CREATE POLICY "leads_update" ON public.leads FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR assigned_to = auth.uid() OR has_role(auth.uid(), 'corretor'::app_role));
CREATE POLICY "leads_delete" ON public.leads FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
