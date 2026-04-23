-- ============================================================
-- ATENDIMENTO S6 — Cargos + Permissões Granulares + Equipes + Convites
-- ============================================================
-- Criado: 2026-04-21
-- Sprint: S6 (Atendimento)
-- Dependências: 20260412_atendimento_modulo_init.sql (atendimento_agents)
--
-- Objetivo:
--   Adicionar controle granular de permissão ao módulo Atendimento (paridade
--   Nexvy). 13 módulos × 5 ações × 3 presets de cargo. Base para Fase 2 SaaS.
--
-- Tabelas novas:
--   - agent_roles              (cargos: Admin, Atendente, Atendente restrito, + custom)
--   - role_permissions         (matrix cargo × módulo × ação)
--   - teams                    (equipes: Secretaria, Financeiro, Comercial...)
--   - team_members             (N..N agents ↔ teams)
--   - agent_invites            (tokens de convite para novos usuários)
--
-- Alteração em atendimento_agents:
--   - Adiciona role_id UUID NULLABLE (coexiste com campo legado `role` TEXT
--     da migration S1 — será deprecado em Fase 2)
--
-- Convenção multi-tenant: account_id NULL = tenant default (FIC).
-- Quando virar SaaS (Fase 2), cada account terá suas próprias linhas.
-- ============================================================

BEGIN;

-- ============================================================
-- TABELA: agent_roles
-- Cargos do módulo Atendimento (3 presets system + custom)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID,                                          -- NULL = tenant default (FIC)
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT false,                -- presets não deletáveis
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_roles_account_name
  ON public.agent_roles (COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

CREATE INDEX IF NOT EXISTS idx_agent_roles_account
  ON public.agent_roles (account_id);

COMMENT ON TABLE  public.agent_roles                IS 'Cargos do módulo Atendimento (3 presets system + custom por account)';
COMMENT ON COLUMN public.agent_roles.is_system      IS 'true = preset (Administrador/Atendente/Atendente restrito) — não pode ser deletado';
COMMENT ON COLUMN public.agent_roles.account_id     IS 'NULL = tenant default (FIC). Fase 2 SaaS preenche por conta.';


-- ============================================================
-- TABELA: role_permissions
-- Matrix cargo × módulo × ação (PK composta)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id   UUID NOT NULL REFERENCES public.agent_roles(id) ON DELETE CASCADE,
  module    VARCHAR(50) NOT NULL,
  action    VARCHAR(20) NOT NULL CHECK (action IN ('view', 'create', 'edit', 'delete', 'export')),
  granted   BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (role_id, module, action)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role
  ON public.role_permissions (role_id);

COMMENT ON TABLE  public.role_permissions         IS 'Matrix de permissões por cargo × módulo × ação (13 módulos × 5 ações)';
COMMENT ON COLUMN public.role_permissions.module  IS 'Slug do módulo: dashboard, conversations, contacts, pipelines, schedules, templates, automations, webhooks, inboxes, users, roles, ds_voice, ds_ai, reports, settings';


-- ============================================================
-- TABELA: teams
-- Equipes (Secretaria, Financeiro, Comercial...)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID,
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  color_hex    VARCHAR(7),                                     -- #RRGGBB
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_account_name
  ON public.teams (COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

CREATE INDEX IF NOT EXISTS idx_teams_account
  ON public.teams (account_id);

COMMENT ON TABLE public.teams IS 'Equipes do módulo Atendimento (filtro Kanban, relatórios por equipe)';


-- ============================================================
-- TABELA: team_members
-- N..N agents ↔ teams
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_members (
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  agent_id   UUID NOT NULL REFERENCES public.atendimento_agents(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_agent
  ON public.team_members (agent_id);

COMMENT ON TABLE public.team_members IS 'Relação N..N entre agents e teams';


-- ============================================================
-- TABELA: agent_invites
-- Convites por email + token (magic link / Resend)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID,
  email         VARCHAR(200) NOT NULL,
  role_id       UUID NOT NULL REFERENCES public.agent_roles(id) ON DELETE RESTRICT,
  team_id       UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  invited_by    UUID,                                           -- auth.users.id de quem convidou
  token         VARCHAR(64) NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  accepted_by   UUID,                                           -- auth.users.id aceitante
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_invites_email        ON public.agent_invites (email);
CREATE INDEX IF NOT EXISTS idx_agent_invites_token_active ON public.agent_invites (token) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_invites_expires_at   ON public.agent_invites (expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE  public.agent_invites             IS 'Convites por email com token e TTL (magic link)';
COMMENT ON COLUMN public.agent_invites.token       IS 'Token opaco 64 chars (crypto.randomUUID + randomBytes) — usar em /api/atendimento/invites/accept?token=';


-- ============================================================
-- ALTER: atendimento_agents.role_id
-- Coexiste com `role` TEXT legada (S1) — será deprecada em Fase 2
-- ============================================================
ALTER TABLE public.atendimento_agents
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.agent_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atendimento_agents_role_id
  ON public.atendimento_agents (role_id);

COMMENT ON COLUMN public.atendimento_agents.role_id IS 'FK para agent_roles (cargo granular S6). Coexiste com `role` TEXT legado até Fase 2.';


-- ============================================================
-- SEED: 3 presets de cargo (is_system=true, não deletáveis)
-- account_id NULL = tenant default (FIC)
-- ============================================================
INSERT INTO public.agent_roles (id, account_id, name, description, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'Administrador',       'Acesso total ao módulo Atendimento',                              true),
  ('00000000-0000-0000-0000-000000000002', NULL, 'Atendente',           'Atendimento padrão: vê conversas das suas filas, edita deals',   true),
  ('00000000-0000-0000-0000-000000000003', NULL, 'Atendente restrito',  'Apenas suas próprias conversas, sem acesso a CRM',               true)
ON CONFLICT DO NOTHING;


-- ============================================================
-- Trigger: atualizar updated_at em agent_roles / teams
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_s6_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_roles_updated_at ON public.agent_roles;
CREATE TRIGGER trg_agent_roles_updated_at
  BEFORE UPDATE ON public.agent_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_s6_set_updated_at();

DROP TRIGGER IF EXISTS trg_teams_updated_at ON public.teams;
CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.trg_s6_set_updated_at();


-- ============================================================
-- RLS — habilita nas tabelas novas
-- Políticas permissivas iniciais (FIC single-tenant).
-- Fase 2 SaaS: apertar para filtrar por account_id via JWT.
-- ============================================================
ALTER TABLE public.agent_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_invites     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_agent_roles_authenticated_all ON public.agent_roles;
CREATE POLICY p_agent_roles_authenticated_all ON public.agent_roles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_role_permissions_authenticated_all ON public.role_permissions;
CREATE POLICY p_role_permissions_authenticated_all ON public.role_permissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_teams_authenticated_all ON public.teams;
CREATE POLICY p_teams_authenticated_all ON public.teams
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_team_members_authenticated_all ON public.team_members;
CREATE POLICY p_team_members_authenticated_all ON public.team_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_agent_invites_authenticated_all ON public.agent_invites;
CREATE POLICY p_agent_invites_authenticated_all ON public.agent_invites
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- NOTA: a matrix de permissões (195 linhas: 3 cargos × 13 módulos × 5 ações)
-- é aplicada via script Python `scripts/seed_atendimento_permissions.py` —
-- mais legível e manutenível do que SQL gigante.
-- Rode após esta migration:
--   $ python scripts/seed_atendimento_permissions.py
-- ============================================================

COMMIT;
