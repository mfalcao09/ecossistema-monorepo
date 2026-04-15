
-- Add file columns to exclusivity_contracts
ALTER TABLE public.exclusivity_contracts
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_name text;

-- Create storage bucket for exclusivity documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('exclusivity-documents', 'exclusivity-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Authenticated users can upload exclusivity docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exclusivity-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read exclusivity docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'exclusivity-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete exclusivity docs"
ON storage.objects FOR DELETE
USING (bucket_id = 'exclusivity-documents' AND auth.role() = 'authenticated');
