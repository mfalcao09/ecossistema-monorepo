---
name: Modelo canônico de RLS no ERP: auth.uid() IS NOT NULL
description: Modelo canônico de RLS no ERP: auth.uid() IS NOT NULL
type: feedback
project: erp
tags: ["rls", "supabase", "seguranca", "migration"]
success_score: 0.95
supabase_id: 220a65b9-86dc-4bd5-bb96-719ae49b1591
created_at: 2026-04-13 09:16:28.130214+00
updated_at: 2026-04-13 13:05:15.849502+00
---

Toda tabela nova criada em migrations do ERP-Educacional deve nascer com: ALTER TABLE public.nova_tabela ENABLE ROW LEVEL SECURITY; CREATE POLICY authenticated_full_access_nova_tabela ON public.nova_tabela AS PERMISSIVE FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL). NUNCA usar USING (true) — o linter do Supabase marca como risco. NUNCA deixar tabela public com RLS desabilitado. Funções trigger devem ter SET search_path = public, pg_temp. Após qualquer migration, rodar get_advisors security.
