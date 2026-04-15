
-- =============================================
-- 1. Pesquisa de Satisfação
-- =============================================

CREATE TABLE public.satisfaction_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  survey_type text NOT NULL DEFAULT 'nps' CHECK (survey_type IN ('nps', 'csat')),
  trigger_event text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.satisfaction_surveys
  FOR ALL USING (tenant_id = public.auth_tenant_id());

CREATE TRIGGER update_satisfaction_surveys_updated_at
  BEFORE UPDATE ON public.satisfaction_surveys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.satisfaction_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  survey_id uuid NOT NULL REFERENCES public.satisfaction_surveys(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id),
  contract_id uuid REFERENCES public.contracts(id),
  ticket_id uuid,
  score integer NOT NULL CHECK (score >= 0 AND score <= 10),
  comment text,
  responded_at timestamptz NOT NULL DEFAULT now(),
  reference_type text,
  reference_id text
);

ALTER TABLE public.satisfaction_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.satisfaction_responses
  FOR ALL USING (tenant_id = public.auth_tenant_id());

-- =============================================
-- 2. Régua de Comunicação
-- =============================================

CREATE TABLE public.communication_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  trigger_event text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communication_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.communication_sequences
  FOR ALL USING (tenant_id = public.auth_tenant_id());

CREATE TRIGGER update_communication_sequences_updated_at
  BEFORE UPDATE ON public.communication_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.communication_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  sequence_id uuid NOT NULL REFERENCES public.communication_sequences(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  delay_days integer NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'notificacao' CHECK (channel IN ('notificacao', 'webhook_email', 'webhook_whatsapp')),
  message_template text NOT NULL DEFAULT '',
  subject text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communication_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.communication_sequence_steps
  FOR ALL USING (tenant_id = public.auth_tenant_id());

CREATE TABLE public.communication_sequence_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  sequence_id uuid NOT NULL REFERENCES public.communication_sequences(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.communication_sequence_steps(id),
  person_id uuid REFERENCES public.people(id),
  contract_id uuid REFERENCES public.contracts(id),
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('enviado', 'falha', 'pendente')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.communication_sequence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.communication_sequence_logs
  FOR ALL USING (tenant_id = public.auth_tenant_id());

-- =============================================
-- 3. Gestão de Sinistros e Seguros
-- =============================================

CREATE TABLE public.insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  policy_number text,
  insurer_name text NOT NULL,
  insurance_type text NOT NULL DEFAULT 'fianca' CHECK (insurance_type IN ('fianca', 'incendio', 'vida', 'responsabilidade_civil', 'outro')),
  premium_value numeric DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'vencida', 'cancelada')),
  alert_days_before integer NOT NULL DEFAULT 30,
  notes text,
  file_url text,
  file_name text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.insurance_policies
  FOR ALL USING (tenant_id = public.auth_tenant_id());

CREATE TRIGGER update_insurance_policies_updated_at
  BEFORE UPDATE ON public.insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  policy_id uuid NOT NULL REFERENCES public.insurance_policies(id) ON DELETE CASCADE,
  claim_number text,
  description text NOT NULL,
  claim_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_analise', 'aprovado', 'negado', 'concluido')),
  resolution_notes text,
  amount_claimed numeric,
  amount_approved numeric,
  resolved_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.insurance_claims
  FOR ALL USING (tenant_id = public.auth_tenant_id());

CREATE TRIGGER update_insurance_claims_updated_at
  BEFORE UPDATE ON public.insurance_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
