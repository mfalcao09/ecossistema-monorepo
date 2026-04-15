
-- Labels master table
CREATE TABLE public.labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#4ade80',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "labels_select" ON public.labels FOR SELECT USING (true);
CREATE POLICY "labels_insert" ON public.labels FOR INSERT WITH CHECK (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)
);
CREATE POLICY "labels_update" ON public.labels FOR UPDATE USING (
  is_admin_or_gerente(auth.uid()) OR created_by = auth.uid()
);
CREATE POLICY "labels_delete" ON public.labels FOR DELETE USING (
  is_admin_or_gerente(auth.uid())
);

-- Junction table: deal_request <-> labels
CREATE TABLE public.deal_request_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_request_id UUID NOT NULL REFERENCES public.deal_requests(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(deal_request_id, label_id)
);

ALTER TABLE public.deal_request_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drl_select" ON public.deal_request_labels FOR SELECT USING (true);
CREATE POLICY "drl_insert" ON public.deal_request_labels FOR INSERT WITH CHECK (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)
);
CREATE POLICY "drl_delete" ON public.deal_request_labels FOR DELETE USING (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)
);

-- Seed default labels
INSERT INTO public.labels (name, color, created_by) VALUES
  ('', '#4ade80', '00000000-0000-0000-0000-000000000000'),
  ('', '#facc15', '00000000-0000-0000-0000-000000000000'),
  ('', '#fb923c', '00000000-0000-0000-0000-000000000000'),
  ('', '#f87171', '00000000-0000-0000-0000-000000000000'),
  ('', '#c084fc', '00000000-0000-0000-0000-000000000000'),
  ('', '#60a5fa', '00000000-0000-0000-0000-000000000000');
