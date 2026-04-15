
-- 1) Add assigned_to column to deal_requests
ALTER TABLE public.deal_requests
  ADD COLUMN assigned_to uuid DEFAULT NULL;

-- 2) Create deal_request_checklists table
CREATE TABLE public.deal_request_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_request_id uuid NOT NULL REFERENCES public.deal_requests(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_by uuid DEFAULT NULL,
  completed_at timestamptz DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_request_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklists_select" ON public.deal_request_checklists
  FOR SELECT USING (true);

CREATE POLICY "checklists_insert" ON public.deal_request_checklists
  FOR INSERT WITH CHECK (
    is_admin_or_gerente(auth.uid())
    OR has_role(auth.uid(), 'corretor'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'juridico'::app_role)
  );

CREATE POLICY "checklists_update" ON public.deal_request_checklists
  FOR UPDATE USING (
    is_admin_or_gerente(auth.uid())
    OR has_role(auth.uid(), 'corretor'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'juridico'::app_role)
  );

CREATE POLICY "checklists_delete" ON public.deal_request_checklists
  FOR DELETE USING (is_admin_or_gerente(auth.uid()));

-- 3) Create deal_request_reminders table
CREATE TABLE public.deal_request_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_request_id uuid NOT NULL REFERENCES public.deal_requests(id) ON DELETE CASCADE,
  remind_at timestamptz NOT NULL,
  message text NOT NULL DEFAULT '',
  notified boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_request_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_select" ON public.deal_request_reminders
  FOR SELECT USING (true);

CREATE POLICY "reminders_insert" ON public.deal_request_reminders
  FOR INSERT WITH CHECK (
    is_admin_or_gerente(auth.uid())
    OR has_role(auth.uid(), 'corretor'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'juridico'::app_role)
  );

CREATE POLICY "reminders_update" ON public.deal_request_reminders
  FOR UPDATE USING (
    is_admin_or_gerente(auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "reminders_delete" ON public.deal_request_reminders
  FOR DELETE USING (
    is_admin_or_gerente(auth.uid())
    OR created_by = auth.uid()
  );

-- 4) Update RLS on deal_requests: analysts only see their own or assigned
DROP POLICY "deal_requests_select" ON public.deal_requests;

CREATE POLICY "deal_requests_select" ON public.deal_requests
  FOR SELECT USING (
    is_admin_or_gerente(auth.uid())
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
  );
