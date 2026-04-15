
-- 1) Allow anonymous users to INSERT leads from the public showcase (source='site')
CREATE POLICY "leads_insert_anon_site"
ON public.leads
FOR INSERT
TO anon
WITH CHECK (source = 'site'::lead_source);

-- 2) Notification trigger: new lead
CREATE OR REPLACE FUNCTION public.notify_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, category, reference_type, reference_id)
  SELECT ur.user_id,
         'Novo Lead: ' || NEW.name,
         'Lead captado via ' || NEW.source || '. Telefone: ' || COALESCE(NEW.phone, 'N/A'),
         'leads',
         'lead',
         NEW.id::text
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'gerente', 'corretor');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_lead
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_lead();

-- 3) Notification trigger: overdue installment
CREATE OR REPLACE FUNCTION public.notify_overdue_installment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'vencida' AND (OLD.status IS DISTINCT FROM 'vencida') THEN
    INSERT INTO public.notifications (user_id, title, message, category, reference_type, reference_id)
    SELECT ur.user_id,
           'Parcela Vencida #' || NEW.installment_number,
           'Parcela de R$ ' || NEW.amount || ' venceu em ' || NEW.due_date,
           'financeiro',
           'installment',
           NEW.id::text
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'gerente', 'financeiro');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_overdue_installment
  AFTER UPDATE ON public.contract_installments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_overdue_installment();

-- 4) Contract activation: auto-create inspection + intermediation fee + notify
CREATE OR REPLACE FUNCTION public.on_contract_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ativo' AND (OLD.status IS DISTINCT FROM 'ativo') THEN
    IF NEW.contract_type = 'locacao' THEN
      INSERT INTO public.inspections (property_id, contract_id, inspection_type, status, scheduled_date, created_by, inspector_notes)
      SELECT NEW.property_id, NEW.id, 'entrada', 'agendada', NEW.start_date, NEW.created_by,
             'Vistoria de entrada gerada automaticamente ao ativar contrato.'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.inspections WHERE contract_id = NEW.id AND inspection_type = 'entrada'
      );
    END IF;

    IF NEW.contract_type = 'locacao' AND NEW.monthly_value IS NOT NULL AND NEW.start_date IS NOT NULL AND NEW.intermediation_fee_generated = false THEN
      INSERT INTO public.contract_installments (contract_id, installment_number, amount, due_date, status, created_by, revenue_type, notes)
      VALUES (NEW.id, 0, NEW.monthly_value, NEW.start_date, 'pendente', NEW.created_by, 'intermediacao', 'Taxa de intermediação (1º aluguel) - gerada automaticamente');
      UPDATE public.contracts SET intermediation_fee_generated = true WHERE id = NEW.id;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, category, reference_type, reference_id)
    SELECT ur.user_id, 'Contrato Ativado',
           'Um contrato de ' || NEW.contract_type || ' foi ativado.',
           'contratos', 'contract', NEW.id::text
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'gerente', 'financeiro');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_contract_activated
  AFTER UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.on_contract_activated();
