
-- 1. Create plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stripe_price_id text,
  max_users integer,
  max_properties integer,
  price_monthly numeric NOT NULL DEFAULT 0,
  features jsonb DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_plans_select" ON public.plans FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "superadmin_plans_insert" ON public.plans FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "superadmin_plans_update" ON public.plans FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "superadmin_plans_delete" ON public.plans FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed plans
INSERT INTO public.plans (name, stripe_price_id, max_users, max_properties, price_monthly, features) VALUES
  ('Básico', 'price_1T2XwkIcoggni2hDjo2GSwiv', 3, 100, 899, '["Gestão de imóveis","Contratos","Financeiro básico"]'::jsonb),
  ('Profissional', 'price_1T2XxIIcoggni2hD6zjTQFD3', 10, 500, 2799, '["Tudo do Básico","CRM de Leads","Relatórios avançados","Integrações"]'::jsonb),
  ('Enterprise', 'price_1T2XxkIcoggni2hDrLa1Xd7e', NULL, NULL, 3999, '["Tudo do Profissional","Usuários ilimitados","Imóveis ilimitados","Suporte prioritário"]'::jsonb);

-- 2. Create tenant_subscriptions table
CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'ativo',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  auto_renew boolean NOT NULL DEFAULT true,
  renewed_at timestamptz,
  renewal_count integer NOT NULL DEFAULT 0,
  stripe_subscription_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_subs_select" ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "superadmin_subs_insert" ON public.tenant_subscriptions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "superadmin_subs_update" ON public.tenant_subscriptions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role));
CREATE POLICY "superadmin_subs_delete" ON public.tenant_subscriptions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE TRIGGER update_tenant_subscriptions_updated_at BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add plan_id to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id);

-- 4. Superadmin INSERT policy on tenants (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'superadmin_tenants_insert'
  ) THEN
    CREATE POLICY "superadmin_tenants_insert" ON public.tenants FOR INSERT TO authenticated
      WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));
  END IF;
END $$;
