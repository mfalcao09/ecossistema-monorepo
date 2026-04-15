---
name: Modelo canônico de RLS no ERP
description: Toda tabela nova do ERP deve nascer com RLS ON + policy authenticated com auth.uid() IS NOT NULL (nunca USING true)
type: feedback
---

Toda tabela nova criada em migrations do ERP-Educacional deve nascer com:

```sql
ALTER TABLE public.nova_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY authenticated_full_access_nova_tabela
  ON public.nova_tabela
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
```

**Why:** Sessão 028 descobriu que tabelas legadas (`processo_arquivos`, `extracao_sessoes`, `diploma_documentos_comprobatorios`) foram criadas sem RLS ou com policies `USING (true)`, aparecendo em `get_advisors` como ERROR/WARN. Marcelo pediu para fechar e estabelecer padrão. O modelo é single-tenant FIC: API routes server-side usam ou `createClient()` (cookies authenticated) ou `createAdminClient()` (service_role que bypassa RLS). Nenhum código client-side acessa tabelas diretamente.

**How to apply:**
- Nunca usar `USING (true)` — o linter do Supabase marca como risco e ele está certo (não diferencia de "sem policy").
- Nunca deixar uma tabela `public` com RLS desabilitado — mesmo que a API use só service_role hoje, alguém pode vazar anon key amanhã.
- Funções trigger (ex: `update_*_updated_at`) devem sempre ter `SET search_path = public, pg_temp` para evitar warning `function_search_path_mutable`.
- Depois de qualquer migration que cria/altera tabela, rodar `get_advisors` security + filtrar pelas tabelas tocadas antes de considerar a sprint fechada.
