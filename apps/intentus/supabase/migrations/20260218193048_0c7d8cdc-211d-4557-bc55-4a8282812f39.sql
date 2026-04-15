
-- 1. Add entity_type (PJ/PF) to people table for IR automation
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'pf';
COMMENT ON COLUMN public.people.entity_type IS 'pf = Pessoa Física, pj = Pessoa Jurídica';

-- 2. Create notifications table for system alerts
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'sistema',
  reference_type text,
  reference_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Add bank reconciliation fields to contract_installments
ALTER TABLE public.contract_installments 
  ADD COLUMN IF NOT EXISTS bank_reconciled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS bank_reconciled_by uuid;
