
CREATE TABLE public.user_table_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_key text NOT NULL,
  visible_columns text[] NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, page_key, tenant_id)
);

ALTER TABLE public.user_table_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
ON public.user_table_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
ON public.user_table_preferences FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND tenant_id = public.auth_tenant_id());

CREATE POLICY "Users can update own preferences"
ON public.user_table_preferences FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own preferences"
ON public.user_table_preferences FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_user_table_preferences_updated_at
BEFORE UPDATE ON public.user_table_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
