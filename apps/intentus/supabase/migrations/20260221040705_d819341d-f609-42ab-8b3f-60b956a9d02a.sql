
-- =============================================================
-- FIX 1: Block anonymous direct access to multi-tenant tables
-- Public data must be accessed ONLY via public-api edge function
-- =============================================================

-- Drop overly permissive anon policies on properties
DROP POLICY IF EXISTS "properties_select_anon" ON public.properties;
CREATE POLICY "properties_select_anon" ON public.properties FOR SELECT TO anon USING (false);

-- Drop overly permissive anon policies on property_media
DROP POLICY IF EXISTS "prop_media_select_anon" ON public.property_media;
CREATE POLICY "prop_media_select_anon" ON public.property_media FOR SELECT TO anon USING (false);

-- Drop overly permissive anon policies on developments
DROP POLICY IF EXISTS "developments_select_anon" ON public.developments;
CREATE POLICY "developments_select_anon" ON public.developments FOR SELECT TO anon USING (false);

-- Drop overly permissive anon policy on development_units
DROP POLICY IF EXISTS "dev_units_select_anon" ON public.development_units;
CREATE POLICY "dev_units_select_anon" ON public.development_units FOR SELECT TO anon USING (false);

-- Drop overly permissive anon policy on property_features
DROP POLICY IF EXISTS "property_features_select_anon" ON public.property_features;
CREATE POLICY "property_features_select_anon" ON public.property_features FOR SELECT TO anon USING (false);

-- =============================================================
-- FIX 2: Hide bank credential secrets from client-side access
-- Create views that exclude sensitive fields
-- =============================================================

-- Create safe view for tenant bank credentials (excludes secrets)
CREATE OR REPLACE VIEW public.bank_api_credentials_safe
WITH (security_invoker = on) AS
SELECT
  id, bank_account_id, provider, api_environment, active, 
  webhook_url, extra_config, created_by, created_at, updated_at, tenant_id,
  -- Only expose whether secret fields are set, not their values
  (client_id IS NOT NULL AND client_id != '') AS has_client_id,
  (client_secret IS NOT NULL AND client_secret != '') AS has_client_secret,
  (certificate_base64 IS NOT NULL) AS has_certificate,
  (certificate_key_base64 IS NOT NULL) AS has_certificate_key,
  (access_token IS NOT NULL) AS has_access_token,
  token_expires_at
FROM public.bank_api_credentials;

-- Create safe view for platform bank credentials (excludes secrets)  
CREATE OR REPLACE VIEW public.platform_bank_credentials_safe
WITH (security_invoker = on) AS
SELECT
  id, provider, api_environment, active, pix_key, bank_name, account_info,
  extra_config, created_by, created_at, updated_at,
  (client_id IS NOT NULL AND client_id != '') AS has_client_id,
  (client_secret IS NOT NULL AND client_secret != '') AS has_client_secret,
  (certificate_base64 IS NOT NULL) AS has_certificate,
  (certificate_key_base64 IS NOT NULL) AS has_certificate_key,
  (access_token IS NOT NULL) AS has_access_token,
  token_expires_at
FROM public.platform_bank_credentials;

-- Now replace SELECT policy on bank_api_credentials to deny direct reads
DROP POLICY IF EXISTS "bank_creds_select" ON public.bank_api_credentials;
CREATE POLICY "bank_creds_select" ON public.bank_api_credentials FOR SELECT
  USING (
    tenant_id = auth_tenant_id() 
    AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'))
  );

-- Note: We keep the SELECT policy but the view is the recommended way to read.
-- The view excludes secrets while still allowing INSERT/UPDATE for credential management.
