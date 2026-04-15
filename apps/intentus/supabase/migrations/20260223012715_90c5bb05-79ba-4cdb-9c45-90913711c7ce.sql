
-- Create addon_products table
CREATE TABLE public.addon_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Package',
  enabled boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'geral',
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.addon_products ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read enabled products
CREATE POLICY "Authenticated users can read enabled addon products"
  ON public.addon_products FOR SELECT
  USING (auth.uid() IS NOT NULL AND enabled = true);

-- Master tenant (superadmin) can do everything
CREATE POLICY "Master tenant full access to addon products"
  ON public.addon_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'superadmin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_addon_products_updated_at
  BEFORE UPDATE ON public.addon_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed WhatsApp product
INSERT INTO public.addon_products (name, slug, description, icon, enabled, sort_order, category)
VALUES (
  'Atendimento WhatsApp',
  'atendimento_whatsapp',
  'Plataforma completa de atendimento via WhatsApp com chatbot, filas, campanhas e integrações.',
  'MessageCircle',
  COALESCE(
    (SELECT (settings->>'whatsapp_product_enabled')::boolean
     FROM public.tenants
     WHERE id = '00000000-0000-0000-0000-000000000001'),
    true
  ),
  1,
  'comunicacao'
);
