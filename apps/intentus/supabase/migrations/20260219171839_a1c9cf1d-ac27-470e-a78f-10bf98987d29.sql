
-- Allow superadmins to read ALL tenants (cross-tenant)
CREATE POLICY "superadmin_tenants_select"
ON public.tenants
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superadmin'));

-- Allow superadmins to read ALL profiles (cross-tenant)
CREATE POLICY "superadmin_profiles_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superadmin'));

-- Allow superadmins to read ALL user_roles (cross-tenant)
CREATE POLICY "superadmin_roles_select"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superadmin'));
