
-- =============================================
-- Tabela: chat_plans (Planos do produto WhatsApp)
-- =============================================
CREATE TABLE public.chat_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  stripe_price_id TEXT,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  max_users INT NOT NULL DEFAULT 3,
  max_connections INT NOT NULL DEFAULT 1,
  features JSONB DEFAULT '[]'::jsonb,
  modules JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_plans ENABLE ROW LEVEL SECURITY;

-- Somente superadmins gerenciam planos WhatsApp
CREATE POLICY "Superadmins manage chat_plans"
  ON public.chat_plans FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Qualquer autenticado pode visualizar planos ativos (para tela de contratação)
CREATE POLICY "Authenticated users can view active chat_plans"
  ON public.chat_plans FOR SELECT
  USING (active = true AND auth.uid() IS NOT NULL);

-- Trigger updated_at
CREATE TRIGGER update_chat_plans_updated_at
  BEFORE UPDATE ON public.chat_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- Tabela: chat_subscriptions (Assinatura WhatsApp por tenant)
-- =============================================
CREATE TABLE public.chat_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chat_plan_id UUID NOT NULL REFERENCES public.chat_plans(id),
  status TEXT NOT NULL DEFAULT 'trial',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  blocked_at TIMESTAMPTZ,
  blocked_reason TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_subscriptions ENABLE ROW LEVEL SECURITY;

-- Superadmins gerenciam tudo
CREATE POLICY "Superadmins manage chat_subscriptions"
  ON public.chat_subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Tenants visualizam apenas a própria assinatura
CREATE POLICY "Tenants view own chat_subscription"
  ON public.chat_subscriptions FOR SELECT
  USING (tenant_id = public.auth_tenant_id());

-- Trigger updated_at
CREATE TRIGGER update_chat_subscriptions_updated_at
  BEFORE UPDATE ON public.chat_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Índice para busca rápida por tenant
CREATE INDEX idx_chat_subscriptions_tenant ON public.chat_subscriptions(tenant_id);
