
-- Create storage bucket for platform assets (logo, favicon, etc.)
INSERT INTO storage.buckets (id, name, public) VALUES ('platform-assets', 'platform-assets', true);

-- Anyone can view platform assets
CREATE POLICY "Public read access for platform assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'platform-assets');

-- Only superadmins can upload/update/delete
CREATE POLICY "Superadmins can upload platform assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'platform-assets' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'superadmin'));

CREATE POLICY "Superadmins can update platform assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'platform-assets' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'superadmin'));

CREATE POLICY "Superadmins can delete platform assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'platform-assets' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'superadmin'));
