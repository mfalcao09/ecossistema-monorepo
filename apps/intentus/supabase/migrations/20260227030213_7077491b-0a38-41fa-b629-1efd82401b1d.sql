
-- 1. Expand contract_documents with new columns
ALTER TABLE public.contract_documents 
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reminder_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS document_category TEXT DEFAULT 'geral';

-- 2. Create property_documents table (independent of contracts)
CREATE TABLE IF NOT EXISTS public.property_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'outro',
  document_category TEXT DEFAULT 'geral',
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'em_analise',
  version INTEGER NOT NULL DEFAULT 1,
  parent_document_id UUID REFERENCES public.property_documents(id),
  notes TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  reminder_days INTEGER DEFAULT 30,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view property documents"
  ON public.property_documents FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "Tenant members can insert property documents"
  ON public.property_documents FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "Tenant members can update property documents"
  ON public.property_documents FOR UPDATE
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "Tenant members can delete property documents"
  ON public.property_documents FOR DELETE
  USING (tenant_id = auth_tenant_id());

CREATE TRIGGER update_property_documents_updated_at
  BEFORE UPDATE ON public.property_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create document_extraction_templates table
CREATE TABLE IF NOT EXISTS public.document_extraction_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'generico',
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.document_extraction_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage extraction templates"
  ON public.document_extraction_templates FOR ALL
  USING (tenant_id = auth_tenant_id());

CREATE TRIGGER update_document_extraction_templates_updated_at
  BEFORE UPDATE ON public.document_extraction_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create property_document_tokens table (for QR Code public access)
CREATE TABLE IF NOT EXISTS public.property_document_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE,
  allowed_doc_types TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.property_document_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage property tokens"
  ON public.property_document_tokens FOR ALL
  USING (tenant_id = auth_tenant_id());

CREATE POLICY "Public read property tokens by token value"
  ON public.property_document_tokens FOR SELECT
  USING (true);

-- 5. Enhance legal_registry_analyses table
ALTER TABLE public.legal_registry_analyses
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT 'matricula',
  ADD COLUMN IF NOT EXISTS structured_result JSONB,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- 6. Create storage bucket for property documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-docs', 'property-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload property docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-docs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant members can view property docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-docs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant members can delete property docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'property-docs' AND auth.uid() IS NOT NULL);
