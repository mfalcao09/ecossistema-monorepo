
-- Item 6: Allow tenants to view their own subscription data
CREATE POLICY "Tenants can view their own subscriptions"
ON public.tenant_subscriptions
FOR SELECT
USING (tenant_id = auth_tenant_id());
