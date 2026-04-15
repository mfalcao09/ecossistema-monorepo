
-- 1. Create tenant_addon_subscriptions table
CREATE TABLE public.tenant_addon_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  addon_product_id uuid REFERENCES public.addon_products(id),
  module_key text NOT NULL,
  name text NOT NULL,
  price_monthly numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ativo',
  started_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, module_key)
);

ALTER TABLE public.tenant_addon_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for addon subscriptions"
  ON public.tenant_addon_subscriptions FOR SELECT
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Superadmin full access addon subscriptions"
  ON public.tenant_addon_subscriptions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin'));

CREATE TRIGGER update_tenant_addon_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_addon_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Create tenant_extra_resources table
CREATE TABLE public.tenant_extra_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  resource_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  price_per_unit numeric NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, resource_type)
);

ALTER TABLE public.tenant_extra_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for extra resources"
  ON public.tenant_extra_resources FOR SELECT
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Superadmin full access extra resources"
  ON public.tenant_extra_resources FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin'));

CREATE TRIGGER update_tenant_extra_resources_updated_at
  BEFORE UPDATE ON public.tenant_extra_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Add price_monthly and min_plan columns to addon_products
ALTER TABLE public.addon_products
  ADD COLUMN IF NOT EXISTS price_monthly numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_plan text NOT NULL DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS module_key text;
