
-- Trigger: notify when a support ticket is created
CREATE OR REPLACE FUNCTION public.notify_new_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, category, reference_type, reference_id, tenant_id)
  SELECT ur.user_id,
         'Novo Ticket: ' || NEW.subject,
         'Categoria: ' || NEW.category || ' | Prioridade: ' || NEW.priority,
         'atendimento', 'ticket', NEW.id::text, NEW.tenant_id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'gerente') AND ur.tenant_id = NEW.tenant_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_ticket
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_ticket();

-- Trigger: notify when maintenance status changes
CREATE OR REPLACE FUNCTION public.notify_maintenance_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, category, reference_type, reference_id, tenant_id)
    SELECT ur.user_id,
           'Manutenção Atualizada: ' || NEW.title,
           'Status alterado para: ' || NEW.status,
           'manutencao', 'maintenance', NEW.id::text, NEW.tenant_id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'gerente', 'manutencao') AND ur.tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_maintenance_status
  AFTER UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_maintenance_status_change();
