
-- ============================================
-- FASE 1: SCHEMA COMPLETO - GESTÃO IMOBILIÁRIA
-- ============================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'gerente', 'corretor', 'financeiro', 'juridico', 'manutencao');
CREATE TYPE public.property_type AS ENUM ('casa', 'apartamento', 'terreno', 'lote', 'comercial', 'rural', 'industrial');
CREATE TYPE public.property_purpose AS ENUM ('venda', 'locacao', 'ambos');
CREATE TYPE public.property_status AS ENUM ('disponivel', 'reservado', 'vendido', 'alugado', 'indisponivel');
CREATE TYPE public.contract_type AS ENUM ('venda', 'locacao', 'administracao');
CREATE TYPE public.contract_status AS ENUM ('rascunho', 'ativo', 'encerrado', 'cancelado', 'renovado');
CREATE TYPE public.installment_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TYPE public.person_type AS ENUM ('cliente', 'proprietario', 'fiador', 'locatario', 'comprador', 'lead');
CREATE TYPE public.contract_party_role AS ENUM ('locatario', 'comprador', 'proprietario', 'fiador', 'administrador', 'testemunha');
CREATE TYPE public.maintenance_status AS ENUM ('aberto', 'em_andamento', 'concluido', 'cancelado');
CREATE TYPE public.maintenance_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');
CREATE TYPE public.interaction_type AS ENUM ('telefone', 'email', 'whatsapp', 'visita', 'reuniao', 'outro');
CREATE TYPE public.interest_level AS ENUM ('baixo', 'medio', 'alto', 'muito_alto');
CREATE TYPE public.unit_status AS ENUM ('disponivel', 'reservado', 'vendido');

-- 2. PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. USER ROLES TABLE
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. HELPER FUNCTIONS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_gerente(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'gerente')
  )
$$;

-- 5. PROPERTIES TABLE
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  property_type property_type NOT NULL,
  purpose property_purpose NOT NULL DEFAULT 'venda',
  status property_status NOT NULL DEFAULT 'disponivel',
  description TEXT,
  -- Address
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  -- Details
  area_total NUMERIC,
  area_built NUMERIC,
  rooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  parking_spots INTEGER DEFAULT 0,
  -- Financial
  sale_price NUMERIC,
  rental_price NUMERIC,
  condominium_fee NUMERIC,
  iptu NUMERIC,
  -- Relations
  development_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- 6. PROPERTY MEDIA
CREATE TABLE public.property_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  display_order INTEGER DEFAULT 0,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;

-- 7. PROPERTY FEATURES
CREATE TABLE public.property_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  feature_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.property_features ENABLE ROW LEVEL SECURITY;

-- 8. DEVELOPMENTS (EMPREENDIMENTOS)
CREATE TABLE public.developments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  city TEXT,
  state TEXT,
  neighborhood TEXT,
  total_units INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.developments ENABLE ROW LEVEL SECURITY;

-- Add FK to properties
ALTER TABLE public.properties
  ADD CONSTRAINT fk_properties_development
  FOREIGN KEY (development_id) REFERENCES public.developments(id) ON DELETE SET NULL;

-- 9. DEVELOPMENT UNITS
CREATE TABLE public.development_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id UUID REFERENCES public.developments(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_identifier TEXT NOT NULL,
  area NUMERIC,
  price NUMERIC,
  status unit_status NOT NULL DEFAULT 'disponivel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.development_units ENABLE ROW LEVEL SECURITY;

-- 10. PEOPLE (PESSOAS)
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  person_type person_type NOT NULL DEFAULT 'lead',
  cpf_cnpj TEXT,
  rg TEXT,
  email TEXT,
  phone TEXT,
  phone2 TEXT,
  -- Address
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  -- Extra
  date_of_birth DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- 11. PERSON INTERESTS
CREATE TABLE public.person_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES public.people(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  interest_level interest_level NOT NULL DEFAULT 'medio',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.person_interests ENABLE ROW LEVEL SECURITY;

-- 12. CONTRACTS
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) NOT NULL,
  contract_type contract_type NOT NULL,
  status contract_status NOT NULL DEFAULT 'rascunho',
  start_date DATE,
  end_date DATE,
  total_value NUMERIC,
  monthly_value NUMERIC,
  commission_percentage NUMERIC,
  commission_value NUMERIC,
  adjustment_index TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- 13. CONTRACT PARTIES
CREATE TABLE public.contract_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES public.people(id) NOT NULL,
  role contract_party_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_parties ENABLE ROW LEVEL SECURITY;

-- 14. CONTRACT INSTALLMENTS
CREATE TABLE public.contract_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  paid_amount NUMERIC,
  status installment_status NOT NULL DEFAULT 'pendente',
  payment_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_installments ENABLE ROW LEVEL SECURITY;

-- 15. MAINTENANCE REQUESTS
CREATE TABLE public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) NOT NULL,
  requested_by UUID REFERENCES auth.users(id) NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  status maintenance_status NOT NULL DEFAULT 'aberto',
  priority maintenance_priority NOT NULL DEFAULT 'media',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

-- 16. INTERACTIONS
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES public.people(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  interaction_type interaction_type NOT NULL DEFAULT 'outro',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_developments_updated_at BEFORE UPDATE ON public.developments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_development_units_updated_at BEFORE UPDATE ON public.development_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_contract_installments_updated_at BEFORE UPDATE ON public.contract_installments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_maintenance_requests_updated_at BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- USER ROLES
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_gerente(auth.uid()));
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- PROPERTIES (authenticated + anon for public site)
CREATE POLICY "properties_select_auth" ON public.properties FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "properties_select_anon" ON public.properties FOR SELECT TO anon
  USING (status = 'disponivel');
CREATE POLICY "properties_insert" ON public.properties FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'corretor')
  );
CREATE POLICY "properties_update" ON public.properties FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR (created_by = auth.uid())
    OR public.has_role(auth.uid(), 'corretor')
  );
CREATE POLICY "properties_delete" ON public.properties FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- PROPERTY MEDIA
CREATE POLICY "property_media_select_auth" ON public.property_media FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "property_media_select_anon" ON public.property_media FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.status = 'disponivel'));
CREATE POLICY "property_media_insert" ON public.property_media FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'corretor')
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.created_by = auth.uid())
  );
CREATE POLICY "property_media_update" ON public.property_media FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.created_by = auth.uid())
  );
CREATE POLICY "property_media_delete" ON public.property_media FOR DELETE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.created_by = auth.uid())
  );

-- PROPERTY FEATURES
CREATE POLICY "property_features_select_auth" ON public.property_features FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "property_features_select_anon" ON public.property_features FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.status = 'disponivel'));
CREATE POLICY "property_features_insert" ON public.property_features FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'corretor')
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.created_by = auth.uid())
  );
CREATE POLICY "property_features_update" ON public.property_features FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.created_by = auth.uid())
  );
CREATE POLICY "property_features_delete" ON public.property_features FOR DELETE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.created_by = auth.uid())
  );

-- DEVELOPMENTS
CREATE POLICY "developments_select_auth" ON public.developments FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "developments_select_anon" ON public.developments FOR SELECT TO anon
  USING (true);
CREATE POLICY "developments_insert" ON public.developments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_gerente(auth.uid()));
CREATE POLICY "developments_update" ON public.developments FOR UPDATE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "developments_delete" ON public.developments FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- DEVELOPMENT UNITS
CREATE POLICY "dev_units_select_auth" ON public.development_units FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "dev_units_select_anon" ON public.development_units FOR SELECT TO anon
  USING (status = 'disponivel');
CREATE POLICY "dev_units_insert" ON public.development_units FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_gerente(auth.uid()));
CREATE POLICY "dev_units_update" ON public.development_units FOR UPDATE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));
CREATE POLICY "dev_units_delete" ON public.development_units FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- PEOPLE
CREATE POLICY "people_select" ON public.people FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "people_insert" ON public.people FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'corretor')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'juridico')
  );
CREATE POLICY "people_update" ON public.people FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'corretor')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'juridico')
  );
CREATE POLICY "people_delete" ON public.people FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- PERSON INTERESTS
CREATE POLICY "person_interests_select" ON public.person_interests FOR SELECT TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'corretor')
    OR created_by = auth.uid()
  );
CREATE POLICY "person_interests_insert" ON public.person_interests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'corretor')
  );
CREATE POLICY "person_interests_update" ON public.person_interests FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'corretor')
  );
CREATE POLICY "person_interests_delete" ON public.person_interests FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- CONTRACTS
CREATE POLICY "contracts_select" ON public.contracts FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "contracts_insert" ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'corretor')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'juridico')
  );
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'juridico')
  );
CREATE POLICY "contracts_delete" ON public.contracts FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- CONTRACT PARTIES
CREATE POLICY "contract_parties_select" ON public.contract_parties FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "contract_parties_insert" ON public.contract_parties FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'corretor')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'juridico')
  );
CREATE POLICY "contract_parties_update" ON public.contract_parties FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'juridico')
  );
CREATE POLICY "contract_parties_delete" ON public.contract_parties FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- CONTRACT INSTALLMENTS
CREATE POLICY "installments_select" ON public.contract_installments FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "installments_insert" ON public.contract_installments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro')
  );
CREATE POLICY "installments_update" ON public.contract_installments FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro')
  );
CREATE POLICY "installments_delete" ON public.contract_installments FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- MAINTENANCE REQUESTS
CREATE POLICY "maintenance_select" ON public.maintenance_requests FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "maintenance_insert" ON public.maintenance_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'manutencao')
    OR public.has_role(auth.uid(), 'corretor')
  );
CREATE POLICY "maintenance_update" ON public.maintenance_requests FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'manutencao')
  );
CREATE POLICY "maintenance_delete" ON public.maintenance_requests FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- INTERACTIONS
CREATE POLICY "interactions_select" ON public.interactions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "interactions_insert" ON public.interactions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_gerente(auth.uid())
    OR public.has_role(auth.uid(), 'corretor')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'juridico')
    OR public.has_role(auth.uid(), 'manutencao')
  );
CREATE POLICY "interactions_update" ON public.interactions FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_gerente(auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "interactions_delete" ON public.interactions FOR DELETE TO authenticated
  USING (public.is_admin_or_gerente(auth.uid()));

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_type ON public.properties(property_type);
CREATE INDEX idx_properties_purpose ON public.properties(purpose);
CREATE INDEX idx_properties_city ON public.properties(city);
CREATE INDEX idx_properties_created_by ON public.properties(created_by);
CREATE INDEX idx_people_type ON public.people(person_type);
CREATE INDEX idx_people_created_by ON public.people(created_by);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contracts_property ON public.contracts(property_id);
CREATE INDEX idx_contract_installments_status ON public.contract_installments(status);
CREATE INDEX idx_contract_installments_due ON public.contract_installments(due_date);
CREATE INDEX idx_maintenance_status ON public.maintenance_requests(status);
CREATE INDEX idx_interactions_person ON public.interactions(person_id);
CREATE INDEX idx_person_interests_person ON public.person_interests(person_id);
CREATE INDEX idx_person_interests_property ON public.person_interests(property_id);
CREATE INDEX idx_development_units_dev ON public.development_units(development_id);
CREATE INDEX idx_property_media_property ON public.property_media(property_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
