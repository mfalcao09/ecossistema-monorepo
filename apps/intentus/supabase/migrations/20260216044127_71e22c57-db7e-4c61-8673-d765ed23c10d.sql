
-- Create updated_at function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Enum for deal request status based on BPMN flow
DO $$ BEGIN
  CREATE TYPE public.deal_request_status AS ENUM (
    'rascunho','enviado_juridico','analise_documental','aguardando_documentos',
    'parecer_em_elaboracao','parecer_negativo','minuta_em_elaboracao','em_validacao',
    'ajustes_pendentes','aprovado_comercial','contrato_finalizado','em_assinatura',
    'concluido','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Main deal requests table
CREATE TABLE IF NOT EXISTS public.deal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id),
  deal_type public.contract_type NOT NULL,
  status public.deal_request_status NOT NULL DEFAULT 'rascunho',
  proposed_value NUMERIC,
  proposed_monthly_value NUMERIC,
  proposed_start_date DATE,
  proposed_duration_months INTEGER,
  payment_terms TEXT,
  guarantee_type TEXT,
  commission_percentage NUMERIC,
  commercial_notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Parties linked to deal request
CREATE TABLE IF NOT EXISTS public.deal_request_parties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_request_id UUID NOT NULL REFERENCES public.deal_requests(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id),
  role public.contract_party_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Status history timeline
CREATE TABLE IF NOT EXISTS public.deal_request_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_request_id UUID NOT NULL REFERENCES public.deal_requests(id) ON DELETE CASCADE,
  from_status public.deal_request_status,
  to_status public.deal_request_status NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_request_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_request_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "deal_requests_select" ON public.deal_requests FOR SELECT USING (true);
CREATE POLICY "deal_requests_insert" ON public.deal_requests FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role));
CREATE POLICY "deal_requests_update" ON public.deal_requests FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR created_by = auth.uid() OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role));
CREATE POLICY "deal_requests_delete" ON public.deal_requests FOR DELETE USING (is_admin_or_gerente(auth.uid()));

CREATE POLICY "drp_select" ON public.deal_request_parties FOR SELECT USING (true);
CREATE POLICY "drp_insert" ON public.deal_request_parties FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role));
CREATE POLICY "drp_update" ON public.deal_request_parties FOR UPDATE USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role));
CREATE POLICY "drp_delete" ON public.deal_request_parties FOR DELETE USING (is_admin_or_gerente(auth.uid()));

CREATE POLICY "drh_select" ON public.deal_request_history FOR SELECT USING (true);
CREATE POLICY "drh_insert" ON public.deal_request_history FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_deal_requests_updated_at
  BEFORE UPDATE ON public.deal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
