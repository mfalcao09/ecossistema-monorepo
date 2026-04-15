
-- 1. Create helper function for SuperAdmin tenant filtering
CREATE OR REPLACE FUNCTION public.superadmin_tenant_filter(row_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    CASE
      -- Not a superadmin: deny (other policies handle access)
      WHEN NOT has_role(auth.uid(), 'superadmin') THEN false
      -- SuperAdmin in Master Tenant (Gestão mode): see everything
      WHEN auth_tenant_id() = '00000000-0000-0000-0000-000000000001' THEN true
      -- SuperAdmin impersonating: only see impersonated tenant's data
      ELSE row_tenant_id = auth_tenant_id()
    END
$$;

-- 2. Update properties SELECT policy
DROP POLICY IF EXISTS "superadmin_properties_select" ON public.properties;
CREATE POLICY "superadmin_properties_select"
  ON public.properties FOR SELECT
  USING (public.superadmin_tenant_filter(tenant_id));

-- 3. Add properties UPDATE policy for superadmin
DROP POLICY IF EXISTS "superadmin_properties_update" ON public.properties;
CREATE POLICY "superadmin_properties_update"
  ON public.properties FOR UPDATE
  USING (public.superadmin_tenant_filter(tenant_id));

-- 4. Update contracts SELECT policy
DROP POLICY IF EXISTS "superadmin_contracts_select" ON public.contracts;
CREATE POLICY "superadmin_contracts_select"
  ON public.contracts FOR SELECT
  USING (public.superadmin_tenant_filter(tenant_id));

-- 5. Update profiles SELECT policy
DROP POLICY IF EXISTS "superadmin_profiles_select" ON public.profiles;
CREATE POLICY "superadmin_profiles_select"
  ON public.profiles FOR SELECT
  USING (public.superadmin_tenant_filter(tenant_id));

-- 6. Update profiles UPDATE policy
DROP POLICY IF EXISTS "superadmin_profiles_update" ON public.profiles;
CREATE POLICY "superadmin_profiles_update"
  ON public.profiles FOR UPDATE
  USING (public.superadmin_tenant_filter(tenant_id));
