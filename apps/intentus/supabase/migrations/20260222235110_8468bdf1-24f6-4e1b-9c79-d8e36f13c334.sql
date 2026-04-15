
-- =============================================
-- FASE 1: Tabelas Base (Módulos 3-8, 15-17)
-- =============================================

-- Módulo 3: Biblioteca de Modelos de Contrato
CREATE TABLE public.legal_contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  template_type text NOT NULL DEFAULT 'outro',
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_contract_templates FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_contract_templates_updated_at BEFORE UPDATE ON public.legal_contract_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Módulo 4: Procurações
CREATE TABLE public.legal_powers_of_attorney (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  person_id uuid REFERENCES public.people(id),
  contract_id uuid REFERENCES public.contracts(id),
  grantor_name text NOT NULL,
  grantee_name text NOT NULL,
  type text NOT NULL DEFAULT 'particular',
  purpose text,
  notary_office text,
  start_date date,
  expiry_date date,
  document_url text,
  status text NOT NULL DEFAULT 'ativa',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_powers_of_attorney ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_powers_of_attorney FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_powers_of_attorney_updated_at BEFORE UPDATE ON public.legal_powers_of_attorney FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Módulo 5: Notificações Extrajudiciais
CREATE TABLE public.legal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  contract_id uuid REFERENCES public.contracts(id),
  person_id uuid REFERENCES public.people(id),
  notification_type text NOT NULL DEFAULT 'outro',
  subject text NOT NULL,
  body text,
  sent_date date,
  delivery_method text NOT NULL DEFAULT 'ar',
  tracking_code text,
  delivery_confirmed_at timestamptz,
  legal_deadline date,
  status text NOT NULL DEFAULT 'rascunho',
  document_url text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_notifications FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_notifications_updated_at BEFORE UPDATE ON public.legal_notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Módulo 6: Processos Judiciais
CREATE TABLE public.legal_proceedings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  contract_id uuid REFERENCES public.contracts(id),
  property_id uuid REFERENCES public.properties(id),
  person_id uuid REFERENCES public.people(id),
  case_number text,
  court text,
  judge text,
  proceeding_type text NOT NULL DEFAULT 'outro',
  status text NOT NULL DEFAULT 'em_andamento',
  filed_date date,
  next_deadline date,
  lawyer_name text,
  lawyer_oab text,
  provisioned_amount numeric DEFAULT 0,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_proceedings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_proceedings FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_proceedings_updated_at BEFORE UPDATE ON public.legal_proceedings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.legal_proceeding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proceeding_id uuid NOT NULL REFERENCES public.legal_proceedings(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  event_type text NOT NULL DEFAULT 'outro',
  document_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_proceeding_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_proceeding_events FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

-- Módulo 7: Compliance
CREATE TABLE public.legal_compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  property_id uuid REFERENCES public.properties(id),
  contract_id uuid REFERENCES public.contracts(id),
  item_type text NOT NULL DEFAULT 'outro',
  description text NOT NULL,
  expiry_date date,
  status text NOT NULL DEFAULT 'pendente',
  document_url text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_compliance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_compliance_items FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_compliance_items_updated_at BEFORE UPDATE ON public.legal_compliance_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Módulo 8: Assinaturas Digitais
CREATE TABLE public.legal_signature_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  contract_id uuid REFERENCES public.contracts(id),
  title text NOT NULL,
  provider text NOT NULL DEFAULT 'manual',
  external_envelope_id text,
  status text NOT NULL DEFAULT 'rascunho',
  sent_at timestamptz,
  completed_at timestamptz,
  document_url text,
  signed_document_url text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_signature_envelopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_signature_envelopes FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_signature_envelopes_updated_at BEFORE UPDATE ON public.legal_signature_envelopes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.legal_signature_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id uuid NOT NULL REFERENCES public.legal_signature_envelopes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  person_id uuid REFERENCES public.people(id),
  name text NOT NULL,
  email text,
  cpf text,
  role text NOT NULL DEFAULT 'outro',
  sign_order integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pendente',
  signed_at timestamptz,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_signature_signers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_signature_signers FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

-- Módulo 15: Seguros Obrigatórios
CREATE TABLE public.legal_mandatory_insurance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  contract_id uuid REFERENCES public.contracts(id),
  insurance_type text NOT NULL DEFAULT 'incendio',
  insurer_name text,
  policy_number text,
  start_date date,
  end_date date,
  premium_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  document_url text,
  key_delivery_blocked boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_mandatory_insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_mandatory_insurance FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_mandatory_insurance_updated_at BEFORE UPDATE ON public.legal_mandatory_insurance FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Módulo 16: Controle de Ocupação
CREATE TABLE public.legal_occupation_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  check_type text NOT NULL DEFAULT 'vistoria_preventiva',
  scheduled_date date,
  completed_date date,
  status text NOT NULL DEFAULT 'agendada',
  findings text,
  photo_urls jsonb DEFAULT '[]'::jsonb,
  consumption_data jsonb DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_occupation_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_occupation_checks FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_occupation_checks_updated_at BEFORE UPDATE ON public.legal_occupation_checks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- FASE 2: Tabelas Add-on (Módulos 9-14)
-- =============================================

-- Módulo 9: Despacho e Órgãos Públicos
CREATE TABLE public.legal_dispatch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  property_id uuid REFERENCES public.properties(id),
  contract_id uuid REFERENCES public.contracts(id),
  order_type text NOT NULL DEFAULT 'outro',
  description text NOT NULL,
  status text NOT NULL DEFAULT 'solicitado',
  dispatcher_name text,
  estimated_cost numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  document_url text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_dispatch_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_dispatch_orders FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_dispatch_orders_updated_at BEFORE UPDATE ON public.legal_dispatch_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Módulo 10: LGPD
CREATE TABLE public.lgpd_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  person_id uuid NOT NULL REFERENCES public.people(id),
  consent_type text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  ip_address text,
  channel text NOT NULL DEFAULT 'sistema',
  document_version text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.lgpd_consents FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

CREATE TABLE public.lgpd_data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  person_id uuid NOT NULL REFERENCES public.people(id),
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'recebida',
  received_at timestamptz NOT NULL DEFAULT now(),
  deadline timestamptz,
  completed_at timestamptz,
  response_notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lgpd_data_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.lgpd_data_requests FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_lgpd_data_requests_updated_at BEFORE UPDATE ON public.lgpd_data_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.lgpd_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'media',
  detected_at timestamptz NOT NULL DEFAULT now(),
  reported_to_anpd boolean NOT NULL DEFAULT false,
  action_plan text,
  status text NOT NULL DEFAULT 'detectado',
  resolved_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lgpd_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.lgpd_incidents FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_lgpd_incidents_updated_at BEFORE UPDATE ON public.lgpd_incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Módulo 11: OCR de Matrículas
CREATE TABLE public.legal_registry_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  property_id uuid REFERENCES public.properties(id),
  document_url text,
  analysis_status text NOT NULL DEFAULT 'enviado',
  extracted_data jsonb DEFAULT '{}'::jsonb,
  alerts jsonb DEFAULT '[]'::jsonb,
  owner_name_extracted text,
  owner_match boolean,
  ai_summary text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_registry_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_registry_analyses FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_registry_analyses_updated_at BEFORE UPDATE ON public.legal_registry_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Módulo 12: Legal Desk
CREATE TABLE public.legal_desk_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  template_type text NOT NULL DEFAULT 'outro',
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_desk_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_desk_templates FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_desk_templates_updated_at BEFORE UPDATE ON public.legal_desk_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.legal_desk_generated_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  template_id uuid NOT NULL REFERENCES public.legal_desk_templates(id),
  generated_by uuid NOT NULL,
  filled_variables jsonb DEFAULT '{}'::jsonb,
  document_url text,
  status text NOT NULL DEFAULT 'gerado',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_desk_generated_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_desk_generated_docs FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

-- Módulo 13: Jurimetria
CREATE TABLE public.legal_jurimetrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  proceeding_id uuid REFERENCES public.legal_proceedings(id),
  court text,
  judge text,
  proceeding_type text,
  filed_date date,
  resolution_date date,
  resolution_type text,
  time_to_resolution_days integer,
  discount_percentage numeric,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_jurimetrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_jurimetrics FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());

-- Módulo 14: Mapeamento Societário
CREATE TABLE public.legal_corporate_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  person_id uuid REFERENCES public.people(id),
  cnpj text,
  company_name text NOT NULL,
  social_contract_url text,
  status text NOT NULL DEFAULT 'ativa',
  last_checked_at timestamptz,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_corporate_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_corporate_entities FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
CREATE TRIGGER update_legal_corporate_entities_updated_at BEFORE UPDATE ON public.legal_corporate_entities FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.legal_corporate_signatories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.legal_corporate_entities(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  person_id uuid REFERENCES public.people(id),
  name text NOT NULL,
  cpf text,
  role text NOT NULL DEFAULT 'socio',
  can_sign boolean NOT NULL DEFAULT false,
  signing_rules text,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_corporate_signatories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.legal_corporate_signatories FOR ALL USING (tenant_id = auth_tenant_id()) WITH CHECK (tenant_id = auth_tenant_id());
