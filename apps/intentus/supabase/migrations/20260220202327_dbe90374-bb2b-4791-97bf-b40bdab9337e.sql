
-- Function to prevent superadmin role assignment by non-master users
CREATE OR REPLACE FUNCTION public.prevent_superadmin_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  master_uid uuid := '85ba82c5-479d-4405-83ba-69359486780b';
BEGIN
  -- Block INSERT/UPDATE of superadmin role by non-master users
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.role = 'superadmin' AND (auth.uid() IS NULL OR auth.uid() != master_uid) THEN
      RAISE EXCEPTION 'Apenas o administrador master pode atribuir o papel SuperAdmin.';
    END IF;
  END IF;

  -- Block DELETE of superadmin role from the master user
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'superadmin' AND OLD.user_id = master_uid THEN
      RAISE EXCEPTION 'Não é possível remover o papel SuperAdmin do administrador master.';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT OR UPDATE
CREATE TRIGGER trg_prevent_superadmin_insert_update
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_superadmin_assignment();

-- Trigger BEFORE DELETE
CREATE TRIGGER trg_prevent_superadmin_delete
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_superadmin_assignment();
