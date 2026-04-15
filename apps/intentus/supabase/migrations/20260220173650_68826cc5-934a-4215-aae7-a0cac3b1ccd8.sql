-- Allow tenant users to read their own invoices
CREATE POLICY "Tenants can view their own invoices"
ON public.tenant_invoices
FOR SELECT
USING (tenant_id = public.auth_tenant_id());