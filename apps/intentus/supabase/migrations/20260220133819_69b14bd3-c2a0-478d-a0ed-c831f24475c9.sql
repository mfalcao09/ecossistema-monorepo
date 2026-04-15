
-- =============================================
-- ENUMS
-- =============================================
DO $$ BEGIN
  CREATE TYPE public.development_type AS ENUM ('loteamento', 'vertical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.development_status AS ENUM ('breve_lancamento', 'lancamento', 'obras', 'entregue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.proposal_status AS ENUM ('rascunho', 'analise_comercial', 'aprovada', 'reprovada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dev_contract_status AS ENUM ('aguardando_assinatura', 'ativo', 'distratado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dev_task_status AS ENUM ('pendente', 'em_andamento', 'concluida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dev_task_priority AS ENUM ('baixa', 'media', 'alta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 1.1 ALTER developments
-- =============================================
ALTER TABLE public.developments
  ADD COLUMN IF NOT EXISTS tipo public.development_type DEFAULT 'loteamento',
  ADD COLUMN IF NOT EXISTS status_empreendimento public.development_status DEFAULT 'lancamento',
  ADD COLUMN IF NOT EXISTS vgv_estimado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_lancamento date,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS address text;

-- =============================================
-- 1.2 development_blocks
-- =============================================
CREATE TABLE IF NOT EXISTS public.development_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  nome text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.development_blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "dev_blocks_select" ON public.development_blocks FOR SELECT USING (tenant_id = auth_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "dev_blocks_insert" ON public.development_blocks FOR INSERT WITH CHECK (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "dev_blocks_update" ON public.development_blocks FOR UPDATE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "dev_blocks_delete" ON public.development_blocks FOR DELETE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- 1.3 ALTER development_units
-- =============================================
ALTER TYPE public.unit_status ADD VALUE IF NOT EXISTS 'reservada';
ALTER TYPE public.unit_status ADD VALUE IF NOT EXISTS 'proposta_em_analise';
ALTER TYPE public.unit_status ADD VALUE IF NOT EXISTS 'bloqueada';

ALTER TABLE public.development_units
  ADD COLUMN IF NOT EXISTS block_id uuid REFERENCES public.development_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_tabela numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS floor text,
  ADD COLUMN IF NOT EXISTS typology text;

-- =============================================
-- 1.4 development_proposals
-- =============================================
CREATE TABLE IF NOT EXISTS public.development_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.development_units(id) ON DELETE RESTRICT,
  client_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  broker_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  valor_total_proposto numeric NOT NULL DEFAULT 0,
  valor_entrada numeric NOT NULL DEFAULT 0,
  qtd_parcelas_mensais integer NOT NULL DEFAULT 1,
  valor_parcela_mensal numeric NOT NULL DEFAULT 0,
  qtd_parcelas_intermediarias integer DEFAULT 0,
  valor_parcela_intermediaria numeric DEFAULT 0,
  valor_financiamento numeric DEFAULT 0,
  observacoes text,
  status public.proposal_status NOT NULL DEFAULT 'rascunho',
  desconto_percentual numeric DEFAULT 0,
  aprovado_por uuid,
  tenant_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.development_proposals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "dev_proposals_select" ON public.development_proposals FOR SELECT USING (tenant_id = auth_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_proposals_insert" ON public.development_proposals FOR INSERT WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_proposals_update" ON public.development_proposals FOR UPDATE USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_proposals_delete" ON public.development_proposals FOR DELETE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_dev_proposals_updated_at ON public.development_proposals;
CREATE TRIGGER update_dev_proposals_updated_at BEFORE UPDATE ON public.development_proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 1.5 development_contracts
-- =============================================
CREATE TABLE IF NOT EXISTS public.development_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL UNIQUE REFERENCES public.development_proposals(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES public.development_units(id) ON DELETE RESTRICT,
  data_assinatura date,
  status public.dev_contract_status NOT NULL DEFAULT 'aguardando_assinatura',
  link_documento text,
  observacoes text,
  tenant_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.development_contracts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "dev_contracts_select" ON public.development_contracts FOR SELECT USING (tenant_id = auth_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_contracts_insert" ON public.development_contracts FOR INSERT WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_contracts_update" ON public.development_contracts FOR UPDATE USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_contracts_delete" ON public.development_contracts FOR DELETE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS update_dev_contracts_updated_at ON public.development_contracts;
CREATE TRIGGER update_dev_contracts_updated_at BEFORE UPDATE ON public.development_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 1.6 development_price_tables
-- =============================================
CREATE TABLE IF NOT EXISTS public.development_price_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  nome text NOT NULL,
  vigencia_inicio date,
  vigencia_fim date,
  indice_correcao text DEFAULT 'INCC',
  taxa_juros_mensal numeric DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.development_price_tables ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "dev_price_select" ON public.development_price_tables FOR SELECT USING (tenant_id = auth_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_price_insert" ON public.development_price_tables FOR INSERT WITH CHECK (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_price_update" ON public.development_price_tables FOR UPDATE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_price_delete" ON public.development_price_tables FOR DELETE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- 1.7 development_tasks
-- =============================================
CREATE TABLE IF NOT EXISTS public.development_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.development_proposals(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.development_units(id) ON DELETE SET NULL,
  assigned_to uuid,
  title text NOT NULL,
  description text,
  due_date date,
  status public.dev_task_status NOT NULL DEFAULT 'pendente',
  priority public.dev_task_priority NOT NULL DEFAULT 'media',
  tenant_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.development_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "dev_tasks_select" ON public.development_tasks FOR SELECT USING (tenant_id = auth_tenant_id()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_tasks_insert" ON public.development_tasks FOR INSERT WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_tasks_update" ON public.development_tasks FOR UPDATE USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dev_tasks_delete" ON public.development_tasks FOR DELETE USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- 1.8 Business Logic Triggers
-- =============================================

CREATE OR REPLACE FUNCTION public.on_proposal_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('cancelada', 'reprovada') THEN
      IF NOT EXISTS (SELECT 1 FROM development_units WHERE id = NEW.unit_id AND status = 'disponivel') THEN
        RAISE EXCEPTION 'Unidade não está disponível para proposta';
      END IF;
      UPDATE development_units SET status = 'proposta_em_analise', updated_at = now() WHERE id = NEW.unit_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'aprovada' THEN
      INSERT INTO development_contracts (proposal_id, unit_id, status, tenant_id, created_by)
      VALUES (NEW.id, NEW.unit_id, 'aguardando_assinatura', NEW.tenant_id, NEW.created_by)
      ON CONFLICT (proposal_id) DO NOTHING;
      UPDATE development_units SET status = 'vendida', updated_at = now() WHERE id = NEW.unit_id;
    END IF;
    IF NEW.status IN ('reprovada', 'cancelada') THEN
      IF NOT EXISTS (
        SELECT 1 FROM development_proposals WHERE unit_id = NEW.unit_id AND id != NEW.id AND status NOT IN ('reprovada', 'cancelada')
      ) THEN
        UPDATE development_units SET status = 'disponivel', updated_at = now() WHERE id = NEW.unit_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposal_status_change_insert ON public.development_proposals;
CREATE TRIGGER trg_proposal_status_change_insert BEFORE INSERT ON public.development_proposals FOR EACH ROW EXECUTE FUNCTION public.on_proposal_status_change();

DROP TRIGGER IF EXISTS trg_proposal_status_change_update ON public.development_proposals;
CREATE TRIGGER trg_proposal_status_change_update BEFORE UPDATE ON public.development_proposals FOR EACH ROW EXECUTE FUNCTION public.on_proposal_status_change();

CREATE OR REPLACE FUNCTION public.validate_proposal_discount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE max_discount numeric;
BEGIN
  IF NEW.desconto_percentual IS NOT NULL AND NEW.desconto_percentual > 0 THEN
    IF has_role(NEW.created_by, 'admin') THEN max_discount := 10;
    ELSIF has_role(NEW.created_by, 'gerente') THEN max_discount := 5;
    ELSE max_discount := 2;
    END IF;
    IF NEW.desconto_percentual > max_discount THEN
      RAISE EXCEPTION 'Desconto excede alçada permitida';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_proposal_discount ON public.development_proposals;
CREATE TRIGGER trg_validate_proposal_discount BEFORE INSERT OR UPDATE ON public.development_proposals FOR EACH ROW EXECUTE FUNCTION public.validate_proposal_discount();
