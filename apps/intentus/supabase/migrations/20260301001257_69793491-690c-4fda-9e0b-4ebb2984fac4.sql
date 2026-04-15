
-- Allow public (anon) to read property_document_tokens (needed to validate QR Code token)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'property_document_tokens' 
    AND policyname = 'Public can read property_document_tokens'
  ) THEN
    CREATE POLICY "Public can read property_document_tokens"
      ON public.property_document_tokens
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Allow public (anon) to read basic property info for the public portal
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'properties' 
    AND policyname = 'Public can read basic property info'
  ) THEN
    CREATE POLICY "Public can read basic property info"
      ON public.properties
      FOR SELECT
      USING (true);
  END IF;
END $$;
