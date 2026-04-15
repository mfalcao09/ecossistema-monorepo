
-- Allow superadmin to change their own tenant_id for impersonation
CREATE OR REPLACE FUNCTION public.prevent_tenant_id_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.tenant_id IS NOT NULL 
     AND OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    -- Allow superadmins to change their own tenant_id (for impersonation)
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = OLD.user_id AND role = 'superadmin'
    ) AND auth.uid() = OLD.user_id THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Não é permitido alterar o tenant_id';
  END IF;
  RETURN NEW;
END;
$function$;
