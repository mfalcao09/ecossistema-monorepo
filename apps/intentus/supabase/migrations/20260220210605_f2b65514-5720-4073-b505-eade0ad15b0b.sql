CREATE POLICY "superadmin_profiles_update"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "admin_gerente_profiles_update"
ON public.profiles
FOR UPDATE
USING (is_admin_or_gerente(auth.uid()) AND tenant_id = auth_tenant_id());