
-- =============================================
-- Ferramentas Administrativas: Tabelas 1-8
-- =============================================

-- 1. Activity Logs (Auditoria) - imutável
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text,
  entity_name text,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activity logs"
  ON public.activity_logs FOR SELECT
  USING (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()));

CREATE POLICY "Authenticated can insert activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE INDEX idx_activity_logs_tenant_created ON public.activity_logs (tenant_id, created_at DESC);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs (tenant_id, entity_type);

-- 2. Data Imports
CREATE TABLE public.data_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  entity_type text NOT NULL,
  file_name text NOT NULL,
  total_rows int NOT NULL DEFAULT 0,
  success_rows int NOT NULL DEFAULT 0,
  error_rows int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  errors_json jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage data imports"
  ON public.data_imports FOR ALL
  USING (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()))
  WITH CHECK (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()));

-- 4. Teams
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  description text,
  manager_user_id uuid,
  color text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view teams"
  ON public.teams FOR SELECT
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Admins can manage teams"
  ON public.teams FOR ALL
  USING (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()))
  WITH CHECK (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Team Members
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_members_unique UNIQUE (team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view team members"
  ON public.team_members FOR SELECT
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Admins can manage team members"
  ON public.team_members FOR ALL
  USING (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()))
  WITH CHECK (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()));

-- 6. Notification Preferences
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  role text,
  category text NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  frequency text NOT NULL DEFAULT 'immediate',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_prefs_unique UNIQUE (tenant_id, role, category)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notification preferences"
  ON public.notification_preferences FOR ALL
  USING (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()))
  WITH CHECK (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 8. Internal Policies
CREATE TABLE public.internal_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 1,
  requires_acceptance boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view published policies"
  ON public.internal_policies FOR SELECT
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Admins can manage policies"
  ON public.internal_policies FOR ALL
  USING (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()))
  WITH CHECK (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_internal_policies_updated_at
  BEFORE UPDATE ON public.internal_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Policy Acceptances
CREATE TABLE public.policy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.internal_policies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  CONSTRAINT policy_acceptances_unique UNIQUE (policy_id, user_id)
);

ALTER TABLE public.policy_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own acceptances"
  ON public.policy_acceptances FOR SELECT
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Users can insert own acceptance"
  ON public.policy_acceptances FOR INSERT
  WITH CHECK (tenant_id = public.auth_tenant_id() AND user_id = auth.uid());

CREATE POLICY "Admins can view all acceptances"
  ON public.policy_acceptances FOR SELECT
  USING (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()));
