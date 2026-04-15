
-- 1. pix_checkouts: add service_role-only policy (table already has RLS enabled)
CREATE POLICY "pix_checkouts_service_role_all"
  ON public.pix_checkouts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. bank_api_credentials_safe: set security_invoker so RLS on base table is respected
ALTER VIEW public.bank_api_credentials_safe SET (security_invoker = true);
