
-- Platform-wide identity settings (managed by superadmin)
CREATE TABLE public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only superadmins can read/write
CREATE POLICY "Superadmins can manage platform settings"
  ON public.platform_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'superadmin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'superadmin'));

-- All authenticated users can read (for logo display)
CREATE POLICY "Authenticated users can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Seed identity defaults
INSERT INTO public.platform_settings (key, value) VALUES (
  'identity',
  '{"logo_url": null, "favicon_url": null, "platform_name": "Gestão Imobiliária", "primary_color": "222 47% 16%", "accent_color": "38 92% 50%", "sidebar_color": "222 47% 13%"}'::jsonb
);

-- Trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
