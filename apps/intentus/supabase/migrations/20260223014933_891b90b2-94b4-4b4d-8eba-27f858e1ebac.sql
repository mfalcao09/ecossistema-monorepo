
-- =============================================
-- Ferramenta 0: Permissões de Telas por Usuário
-- =============================================

CREATE TABLE public.user_page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  page_path text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_page_permissions_unique UNIQUE (tenant_id, user_id, page_path)
);

ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;

-- Admins/gerentes can read all permissions in their tenant
CREATE POLICY "Admins can view page permissions"
  ON public.user_page_permissions
  FOR SELECT
  USING (
    tenant_id = public.auth_tenant_id()
    AND public.is_admin_or_gerente(auth.uid())
  );

-- Users can read their own permissions
CREATE POLICY "Users can view own page permissions"
  ON public.user_page_permissions
  FOR SELECT
  USING (
    tenant_id = public.auth_tenant_id()
    AND user_id = auth.uid()
  );

-- Only admins/gerentes can insert
CREATE POLICY "Admins can insert page permissions"
  ON public.user_page_permissions
  FOR INSERT
  WITH CHECK (
    tenant_id = public.auth_tenant_id()
    AND public.is_admin_or_gerente(auth.uid())
  );

-- Only admins/gerentes can update
CREATE POLICY "Admins can update page permissions"
  ON public.user_page_permissions
  FOR UPDATE
  USING (
    tenant_id = public.auth_tenant_id()
    AND public.is_admin_or_gerente(auth.uid())
  );

-- Only admins/gerentes can delete
CREATE POLICY "Admins can delete page permissions"
  ON public.user_page_permissions
  FOR DELETE
  USING (
    tenant_id = public.auth_tenant_id()
    AND public.is_admin_or_gerente(auth.uid())
  );

-- Auto-update updated_at
CREATE TRIGGER update_user_page_permissions_updated_at
  BEFORE UPDATE ON public.user_page_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
