
-- Allow superadmins to read ALL contracts cross-tenant
CREATE POLICY "superadmin_contracts_select"
ON public.contracts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superadmin'));

-- Allow superadmins to read ALL properties cross-tenant
CREATE POLICY "superadmin_properties_select"
ON public.properties
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superadmin'));
