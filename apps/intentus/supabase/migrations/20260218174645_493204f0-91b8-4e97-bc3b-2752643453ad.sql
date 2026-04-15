
-- Table to store IRRF brackets (updated yearly)
CREATE TABLE public.ir_brackets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_year integer NOT NULL,
  min_value numeric NOT NULL DEFAULT 0,
  max_value numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  deduction numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ir_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ir_brackets_select" ON public.ir_brackets FOR SELECT USING (true);
CREATE POLICY "ir_brackets_insert" ON public.ir_brackets FOR INSERT WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "ir_brackets_update" ON public.ir_brackets FOR UPDATE USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "ir_brackets_delete" ON public.ir_brackets FOR DELETE USING (is_admin_or_gerente(auth.uid()));

CREATE UNIQUE INDEX idx_ir_brackets_year_order ON public.ir_brackets (reference_year, sort_order);

-- Seed current 2025/2026 brackets
INSERT INTO public.ir_brackets (reference_year, min_value, max_value, rate, deduction, sort_order) VALUES
  (2025, 0, 2259.20, 0, 0, 1),
  (2025, 2259.21, 2826.65, 7.5, 169.44, 2),
  (2025, 2826.66, 3751.05, 15, 381.44, 3),
  (2025, 3751.06, 4664.68, 22.5, 662.77, 4),
  (2025, 4664.69, 999999999, 27.5, 896.00, 5);
