
-- Property Attachments table
CREATE TABLE public.property_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'document',
  file_size INTEGER,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.property_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_attachments_select_auth" ON public.property_attachments FOR SELECT USING (true);
CREATE POLICY "property_attachments_insert" ON public.property_attachments FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR EXISTS (SELECT 1 FROM properties p WHERE p.id = property_attachments.property_id AND p.created_by = auth.uid()));
CREATE POLICY "property_attachments_delete" ON public.property_attachments FOR DELETE
  USING (is_admin_or_gerente(auth.uid()) OR EXISTS (SELECT 1 FROM properties p WHERE p.id = property_attachments.property_id AND p.created_by = auth.uid()));

-- Property Owners linking table
CREATE TABLE public.property_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  ownership_percentage NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(property_id, person_id)
);

ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_owners_select_auth" ON public.property_owners FOR SELECT USING (true);
CREATE POLICY "property_owners_insert" ON public.property_owners FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR EXISTS (SELECT 1 FROM properties p WHERE p.id = property_owners.property_id AND p.created_by = auth.uid()));
CREATE POLICY "property_owners_delete" ON public.property_owners FOR DELETE
  USING (is_admin_or_gerente(auth.uid()) OR EXISTS (SELECT 1 FROM properties p WHERE p.id = property_owners.property_id AND p.created_by = auth.uid()));
CREATE POLICY "property_owners_update" ON public.property_owners FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR EXISTS (SELECT 1 FROM properties p WHERE p.id = property_owners.property_id AND p.created_by = auth.uid()));

-- Storage bucket for property documents/attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('property-documents', 'property-documents', false);

CREATE POLICY "property_docs_select" ON storage.objects FOR SELECT USING (bucket_id = 'property-documents' AND auth.role() = 'authenticated');
CREATE POLICY "property_docs_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-documents' AND auth.role() = 'authenticated');
CREATE POLICY "property_docs_delete" ON storage.objects FOR DELETE USING (bucket_id = 'property-documents' AND auth.role() = 'authenticated');
