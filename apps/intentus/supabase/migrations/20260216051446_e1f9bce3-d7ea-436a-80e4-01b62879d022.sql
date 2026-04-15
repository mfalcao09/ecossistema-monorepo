
-- Table for inter-department comments/messages on deal requests
CREATE TABLE public.deal_request_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_request_id UUID NOT NULL REFERENCES public.deal_requests(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  message TEXT NOT NULL,
  target_department TEXT, -- e.g. 'comercial', 'juridico', 'financeiro' — nullable means general comment
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_request_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drcomments_select" ON public.deal_request_comments
  FOR SELECT USING (true);

CREATE POLICY "drcomments_insert" ON public.deal_request_comments
  FOR INSERT WITH CHECK (
    is_admin_or_gerente(auth.uid())
    OR has_role(auth.uid(), 'corretor'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'juridico'::app_role)
  );

CREATE POLICY "drcomments_delete" ON public.deal_request_comments
  FOR DELETE USING (is_admin_or_gerente(auth.uid()));
