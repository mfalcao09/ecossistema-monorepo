
-- Fix overly permissive INSERT policies

-- 1. bank_webhook_events: restrict to service role only (webhooks come from edge functions)
DROP POLICY IF EXISTS "webhook_insert" ON public.bank_webhook_events;
CREATE POLICY "webhook_insert_service"
  ON public.bank_webhook_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 2. notifications: restrict INSERT to authenticated users within their tenant
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert_tenant"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth_tenant_id());

-- Also allow service_role (triggers/functions) to insert
CREATE POLICY "notifications_insert_service"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3. Add tenant_subscriptions status 'expirado' and 'bloqueado' support
-- Add column for subscription blocking
ALTER TABLE public.tenant_subscriptions 
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text;
