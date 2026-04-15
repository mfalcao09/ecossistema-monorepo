
-- Enable RLS but allow public read access (economic data is public)
ALTER TABLE public.economic_indices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read economic indices"
  ON public.economic_indices FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage economic indices"
  ON public.economic_indices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
