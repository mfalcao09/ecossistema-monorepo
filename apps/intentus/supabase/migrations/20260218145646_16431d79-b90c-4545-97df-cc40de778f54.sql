
-- ===========================================
-- 1. GUARANTEE TYPES (Cadastro de Garantias)
-- ===========================================
CREATE TABLE public.guarantee_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  required_documents text[], -- lista de documentos necessários
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guarantee_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guarantee_types_select" ON public.guarantee_types FOR SELECT USING (true);
CREATE POLICY "guarantee_types_insert" ON public.guarantee_types FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'juridico') OR has_role(auth.uid(), 'financeiro'));
CREATE POLICY "guarantee_types_update" ON public.guarantee_types FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'juridico'));
CREATE POLICY "guarantee_types_delete" ON public.guarantee_types FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_guarantee_types_updated_at
  BEFORE UPDATE ON public.guarantee_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===========================================
-- 2. INSPECTIONS (Vistorias)
-- ===========================================
CREATE TYPE public.inspection_type AS ENUM ('entrada', 'saida');
CREATE TYPE public.inspection_status AS ENUM ('agendada', 'em_andamento', 'concluida', 'cancelada');

CREATE TABLE public.inspections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id),
  contract_id uuid REFERENCES public.contracts(id),
  deal_request_id uuid REFERENCES public.deal_requests(id),
  inspection_type public.inspection_type NOT NULL,
  status public.inspection_status NOT NULL DEFAULT 'agendada',
  scheduled_date date,
  completed_date date,
  inspector_notes text,
  assigned_to uuid, -- user responsável (manutenção)
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspections_select" ON public.inspections FOR SELECT USING (true);
CREATE POLICY "inspections_insert" ON public.inspections FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor') OR has_role(auth.uid(), 'manutencao') OR has_role(auth.uid(), 'juridico'));
CREATE POLICY "inspections_update" ON public.inspections FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'manutencao') OR (assigned_to = auth.uid()));
CREATE POLICY "inspections_delete" ON public.inspections FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_inspections_updated_at
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Inspection checklist items
CREATE TABLE public.inspection_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  condition text, -- 'bom', 'regular', 'ruim', 'inexistente'
  notes text,
  photo_urls text[],
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_items_select" ON public.inspection_items FOR SELECT USING (true);
CREATE POLICY "inspection_items_insert" ON public.inspection_items FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'manutencao') OR has_role(auth.uid(), 'corretor'));
CREATE POLICY "inspection_items_update" ON public.inspection_items FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'manutencao'));
CREATE POLICY "inspection_items_delete" ON public.inspection_items FOR DELETE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'manutencao'));

-- ===========================================
-- 3. CONTRACT TERMINATIONS (Rescisão)
-- ===========================================
CREATE TYPE public.termination_status AS ENUM (
  'aviso_previo',
  'vistoria_saida',
  'calculo_multa',
  'quitacao_pendencias',
  'termo_entrega',
  'garantia_liberada',
  'encerrado',
  'cancelado'
);

CREATE TABLE public.contract_terminations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  status public.termination_status NOT NULL DEFAULT 'aviso_previo',
  notice_date date, -- data do aviso prévio
  requested_by_party text, -- 'locatario' ou 'locador'
  exit_inspection_id uuid REFERENCES public.inspections(id),
  penalty_value numeric, -- multa rescisória calculada
  penalty_notes text,
  pending_debts_total numeric DEFAULT 0,
  pending_debts_notes text,
  key_handover_date date,
  guarantee_release_date date,
  guarantee_release_notes text,
  final_term_notes text, -- termo de entrega e quitação
  assigned_to uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_terminations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terminations_select" ON public.contract_terminations FOR SELECT USING (true);
CREATE POLICY "terminations_insert" ON public.contract_terminations FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor') OR has_role(auth.uid(), 'financeiro') OR has_role(auth.uid(), 'juridico'));
CREATE POLICY "terminations_update" ON public.contract_terminations FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro') OR has_role(auth.uid(), 'juridico'));
CREATE POLICY "terminations_delete" ON public.contract_terminations FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_terminations_updated_at
  BEFORE UPDATE ON public.contract_terminations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Termination history (audit trail for status changes)
CREATE TABLE public.termination_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  termination_id uuid NOT NULL REFERENCES public.contract_terminations(id) ON DELETE CASCADE,
  from_status public.termination_status,
  to_status public.termination_status NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.termination_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "termination_history_select" ON public.termination_history FOR SELECT USING (true);
CREATE POLICY "termination_history_insert" ON public.termination_history FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor') OR has_role(auth.uid(), 'financeiro') OR has_role(auth.uid(), 'juridico'));

-- ===========================================
-- 4. COLLECTION RULES (Régua de Cobrança)
-- ===========================================
CREATE TYPE public.collection_action_type AS ENUM (
  'lembrete_vencimento',
  'cobranca_amigavel',
  'aviso_multa_juros',
  'notificacao_formal',
  'encaminhamento_renegociacao',
  'dossie_despejo'
);

CREATE TABLE public.collection_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  days_after_due integer NOT NULL, -- D+0, D+3, D+7, etc.
  action_type public.collection_action_type NOT NULL,
  message_template text, -- template da mensagem
  notify_webhook boolean NOT NULL DEFAULT false, -- dispara webhook (n8n)
  block_owner_transfer boolean NOT NULL DEFAULT false, -- bloqueia repasse
  create_legal_card boolean NOT NULL DEFAULT false, -- cria card no jurídico
  department text, -- departamento responsável
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collection_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_rules_select" ON public.collection_rules FOR SELECT USING (true);
CREATE POLICY "collection_rules_insert" ON public.collection_rules FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'));
CREATE POLICY "collection_rules_update" ON public.collection_rules FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'));
CREATE POLICY "collection_rules_delete" ON public.collection_rules FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_collection_rules_updated_at
  BEFORE UPDATE ON public.collection_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Collection events log (audit of each action taken)
CREATE TABLE public.collection_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installment_id uuid NOT NULL REFERENCES public.contract_installments(id),
  rule_id uuid REFERENCES public.collection_rules(id),
  action_type public.collection_action_type NOT NULL,
  action_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'enviado', -- 'enviado', 'entregue', 'falha'
  webhook_response text, -- resposta do webhook
  notes text,
  created_by uuid, -- null = automático
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_events_select" ON public.collection_events FOR SELECT USING (true);
CREATE POLICY "collection_events_insert" ON public.collection_events FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'));
