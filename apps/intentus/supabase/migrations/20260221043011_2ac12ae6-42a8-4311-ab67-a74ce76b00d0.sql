
-- Correção 1: Bloquear SELECT direto em bank_api_credentials e platform_bank_credentials
DROP POLICY IF EXISTS "bank_creds_select" ON public.bank_api_credentials;
CREATE POLICY "bank_creds_select" ON public.bank_api_credentials
  FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS "platform_bank_creds_select" ON public.platform_bank_credentials;
CREATE POLICY "platform_bank_creds_select" ON public.platform_bank_credentials
  FOR SELECT TO authenticated USING (false);

-- Correção 3/9: Trigger para impedir alteração de tenant_id em profiles
CREATE OR REPLACE FUNCTION public.prevent_tenant_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.tenant_id IS NOT NULL 
     AND OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Não é permitido alterar o tenant_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_profiles_tenant_id ON public.profiles;
CREATE TRIGGER protect_profiles_tenant_id
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tenant_id_change();

-- Correção 4/5: Restringir storage policies para property-images
-- Remover policy permissiva existente
DROP POLICY IF EXISTS "Anyone can view property images" ON storage.objects;

-- Authenticated users podem ver todas imagens
CREATE POLICY "Authenticated view property images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'property-images');

-- Anon pode ver imagens (necessário para sites públicos - bucket é público)
CREATE POLICY "Anon view property images"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'property-images');
