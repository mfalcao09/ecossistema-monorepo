
-- Superadmin can manage user_roles cross-tenant
CREATE POLICY "superadmin_user_roles_insert" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "superadmin_user_roles_update" ON public.user_roles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "superadmin_user_roles_delete" ON public.user_roles
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Superadmin can update tenants cross-tenant
CREATE POLICY "superadmin_tenants_update" ON public.tenants
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));
