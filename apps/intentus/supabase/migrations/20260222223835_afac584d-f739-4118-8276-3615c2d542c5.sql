
-- Enum for relationship triggers
CREATE TYPE public.relationship_trigger AS ENUM (
  'contrato_vencendo',
  'rescisao_iniciada',
  'rescisao_parada_x_dias',
  'reajuste_pendente',
  'ticket_sla_estourado',
  'ticket_aberto',
  'manutencao_urgente',
  'renovacao_proxima',
  'garantia_vencendo',
  'vistoria_agendada'
);

-- Relationship automations table
CREATE TABLE public.relationship_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  trigger_event relationship_trigger NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  action_type public.automation_action NOT NULL DEFAULT 'notificacao',
  action_config JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.relationship_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.relationship_automations
  FOR ALL USING (tenant_id = public.auth_tenant_id());

CREATE TRIGGER update_relationship_automations_updated_at
  BEFORE UPDATE ON public.relationship_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Relationship automation logs table
CREATE TABLE public.relationship_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  automation_id UUID NOT NULL REFERENCES public.relationship_automations(id),
  contract_id UUID,
  ticket_id UUID,
  person_id UUID,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action_taken TEXT,
  status public.automation_log_status NOT NULL DEFAULT 'pendente',
  notes TEXT
);

ALTER TABLE public.relationship_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.relationship_automation_logs
  FOR ALL USING (tenant_id = public.auth_tenant_id());
