
-- ============================================
-- ENUMS for commercial features
-- ============================================
CREATE TYPE public.goal_period_type AS ENUM ('mensal', 'trimestral');
CREATE TYPE public.goal_metric AS ENUM ('volume_vendas', 'negocios_fechados', 'leads_convertidos');
CREATE TYPE public.visit_status AS ENUM ('agendada', 'confirmada', 'realizada', 'cancelada', 'no_show');
CREATE TYPE public.proposal_kind AS ENUM ('proposta', 'contraproposta');
CREATE TYPE public.commercial_proposal_status AS ENUM ('rascunho', 'enviada', 'aceita', 'recusada', 'expirada');
CREATE TYPE public.evaluation_status AS ENUM ('rascunho', 'finalizado');
CREATE TYPE public.automation_trigger AS ENUM ('lead_criado', 'visita_realizada', 'proposta_enviada', 'sem_contato_x_dias', 'aniversario_contrato');
CREATE TYPE public.automation_action AS ENUM ('tarefa', 'notificacao', 'lembrete');
CREATE TYPE public.automation_log_status AS ENUM ('pendente', 'executado', 'falhou');
CREATE TYPE public.match_status AS ENUM ('sugerido', 'enviado', 'aceito', 'descartado');
CREATE TYPE public.exclusivity_status AS ENUM ('ativo', 'expirado', 'cancelado', 'renovado');

-- ============================================
-- 1. broker_goals
-- ============================================
CREATE TABLE public.broker_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  period_type goal_period_type NOT NULL DEFAULT 'mensal',
  period_start date NOT NULL,
  period_end date NOT NULL,
  metric goal_metric NOT NULL DEFAULT 'negocios_fechados',
  target_value numeric NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.broker_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "broker_goals_tenant_isolation" ON public.broker_goals FOR ALL USING (tenant_id = auth_tenant_id());
CREATE TRIGGER update_broker_goals_updated_at BEFORE UPDATE ON public.broker_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. commercial_visits
-- ============================================
CREATE TABLE public.commercial_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  assigned_to uuid,
  status visit_status NOT NULL DEFAULT 'agendada',
  confirmation_sent boolean NOT NULL DEFAULT false,
  feedback_notes text,
  feedback_rating int CHECK (feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5)),
  address_override text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_visits_tenant_isolation" ON public.commercial_visits FOR ALL USING (tenant_id = auth_tenant_id());
CREATE TRIGGER update_commercial_visits_updated_at BEFORE UPDATE ON public.commercial_visits FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. commercial_proposals
-- ============================================
CREATE TABLE public.commercial_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  deal_request_id uuid REFERENCES public.deal_requests(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  version int NOT NULL DEFAULT 1,
  proposed_by uuid NOT NULL,
  proposal_type proposal_kind NOT NULL DEFAULT 'proposta',
  proposed_value numeric,
  proposed_monthly_value numeric,
  payment_conditions text,
  validity_days int NOT NULL DEFAULT 7,
  valid_until date,
  status commercial_proposal_status NOT NULL DEFAULT 'rascunho',
  response_notes text,
  previous_version_id uuid REFERENCES public.commercial_proposals(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_proposals_tenant_isolation" ON public.commercial_proposals FOR ALL USING (tenant_id = auth_tenant_id());
CREATE TRIGGER update_commercial_proposals_updated_at BEFORE UPDATE ON public.commercial_proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 5. market_evaluations
-- ============================================
CREATE TABLE public.market_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  evaluated_by uuid NOT NULL,
  evaluation_date date NOT NULL DEFAULT CURRENT_DATE,
  suggested_min_value numeric,
  suggested_max_value numeric,
  suggested_value numeric,
  methodology_notes text,
  comparable_property_ids uuid[] DEFAULT '{}',
  status evaluation_status NOT NULL DEFAULT 'rascunho',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_evaluations_tenant_isolation" ON public.market_evaluations FOR ALL USING (tenant_id = auth_tenant_id());
CREATE TRIGGER update_market_evaluations_updated_at BEFORE UPDATE ON public.market_evaluations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 6. commercial_automations
-- ============================================
CREATE TABLE public.commercial_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  trigger_event automation_trigger NOT NULL,
  delay_days int NOT NULL DEFAULT 0,
  action_type automation_action NOT NULL DEFAULT 'notificacao',
  action_config jsonb DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_automations_tenant_isolation" ON public.commercial_automations FOR ALL USING (tenant_id = auth_tenant_id());
CREATE TRIGGER update_commercial_automations_updated_at BEFORE UPDATE ON public.commercial_automations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 6b. commercial_automation_logs
-- ============================================
CREATE TABLE public.commercial_automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  automation_id uuid NOT NULL REFERENCES public.commercial_automations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  action_taken text,
  status automation_log_status NOT NULL DEFAULT 'pendente',
  notes text
);
ALTER TABLE public.commercial_automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_automation_logs_tenant_isolation" ON public.commercial_automation_logs FOR ALL USING (tenant_id = auth_tenant_id());

-- ============================================
-- 8. lead_property_matches
-- ============================================
CREATE TABLE public.lead_property_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  match_score numeric NOT NULL DEFAULT 0,
  match_reasons text[] DEFAULT '{}',
  status match_status NOT NULL DEFAULT 'sugerido',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_property_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_property_matches_tenant_isolation" ON public.lead_property_matches FOR ALL USING (tenant_id = auth_tenant_id());

-- ============================================
-- 10. exclusivity_contracts
-- ============================================
CREATE TABLE public.exclusivity_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  auto_renew boolean NOT NULL DEFAULT false,
  renewal_period_months int DEFAULT 12,
  commission_percentage numeric,
  notes text,
  status exclusivity_status NOT NULL DEFAULT 'ativo',
  alert_days_before int NOT NULL DEFAULT 30,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exclusivity_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exclusivity_contracts_tenant_isolation" ON public.exclusivity_contracts FOR ALL USING (tenant_id = auth_tenant_id());
CREATE TRIGGER update_exclusivity_contracts_updated_at BEFORE UPDATE ON public.exclusivity_contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. Add captured_at, published_at, captured_by to properties
-- ============================================
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS captured_by uuid;

-- ============================================
-- 10b. Trigger to notify exclusivity expiring
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_exclusivity_expiring()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'ativo' AND NEW.end_date <= (CURRENT_DATE + (NEW.alert_days_before || ' days')::interval) THEN
    INSERT INTO public.notifications (user_id, title, message, category, reference_type, reference_id, tenant_id)
    SELECT ur.user_id,
           'Exclusividade Vencendo',
           'Contrato de exclusividade vence em ' || (NEW.end_date - CURRENT_DATE) || ' dias.',
           'comercial', 'exclusivity', NEW.id::text, NEW.tenant_id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'gerente') AND ur.tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_exclusivity_expiring
  AFTER INSERT OR UPDATE ON public.exclusivity_contracts
  FOR EACH ROW EXECUTE FUNCTION notify_exclusivity_expiring();
