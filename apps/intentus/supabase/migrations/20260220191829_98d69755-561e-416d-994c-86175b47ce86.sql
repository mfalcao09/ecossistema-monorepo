-- 1. Allow any authenticated user to READ plans (needed for onboarding)
CREATE POLICY "anyone_can_read_active_plans"
  ON public.plans FOR SELECT
  TO authenticated
  USING (active = true);

-- 2. Allow authenticated users to INSERT their own subscription (onboarding)
CREATE POLICY "users_can_create_own_subscription"
  ON public.tenant_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = auth_tenant_id());

-- 3. Fix Enterprise plan: add financeiro_basico module
UPDATE public.plans
SET modules = '["dashboard","imoveis","pessoas","contratos","empreendimentos","garantias","comercial","financeiro_basico","financeiro_completo","comissoes","repasses","integracao_bancaria","dimob","retencao_ir","juridico","due_diligence","relacionamento","manutencao","vitrine","api","sla","gerente_dedicado"]'::jsonb
WHERE name = 'Enterprise';
