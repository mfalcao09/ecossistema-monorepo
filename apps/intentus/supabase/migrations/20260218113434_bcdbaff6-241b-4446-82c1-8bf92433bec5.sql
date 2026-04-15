
-- Create property_keys table for key management (chaveiros)
CREATE TABLE public.property_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  key_code TEXT NOT NULL,
  key_type TEXT NOT NULL DEFAULT 'comum',
  location TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.property_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_keys_select_auth" ON public.property_keys FOR SELECT USING (true);
CREATE POLICY "property_keys_insert" ON public.property_keys FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role)
    OR EXISTS (SELECT 1 FROM properties p WHERE p.id = property_keys.property_id AND p.created_by = auth.uid()));
CREATE POLICY "property_keys_delete" ON public.property_keys FOR DELETE
  USING (is_admin_or_gerente(auth.uid())
    OR EXISTS (SELECT 1 FROM properties p WHERE p.id = property_keys.property_id AND p.created_by = auth.uid()));
CREATE POLICY "property_keys_update" ON public.property_keys FOR UPDATE
  USING (is_admin_or_gerente(auth.uid())
    OR EXISTS (SELECT 1 FROM properties p WHERE p.id = property_keys.property_id AND p.created_by = auth.uid()));
