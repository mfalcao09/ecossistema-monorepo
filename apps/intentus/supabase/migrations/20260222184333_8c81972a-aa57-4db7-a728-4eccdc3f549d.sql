
-- Create deal_request_attachments table
CREATE TABLE public.deal_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_request_id UUID NOT NULL REFERENCES public.deal_requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_request_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view deal attachments"
  ON public.deal_request_attachments FOR SELECT
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Tenant members can insert deal attachments"
  ON public.deal_request_attachments FOR INSERT
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY "Uploaders can delete their attachments"
  ON public.deal_request_attachments FOR DELETE
  USING (uploaded_by = auth.uid());

-- Create storage bucket for deal attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('deal-attachments', 'deal-attachments', false);

CREATE POLICY "Tenant users can upload deal attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deal-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant users can read deal attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deal-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own deal attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'deal-attachments' AND auth.uid() IS NOT NULL);
