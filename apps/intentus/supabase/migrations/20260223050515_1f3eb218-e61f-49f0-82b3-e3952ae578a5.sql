-- Allow anonymous users to read the platform identity settings (needed for login page logo)
CREATE POLICY "Anyone can read platform identity"
ON public.platform_settings
FOR SELECT
USING (key = 'identity');
