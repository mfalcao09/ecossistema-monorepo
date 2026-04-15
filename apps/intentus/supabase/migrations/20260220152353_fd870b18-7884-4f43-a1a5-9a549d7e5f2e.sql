
-- ============================================================
-- FASE 1: Reestruturação da Área de Relacionamento
-- ============================================================

-- 1. Novos ENUMs
CREATE TYPE public.ticket_category AS ENUM (
  'duvida_contratual', 'manutencao', 'renegociacao', 'financeiro', 'documentos', 'outro'
);

CREATE TYPE public.ticket_status AS ENUM (
  'aberto', 'em_atendimento', 'aguardando_cliente', 'resolvido', 'cancelado'
);

CREATE TYPE public.ticket_department AS ENUM (
  'relacionamento', 'comercial', 'financeiro', 'juridico', 'manutencao'
);

CREATE TYPE public.ticket_sender_type AS ENUM (
  'cliente', 'equipe'
);

CREATE TYPE public.maintenance_responsibility AS ENUM (
  'locador', 'locatario', 'construtora', 'condominio'
);

CREATE TYPE public.handover_type AS ENUM (
  'entrega', 'devolucao'
);

CREATE TYPE public.inspection_condition AS ENUM (
  'bom', 'regular', 'ruim', 'inexistente'
);

-- 2. Tabela: support_tickets
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  contract_id UUID REFERENCES public.contracts(id),
  person_id UUID NOT NULL REFERENCES public.people(id),
  property_id UUID REFERENCES public.properties(id),
  category public.ticket_category NOT NULL DEFAULT 'outro',
  subject TEXT NOT NULL,
  description TEXT,
  priority public.maintenance_priority NOT NULL DEFAULT 'media',
  status public.ticket_status NOT NULL DEFAULT 'aberto',
  assigned_to UUID,
  assigned_department public.ticket_department,
  sla_deadline TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_select" ON public.support_tickets
  FOR SELECT USING (tenant_id = auth_tenant_id());

CREATE POLICY "support_tickets_insert" ON public.support_tickets
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND (
      is_admin_or_gerente(auth.uid())
      OR has_role(auth.uid(), 'corretor'::app_role)
      OR has_role(auth.uid(), 'financeiro'::app_role)
      OR has_role(auth.uid(), 'juridico'::app_role)
      OR has_role(auth.uid(), 'manutencao'::app_role)
    )
  );

CREATE POLICY "support_tickets_update" ON public.support_tickets
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND (
      is_admin_or_gerente(auth.uid())
      OR has_role(auth.uid(), 'financeiro'::app_role)
      OR has_role(auth.uid(), 'juridico'::app_role)
      OR has_role(auth.uid(), 'manutencao'::app_role)
    )
  );

CREATE POLICY "support_tickets_delete" ON public.support_tickets
  FOR DELETE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- 3. Tabela: support_ticket_messages
CREATE TABLE public.support_ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type public.ticket_sender_type NOT NULL DEFAULT 'equipe',
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_messages_select" ON public.support_ticket_messages
  FOR SELECT USING (tenant_id = auth_tenant_id());

CREATE POLICY "ticket_messages_insert" ON public.support_ticket_messages
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND (
      is_admin_or_gerente(auth.uid())
      OR has_role(auth.uid(), 'corretor'::app_role)
      OR has_role(auth.uid(), 'financeiro'::app_role)
      OR has_role(auth.uid(), 'juridico'::app_role)
      OR has_role(auth.uid(), 'manutencao'::app_role)
    )
  );

CREATE POLICY "ticket_messages_delete" ON public.support_ticket_messages
  FOR DELETE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- 4. Tabela: client_portal_tokens
CREATE TABLE public.client_portal_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  person_id UUID NOT NULL REFERENCES public.people(id),
  token_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_tokens_select" ON public.client_portal_tokens
  FOR SELECT USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

CREATE POLICY "portal_tokens_insert" ON public.client_portal_tokens
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

CREATE POLICY "portal_tokens_delete" ON public.client_portal_tokens
  FOR DELETE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- 5. Tabela: inspection_photos
CREATE TABLE public.inspection_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  condition public.inspection_condition,
  room_or_item TEXT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspection_photos_select" ON public.inspection_photos
  FOR SELECT USING (tenant_id = auth_tenant_id());

CREATE POLICY "inspection_photos_insert" ON public.inspection_photos
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND (
      is_admin_or_gerente(auth.uid())
      OR has_role(auth.uid(), 'manutencao'::app_role)
      OR has_role(auth.uid(), 'corretor'::app_role)
    )
  );

CREATE POLICY "inspection_photos_delete" ON public.inspection_photos
  FOR DELETE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- 6. Tabela: key_handovers
CREATE TABLE public.key_handovers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  contract_id UUID NOT NULL REFERENCES public.contracts(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  handover_type public.handover_type NOT NULL DEFAULT 'entrega',
  scheduled_date DATE,
  completed_date DATE,
  inspection_id UUID REFERENCES public.inspections(id),
  term_document_url TEXT,
  signed_by TEXT,
  signature_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.key_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "key_handovers_select" ON public.key_handovers
  FOR SELECT USING (tenant_id = auth_tenant_id());

CREATE POLICY "key_handovers_insert" ON public.key_handovers
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND (
      is_admin_or_gerente(auth.uid())
      OR has_role(auth.uid(), 'manutencao'::app_role)
      OR has_role(auth.uid(), 'corretor'::app_role)
    )
  );

CREATE POLICY "key_handovers_update" ON public.key_handovers
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND (
      is_admin_or_gerente(auth.uid())
      OR has_role(auth.uid(), 'manutencao'::app_role)
    )
  );

CREATE POLICY "key_handovers_delete" ON public.key_handovers
  FOR DELETE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- 7. Evoluções em maintenance_requests
ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS responsibility public.maintenance_responsibility,
  ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES public.support_tickets(id),
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 8. Evoluções em inspections
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS key_handover_id UUID REFERENCES public.key_handovers(id),
  ADD COLUMN IF NOT EXISTS digital_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS term_generated BOOLEAN NOT NULL DEFAULT false;

-- 9. Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('support-attachments', 'support-attachments', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos', 'inspection-photos', false);

-- Storage policies: support-attachments
CREATE POLICY "support_attachments_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'support-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "support_attachments_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'support-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "support_attachments_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'support-attachments' AND auth.role() = 'authenticated');

-- Storage policies: inspection-photos
CREATE POLICY "inspection_photos_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'inspection-photos' AND auth.role() = 'authenticated');

CREATE POLICY "inspection_photos_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'inspection-photos' AND auth.role() = 'authenticated');

CREATE POLICY "inspection_photos_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'inspection-photos' AND auth.role() = 'authenticated');

-- 10. Trigger para updated_at nas novas tabelas
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_key_handovers_updated_at
  BEFORE UPDATE ON public.key_handovers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Habilitar realtime para tickets (atualizações em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
