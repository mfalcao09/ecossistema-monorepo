
-- 1) Make leads.created_by nullable so anonymous showcase leads work without fake UUID
ALTER TABLE public.leads ALTER COLUMN created_by DROP NOT NULL;

-- 2) Restrict notifications INSERT to authenticated users only (triggers use SECURITY DEFINER and bypass RLS)
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "notifications_insert_auth"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3) Fix overdue installment trigger: enum has 'atrasado', not 'vencida'
CREATE OR REPLACE FUNCTION public.notify_overdue_installment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'atrasado' AND (OLD.status IS DISTINCT FROM 'atrasado') THEN
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

-- 4) Create a function to batch-mark overdue installments (called by cron/edge function)
CREATE OR REPLACE FUNCTION public.mark_overdue_installments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.contract_installments
  SET status = 'atrasado', updated_at = now()
  WHERE status = 'pendente'
    AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
