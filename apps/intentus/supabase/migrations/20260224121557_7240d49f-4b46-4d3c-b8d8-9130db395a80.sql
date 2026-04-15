
-- =============================================
-- Fase 1: Evolução do Módulo de Assinaturas Digitais
-- =============================================

-- 1.1 Novas colunas em legal_signature_envelopes
ALTER TABLE public.legal_signature_envelopes
  ADD COLUMN IF NOT EXISTS signature_type text NOT NULL DEFAULT 'avancada',
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_interval text,
  ADD COLUMN IF NOT EXISTS max_reminders int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS pause_on_rejection boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS closing_mode text NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_message text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 1.5 Novas colunas em legal_signature_signers
ALTER TABLE public.legal_signature_signers
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count int NOT NULL DEFAULT 0;

-- 1.2 Nova tabela: legal_signature_documents
CREATE TABLE IF NOT EXISTS public.legal_signature_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id uuid NOT NULL REFERENCES public.legal_signature_envelopes(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  hash_sha256 text,
  uploaded_by uuid,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_signature_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation SELECT" ON public.legal_signature_documents
  FOR SELECT USING (tenant_id = public.auth_tenant_id() OR public.superadmin_tenant_filter(tenant_id));

CREATE POLICY "Tenant isolation INSERT" ON public.legal_signature_documents
  FOR INSERT WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY "Tenant isolation UPDATE" ON public.legal_signature_documents
  FOR UPDATE USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Tenant isolation DELETE" ON public.legal_signature_documents
  FOR DELETE USING (tenant_id = public.auth_tenant_id());

-- 1.3 Nova tabela: legal_signature_observers
CREATE TABLE IF NOT EXISTS public.legal_signature_observers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id uuid NOT NULL REFERENCES public.legal_signature_envelopes(id) ON DELETE CASCADE,
  name text,
  email text NOT NULL,
  notify_on text NOT NULL DEFAULT 'completion',
  receive_final boolean NOT NULL DEFAULT true,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_signature_observers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation SELECT" ON public.legal_signature_observers
  FOR SELECT USING (tenant_id = public.auth_tenant_id() OR public.superadmin_tenant_filter(tenant_id));

CREATE POLICY "Tenant isolation INSERT" ON public.legal_signature_observers
  FOR INSERT WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY "Tenant isolation UPDATE" ON public.legal_signature_observers
  FOR UPDATE USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Tenant isolation DELETE" ON public.legal_signature_observers
  FOR DELETE USING (tenant_id = public.auth_tenant_id());

-- 1.4 Nova tabela: legal_signature_audit_log (imutável — somente INSERT e SELECT)
CREATE TABLE IF NOT EXISTS public.legal_signature_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id uuid NOT NULL REFERENCES public.legal_signature_envelopes(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by text,
  performer_name text,
  ip_address text,
  user_agent text,
  geolocation text,
  details jsonb,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_signature_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation SELECT" ON public.legal_signature_audit_log
  FOR SELECT USING (tenant_id = public.auth_tenant_id() OR public.superadmin_tenant_filter(tenant_id));

CREATE POLICY "Tenant isolation INSERT" ON public.legal_signature_audit_log
  FOR INSERT WITH CHECK (tenant_id = public.auth_tenant_id());

-- NO UPDATE/DELETE policies — audit log is immutable

-- 1.6 Storage bucket for signature documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('signature-documents', 'signature-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can manage files in their tenant folder
CREATE POLICY "Tenant users can upload signature docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'signature-documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Tenant users can view signature docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signature-documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Tenant users can delete signature docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'signature-documents'
  AND auth.role() = 'authenticated'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sig_docs_envelope ON public.legal_signature_documents(envelope_id);
CREATE INDEX IF NOT EXISTS idx_sig_observers_envelope ON public.legal_signature_observers(envelope_id);
CREATE INDEX IF NOT EXISTS idx_sig_audit_envelope ON public.legal_signature_audit_log(envelope_id);
CREATE INDEX IF NOT EXISTS idx_sig_envelopes_deleted ON public.legal_signature_envelopes(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sig_envelopes_deadline ON public.legal_signature_envelopes(deadline_at) WHERE deadline_at IS NOT NULL;
