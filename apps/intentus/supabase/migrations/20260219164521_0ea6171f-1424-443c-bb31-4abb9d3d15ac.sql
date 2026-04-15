
-- =============================================
-- FASE 1: INFRAESTRUTURA MULTI-TENANT
-- =============================================

-- 1. Tabela tenants (sem policies ainda)
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  slug text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  logo_url text,
  active boolean NOT NULL DEFAULT true,
  settings jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Seed default tenant
INSERT INTO public.tenants (id, name, slug) VALUES ('00000000-0000-0000-0000-000000000001', 'Empresa Padrão', 'default');

-- 3. Add tenant_id to profiles FIRST (needed by auth_tenant_id function)
ALTER TABLE public.profiles ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.profiles SET tenant_id = '00000000-0000-0000-0000-000000000001';
-- Keep nullable for new users during onboarding

-- 4. Create auth_tenant_id() function
CREATE OR REPLACE FUNCTION public.auth_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 5. NOW add tenants policies
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT TO authenticated
  USING (id = auth_tenant_id() OR auth_tenant_id() IS NULL);
CREATE POLICY "tenants_update" ON public.tenants FOR UPDATE TO authenticated
  USING (id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
CREATE POLICY "tenants_insert" ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (auth_tenant_id() IS NULL);

-- 6. Add tenant_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.user_roles SET tenant_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.user_roles ALTER COLUMN tenant_id SET NOT NULL;

-- 7. Add tenant_id to ALL data tables
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'bank_accounts','bank_api_credentials','bank_webhook_events','boletos',
    'collection_events','collection_rules','commission_splits',
    'contract_installments','contract_parties','contract_terminations','contracts',
    'deal_request_checklists','deal_request_comments','deal_request_history',
    'deal_request_labels','deal_request_parties','deal_request_reminders','deal_requests',
    'debt_agreements','development_units','developments','dimob_entries',
    'due_diligence_checks','guarantee_types','inspection_items','inspections',
    'installment_line_items','interactions','ir_brackets','ir_withholdings',
    'labels','leads','maintenance_requests','notifications',
    'owner_transfers','people','person_interests','pix_charges',
    'properties','property_attachments','property_features','property_keys',
    'property_media','property_owners','property_price_history',
    'rent_adjustments','termination_history','transfer_line_items'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id)', tbl);
    EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', tbl, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tenant ON public.%I(tenant_id)', replace(tbl, '_', ''), tbl);
  END LOOP;
END $$;

-- 8. DROP and RECREATE all RLS policies with tenant isolation

-- === profiles ===
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id() OR user_id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- === user_roles ===
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can read roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (tenant_id = auth_tenant_id() OR user_id = auth.uid());
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated
  USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === bank_accounts ===
DROP POLICY IF EXISTS "bank_accounts_select" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_insert" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_update" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_delete" ON public.bank_accounts;
CREATE POLICY "bank_accounts_select" ON public.bank_accounts FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "bank_accounts_insert" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "bank_accounts_update" ON public.bank_accounts FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "bank_accounts_delete" ON public.bank_accounts FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === bank_api_credentials ===
DROP POLICY IF EXISTS "bank_creds_select" ON public.bank_api_credentials;
DROP POLICY IF EXISTS "bank_creds_insert" ON public.bank_api_credentials;
DROP POLICY IF EXISTS "bank_creds_update" ON public.bank_api_credentials;
DROP POLICY IF EXISTS "bank_creds_delete" ON public.bank_api_credentials;
CREATE POLICY "bank_creds_select" ON public.bank_api_credentials FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "bank_creds_insert" ON public.bank_api_credentials FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
CREATE POLICY "bank_creds_update" ON public.bank_api_credentials FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
CREATE POLICY "bank_creds_delete" ON public.bank_api_credentials FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === bank_webhook_events ===
DROP POLICY IF EXISTS "webhook_select" ON public.bank_webhook_events;
DROP POLICY IF EXISTS "webhook_insert" ON public.bank_webhook_events;
DROP POLICY IF EXISTS "webhook_update" ON public.bank_webhook_events;
CREATE POLICY "webhook_select" ON public.bank_webhook_events FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "webhook_insert" ON public.bank_webhook_events FOR INSERT WITH CHECK (true);
CREATE POLICY "webhook_update" ON public.bank_webhook_events FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));

-- === boletos ===
DROP POLICY IF EXISTS "boletos_select" ON public.boletos;
DROP POLICY IF EXISTS "boletos_insert" ON public.boletos;
DROP POLICY IF EXISTS "boletos_update" ON public.boletos;
DROP POLICY IF EXISTS "boletos_delete" ON public.boletos;
CREATE POLICY "boletos_select" ON public.boletos FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "boletos_insert" ON public.boletos FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "boletos_update" ON public.boletos FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "boletos_delete" ON public.boletos FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === collection_events ===
DROP POLICY IF EXISTS "collection_events_select" ON public.collection_events;
DROP POLICY IF EXISTS "collection_events_insert" ON public.collection_events;
CREATE POLICY "collection_events_select" ON public.collection_events FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "collection_events_insert" ON public.collection_events FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));

-- === collection_rules ===
DROP POLICY IF EXISTS "collection_rules_select" ON public.collection_rules;
DROP POLICY IF EXISTS "collection_rules_insert" ON public.collection_rules;
DROP POLICY IF EXISTS "collection_rules_update" ON public.collection_rules;
DROP POLICY IF EXISTS "collection_rules_delete" ON public.collection_rules;
CREATE POLICY "collection_rules_select" ON public.collection_rules FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "collection_rules_insert" ON public.collection_rules FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "collection_rules_update" ON public.collection_rules FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "collection_rules_delete" ON public.collection_rules FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === commission_splits ===
DROP POLICY IF EXISTS "commission_splits_select" ON public.commission_splits;
DROP POLICY IF EXISTS "commission_splits_insert" ON public.commission_splits;
DROP POLICY IF EXISTS "commission_splits_update" ON public.commission_splits;
DROP POLICY IF EXISTS "commission_splits_delete" ON public.commission_splits;
CREATE POLICY "commission_splits_select" ON public.commission_splits FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "commission_splits_insert" ON public.commission_splits FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'corretor'::app_role)));
CREATE POLICY "commission_splits_update" ON public.commission_splits FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "commission_splits_delete" ON public.commission_splits FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === contract_installments ===
DROP POLICY IF EXISTS "installments_select" ON public.contract_installments;
DROP POLICY IF EXISTS "installments_insert" ON public.contract_installments;
DROP POLICY IF EXISTS "installments_update" ON public.contract_installments;
DROP POLICY IF EXISTS "installments_delete" ON public.contract_installments;
CREATE POLICY "installments_select" ON public.contract_installments FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "installments_insert" ON public.contract_installments FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "installments_update" ON public.contract_installments FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "installments_delete" ON public.contract_installments FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === contract_parties ===
DROP POLICY IF EXISTS "contract_parties_select" ON public.contract_parties;
DROP POLICY IF EXISTS "contract_parties_insert" ON public.contract_parties;
DROP POLICY IF EXISTS "contract_parties_update" ON public.contract_parties;
DROP POLICY IF EXISTS "contract_parties_delete" ON public.contract_parties;
CREATE POLICY "contract_parties_select" ON public.contract_parties FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "contract_parties_insert" ON public.contract_parties FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "contract_parties_update" ON public.contract_parties FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "contract_parties_delete" ON public.contract_parties FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === contract_terminations ===
DROP POLICY IF EXISTS "terminations_select" ON public.contract_terminations;
DROP POLICY IF EXISTS "terminations_insert" ON public.contract_terminations;
DROP POLICY IF EXISTS "terminations_update" ON public.contract_terminations;
DROP POLICY IF EXISTS "terminations_delete" ON public.contract_terminations;
CREATE POLICY "terminations_select" ON public.contract_terminations FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "terminations_insert" ON public.contract_terminations FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "terminations_update" ON public.contract_terminations FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "terminations_delete" ON public.contract_terminations FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === contracts ===
DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;
CREATE POLICY "contracts_select" ON public.contracts FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "contracts_insert" ON public.contracts FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "contracts_delete" ON public.contracts FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === deal_requests ===
DROP POLICY IF EXISTS "deal_requests_select" ON public.deal_requests;
DROP POLICY IF EXISTS "deal_requests_insert" ON public.deal_requests;
DROP POLICY IF EXISTS "deal_requests_update" ON public.deal_requests;
DROP POLICY IF EXISTS "deal_requests_delete" ON public.deal_requests;
CREATE POLICY "deal_requests_select" ON public.deal_requests FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR created_by = auth.uid() OR assigned_to = auth.uid()));
CREATE POLICY "deal_requests_insert" ON public.deal_requests FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "deal_requests_update" ON public.deal_requests FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR created_by = auth.uid() OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "deal_requests_delete" ON public.deal_requests FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === deal_request_checklists ===
DROP POLICY IF EXISTS "checklists_select" ON public.deal_request_checklists;
DROP POLICY IF EXISTS "checklists_insert" ON public.deal_request_checklists;
DROP POLICY IF EXISTS "checklists_update" ON public.deal_request_checklists;
DROP POLICY IF EXISTS "checklists_delete" ON public.deal_request_checklists;
CREATE POLICY "checklists_select" ON public.deal_request_checklists FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "checklists_insert" ON public.deal_request_checklists FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "checklists_update" ON public.deal_request_checklists FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "checklists_delete" ON public.deal_request_checklists FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === deal_request_comments ===
DROP POLICY IF EXISTS "drcomments_select" ON public.deal_request_comments;
DROP POLICY IF EXISTS "drcomments_insert" ON public.deal_request_comments;
DROP POLICY IF EXISTS "drcomments_delete" ON public.deal_request_comments;
CREATE POLICY "drcomments_select" ON public.deal_request_comments FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "drcomments_insert" ON public.deal_request_comments FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "drcomments_delete" ON public.deal_request_comments FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === deal_request_history ===
DROP POLICY IF EXISTS "drh_select" ON public.deal_request_history;
DROP POLICY IF EXISTS "drh_insert" ON public.deal_request_history;
CREATE POLICY "drh_select" ON public.deal_request_history FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "drh_insert" ON public.deal_request_history FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));

-- === deal_request_labels ===
DROP POLICY IF EXISTS "drl_select" ON public.deal_request_labels;
DROP POLICY IF EXISTS "drl_insert" ON public.deal_request_labels;
DROP POLICY IF EXISTS "drl_delete" ON public.deal_request_labels;
CREATE POLICY "drl_select" ON public.deal_request_labels FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "drl_insert" ON public.deal_request_labels FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "drl_delete" ON public.deal_request_labels FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));

-- === deal_request_parties ===
DROP POLICY IF EXISTS "drp_select" ON public.deal_request_parties;
DROP POLICY IF EXISTS "drp_insert" ON public.deal_request_parties;
DROP POLICY IF EXISTS "drp_update" ON public.deal_request_parties;
DROP POLICY IF EXISTS "drp_delete" ON public.deal_request_parties;
CREATE POLICY "drp_select" ON public.deal_request_parties FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "drp_insert" ON public.deal_request_parties FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "drp_update" ON public.deal_request_parties FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role)));
CREATE POLICY "drp_delete" ON public.deal_request_parties FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === deal_request_reminders ===
DROP POLICY IF EXISTS "reminders_select" ON public.deal_request_reminders;
DROP POLICY IF EXISTS "reminders_insert" ON public.deal_request_reminders;
DROP POLICY IF EXISTS "reminders_update" ON public.deal_request_reminders;
DROP POLICY IF EXISTS "reminders_delete" ON public.deal_request_reminders;
CREATE POLICY "reminders_select" ON public.deal_request_reminders FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "reminders_insert" ON public.deal_request_reminders FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "reminders_update" ON public.deal_request_reminders FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR created_by = auth.uid()));
CREATE POLICY "reminders_delete" ON public.deal_request_reminders FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR created_by = auth.uid()));

-- === debt_agreements ===
DROP POLICY IF EXISTS "debt_agr_select" ON public.debt_agreements;
DROP POLICY IF EXISTS "debt_agr_insert" ON public.debt_agreements;
DROP POLICY IF EXISTS "debt_agr_update" ON public.debt_agreements;
DROP POLICY IF EXISTS "debt_agr_delete" ON public.debt_agreements;
CREATE POLICY "debt_agr_select" ON public.debt_agreements FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "debt_agr_insert" ON public.debt_agreements FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "debt_agr_update" ON public.debt_agreements FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "debt_agr_delete" ON public.debt_agreements FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === developments ===
DROP POLICY IF EXISTS "developments_select_auth" ON public.developments;
DROP POLICY IF EXISTS "developments_select_anon" ON public.developments;
DROP POLICY IF EXISTS "developments_insert" ON public.developments;
DROP POLICY IF EXISTS "developments_update" ON public.developments;
DROP POLICY IF EXISTS "developments_delete" ON public.developments;
CREATE POLICY "developments_select_auth" ON public.developments FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "developments_select_anon" ON public.developments FOR SELECT TO anon USING (true);
CREATE POLICY "developments_insert" ON public.developments FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
CREATE POLICY "developments_update" ON public.developments FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR created_by = auth.uid()));
CREATE POLICY "developments_delete" ON public.developments FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === development_units ===
DROP POLICY IF EXISTS "dev_units_select_auth" ON public.development_units;
DROP POLICY IF EXISTS "dev_units_select_anon" ON public.development_units;
DROP POLICY IF EXISTS "dev_units_insert" ON public.development_units;
DROP POLICY IF EXISTS "dev_units_update" ON public.development_units;
DROP POLICY IF EXISTS "dev_units_delete" ON public.development_units;
CREATE POLICY "dev_units_select_auth" ON public.development_units FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "dev_units_select_anon" ON public.development_units FOR SELECT TO anon USING (status = 'disponivel'::unit_status);
CREATE POLICY "dev_units_insert" ON public.development_units FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
CREATE POLICY "dev_units_update" ON public.development_units FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
CREATE POLICY "dev_units_delete" ON public.development_units FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === dimob_entries ===
DROP POLICY IF EXISTS "dimob_select" ON public.dimob_entries;
DROP POLICY IF EXISTS "dimob_insert" ON public.dimob_entries;
DROP POLICY IF EXISTS "dimob_update" ON public.dimob_entries;
DROP POLICY IF EXISTS "dimob_delete" ON public.dimob_entries;
CREATE POLICY "dimob_select" ON public.dimob_entries FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "dimob_insert" ON public.dimob_entries FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "dimob_update" ON public.dimob_entries FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "dimob_delete" ON public.dimob_entries FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === due_diligence_checks ===
DROP POLICY IF EXISTS "dd_select" ON public.due_diligence_checks;
DROP POLICY IF EXISTS "dd_insert" ON public.due_diligence_checks;
DROP POLICY IF EXISTS "dd_update" ON public.due_diligence_checks;
DROP POLICY IF EXISTS "dd_delete" ON public.due_diligence_checks;
CREATE POLICY "dd_select" ON public.due_diligence_checks FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "dd_insert" ON public.due_diligence_checks FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role) OR has_role(auth.uid(), 'corretor'::app_role)));
CREATE POLICY "dd_update" ON public.due_diligence_checks FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "dd_delete" ON public.due_diligence_checks FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === guarantee_types ===
DROP POLICY IF EXISTS "guarantee_types_select" ON public.guarantee_types;
DROP POLICY IF EXISTS "guarantee_types_insert" ON public.guarantee_types;
DROP POLICY IF EXISTS "guarantee_types_update" ON public.guarantee_types;
DROP POLICY IF EXISTS "guarantee_types_delete" ON public.guarantee_types;
CREATE POLICY "guarantee_types_select" ON public.guarantee_types FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "guarantee_types_insert" ON public.guarantee_types FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'juridico'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "guarantee_types_update" ON public.guarantee_types FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "guarantee_types_delete" ON public.guarantee_types FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === inspections ===
DROP POLICY IF EXISTS "inspections_select" ON public.inspections;
DROP POLICY IF EXISTS "inspections_insert" ON public.inspections;
DROP POLICY IF EXISTS "inspections_update" ON public.inspections;
DROP POLICY IF EXISTS "inspections_delete" ON public.inspections;
CREATE POLICY "inspections_select" ON public.inspections FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "inspections_insert" ON public.inspections FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'manutencao'::app_role) OR has_role(auth.uid(), 'juridico'::app_role)));
CREATE POLICY "inspections_update" ON public.inspections FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'manutencao'::app_role) OR assigned_to = auth.uid()));
CREATE POLICY "inspections_delete" ON public.inspections FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === inspection_items ===
DROP POLICY IF EXISTS "inspection_items_select" ON public.inspection_items;
DROP POLICY IF EXISTS "inspection_items_insert" ON public.inspection_items;
DROP POLICY IF EXISTS "inspection_items_update" ON public.inspection_items;
DROP POLICY IF EXISTS "inspection_items_delete" ON public.inspection_items;
CREATE POLICY "inspection_items_select" ON public.inspection_items FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "inspection_items_insert" ON public.inspection_items FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'manutencao'::app_role) OR has_role(auth.uid(), 'corretor'::app_role)));
CREATE POLICY "inspection_items_update" ON public.inspection_items FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'manutencao'::app_role)));
CREATE POLICY "inspection_items_delete" ON public.inspection_items FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'manutencao'::app_role)));

-- === installment_line_items ===
DROP POLICY IF EXISTS "line_items_select" ON public.installment_line_items;
DROP POLICY IF EXISTS "line_items_insert" ON public.installment_line_items;
DROP POLICY IF EXISTS "line_items_update" ON public.installment_line_items;
DROP POLICY IF EXISTS "line_items_delete" ON public.installment_line_items;
CREATE POLICY "line_items_select" ON public.installment_line_items FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "line_items_insert" ON public.installment_line_items FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "line_items_update" ON public.installment_line_items FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "line_items_delete" ON public.installment_line_items FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === interactions ===
DROP POLICY IF EXISTS "interactions_select" ON public.interactions;
DROP POLICY IF EXISTS "interactions_insert" ON public.interactions;
DROP POLICY IF EXISTS "interactions_update" ON public.interactions;
DROP POLICY IF EXISTS "interactions_delete" ON public.interactions;
CREATE POLICY "interactions_select" ON public.interactions FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "interactions_insert" ON public.interactions FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'juridico'::app_role) OR has_role(auth.uid(), 'manutencao'::app_role)));
CREATE POLICY "interactions_update" ON public.interactions FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR user_id = auth.uid()));
CREATE POLICY "interactions_delete" ON public.interactions FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === ir_brackets ===
DROP POLICY IF EXISTS "ir_brackets_select" ON public.ir_brackets;
DROP POLICY IF EXISTS "ir_brackets_insert" ON public.ir_brackets;
DROP POLICY IF EXISTS "ir_brackets_update" ON public.ir_brackets;
DROP POLICY IF EXISTS "ir_brackets_delete" ON public.ir_brackets;
CREATE POLICY "ir_brackets_select" ON public.ir_brackets FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "ir_brackets_insert" ON public.ir_brackets FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
CREATE POLICY "ir_brackets_update" ON public.ir_brackets FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
CREATE POLICY "ir_brackets_delete" ON public.ir_brackets FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === ir_withholdings ===
DROP POLICY IF EXISTS "ir_wh_select" ON public.ir_withholdings;
DROP POLICY IF EXISTS "ir_wh_insert" ON public.ir_withholdings;
DROP POLICY IF EXISTS "ir_wh_update" ON public.ir_withholdings;
DROP POLICY IF EXISTS "ir_wh_delete" ON public.ir_withholdings;
CREATE POLICY "ir_wh_select" ON public.ir_withholdings FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "ir_wh_insert" ON public.ir_withholdings FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "ir_wh_update" ON public.ir_withholdings FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "ir_wh_delete" ON public.ir_withholdings FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === labels ===
DROP POLICY IF EXISTS "labels_select" ON public.labels;
DROP POLICY IF EXISTS "labels_insert" ON public.labels;
DROP POLICY IF EXISTS "labels_update" ON public.labels;
DROP POLICY IF EXISTS "labels_delete" ON public.labels;
CREATE POLICY "labels_select" ON public.labels FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "labels_insert" ON public.labels FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "labels_update" ON public.labels FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));
CREATE POLICY "labels_delete" ON public.labels FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === leads ===
DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === maintenance_requests ===
DROP POLICY IF EXISTS "maint_select" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maint_insert" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maint_update" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maint_delete" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_requests_select" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_requests_insert" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_requests_update" ON public.maintenance_requests;
DROP POLICY IF EXISTS "maintenance_requests_delete" ON public.maintenance_requests;
CREATE POLICY "maint_select" ON public.maintenance_requests FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "maint_insert" ON public.maintenance_requests FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "maint_update" ON public.maintenance_requests FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'manutencao'::app_role)));
CREATE POLICY "maint_delete" ON public.maintenance_requests FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === notifications ===
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id() AND user_id = auth.uid());
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND user_id = auth.uid());
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND user_id = auth.uid());

-- === owner_transfers ===
DROP POLICY IF EXISTS "transfers_select" ON public.owner_transfers;
DROP POLICY IF EXISTS "transfers_insert" ON public.owner_transfers;
DROP POLICY IF EXISTS "transfers_update" ON public.owner_transfers;
DROP POLICY IF EXISTS "transfers_delete" ON public.owner_transfers;
DROP POLICY IF EXISTS "owner_transfers_select" ON public.owner_transfers;
DROP POLICY IF EXISTS "owner_transfers_insert" ON public.owner_transfers;
DROP POLICY IF EXISTS "owner_transfers_update" ON public.owner_transfers;
DROP POLICY IF EXISTS "owner_transfers_delete" ON public.owner_transfers;
CREATE POLICY "transfers_select" ON public.owner_transfers FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "transfers_insert" ON public.owner_transfers FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "transfers_update" ON public.owner_transfers FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "transfers_delete" ON public.owner_transfers FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === people ===
DROP POLICY IF EXISTS "people_select" ON public.people;
DROP POLICY IF EXISTS "people_insert" ON public.people;
DROP POLICY IF EXISTS "people_update" ON public.people;
DROP POLICY IF EXISTS "people_delete" ON public.people;
CREATE POLICY "people_select" ON public.people FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "people_insert" ON public.people FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "people_update" ON public.people FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "people_delete" ON public.people FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === person_interests ===
DROP POLICY IF EXISTS "person_interests_select" ON public.person_interests;
DROP POLICY IF EXISTS "person_interests_insert" ON public.person_interests;
DROP POLICY IF EXISTS "person_interests_update" ON public.person_interests;
DROP POLICY IF EXISTS "person_interests_delete" ON public.person_interests;
CREATE POLICY "person_interests_select" ON public.person_interests FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "person_interests_insert" ON public.person_interests FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "person_interests_update" ON public.person_interests FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "person_interests_delete" ON public.person_interests FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === pix_charges ===
DROP POLICY IF EXISTS "pix_select" ON public.pix_charges;
DROP POLICY IF EXISTS "pix_insert" ON public.pix_charges;
DROP POLICY IF EXISTS "pix_update" ON public.pix_charges;
DROP POLICY IF EXISTS "pix_delete" ON public.pix_charges;
DROP POLICY IF EXISTS "pix_charges_select" ON public.pix_charges;
DROP POLICY IF EXISTS "pix_charges_insert" ON public.pix_charges;
DROP POLICY IF EXISTS "pix_charges_update" ON public.pix_charges;
DROP POLICY IF EXISTS "pix_charges_delete" ON public.pix_charges;
CREATE POLICY "pix_select" ON public.pix_charges FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "pix_insert" ON public.pix_charges FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "pix_update" ON public.pix_charges FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "pix_delete" ON public.pix_charges FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === properties ===
DROP POLICY IF EXISTS "properties_select" ON public.properties;
DROP POLICY IF EXISTS "properties_insert" ON public.properties;
DROP POLICY IF EXISTS "properties_update" ON public.properties;
DROP POLICY IF EXISTS "properties_delete" ON public.properties;
DROP POLICY IF EXISTS "properties_select_auth" ON public.properties;
DROP POLICY IF EXISTS "properties_select_anon" ON public.properties;
CREATE POLICY "properties_select_auth" ON public.properties FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "properties_select_anon" ON public.properties FOR SELECT TO anon USING (true);
CREATE POLICY "properties_insert" ON public.properties FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "properties_update" ON public.properties FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "properties_delete" ON public.properties FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === property_attachments ===
DROP POLICY IF EXISTS "prop_attachments_select" ON public.property_attachments;
DROP POLICY IF EXISTS "prop_attachments_insert" ON public.property_attachments;
DROP POLICY IF EXISTS "prop_attachments_update" ON public.property_attachments;
DROP POLICY IF EXISTS "prop_attachments_delete" ON public.property_attachments;
DROP POLICY IF EXISTS "property_attachments_select" ON public.property_attachments;
DROP POLICY IF EXISTS "property_attachments_insert" ON public.property_attachments;
DROP POLICY IF EXISTS "property_attachments_update" ON public.property_attachments;
DROP POLICY IF EXISTS "property_attachments_delete" ON public.property_attachments;
CREATE POLICY "prop_attachments_select" ON public.property_attachments FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "prop_attachments_insert" ON public.property_attachments FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "prop_attachments_update" ON public.property_attachments FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "prop_attachments_delete" ON public.property_attachments FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === property_features ===
DROP POLICY IF EXISTS "prop_features_select" ON public.property_features;
DROP POLICY IF EXISTS "prop_features_insert" ON public.property_features;
DROP POLICY IF EXISTS "prop_features_update" ON public.property_features;
DROP POLICY IF EXISTS "prop_features_delete" ON public.property_features;
DROP POLICY IF EXISTS "property_features_select" ON public.property_features;
DROP POLICY IF EXISTS "property_features_insert" ON public.property_features;
DROP POLICY IF EXISTS "property_features_update" ON public.property_features;
DROP POLICY IF EXISTS "property_features_delete" ON public.property_features;
CREATE POLICY "prop_features_select" ON public.property_features FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "prop_features_insert" ON public.property_features FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "prop_features_update" ON public.property_features FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "prop_features_delete" ON public.property_features FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === property_keys ===
DROP POLICY IF EXISTS "prop_keys_select" ON public.property_keys;
DROP POLICY IF EXISTS "prop_keys_insert" ON public.property_keys;
DROP POLICY IF EXISTS "prop_keys_update" ON public.property_keys;
DROP POLICY IF EXISTS "prop_keys_delete" ON public.property_keys;
DROP POLICY IF EXISTS "property_keys_select" ON public.property_keys;
DROP POLICY IF EXISTS "property_keys_insert" ON public.property_keys;
DROP POLICY IF EXISTS "property_keys_update" ON public.property_keys;
DROP POLICY IF EXISTS "property_keys_delete" ON public.property_keys;
CREATE POLICY "prop_keys_select" ON public.property_keys FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "prop_keys_insert" ON public.property_keys FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "prop_keys_update" ON public.property_keys FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "prop_keys_delete" ON public.property_keys FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === property_media ===
DROP POLICY IF EXISTS "prop_media_select" ON public.property_media;
DROP POLICY IF EXISTS "prop_media_insert" ON public.property_media;
DROP POLICY IF EXISTS "prop_media_update" ON public.property_media;
DROP POLICY IF EXISTS "prop_media_delete" ON public.property_media;
DROP POLICY IF EXISTS "prop_media_select_auth" ON public.property_media;
DROP POLICY IF EXISTS "prop_media_select_anon" ON public.property_media;
DROP POLICY IF EXISTS "property_media_select" ON public.property_media;
DROP POLICY IF EXISTS "property_media_select_anon" ON public.property_media;
DROP POLICY IF EXISTS "property_media_insert" ON public.property_media;
DROP POLICY IF EXISTS "property_media_update" ON public.property_media;
DROP POLICY IF EXISTS "property_media_delete" ON public.property_media;
CREATE POLICY "prop_media_select_auth" ON public.property_media FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "prop_media_select_anon" ON public.property_media FOR SELECT TO anon USING (true);
CREATE POLICY "prop_media_insert" ON public.property_media FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "prop_media_update" ON public.property_media FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "prop_media_delete" ON public.property_media FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id());

-- === property_owners ===
DROP POLICY IF EXISTS "prop_owners_select" ON public.property_owners;
DROP POLICY IF EXISTS "prop_owners_insert" ON public.property_owners;
DROP POLICY IF EXISTS "prop_owners_update" ON public.property_owners;
DROP POLICY IF EXISTS "prop_owners_delete" ON public.property_owners;
DROP POLICY IF EXISTS "property_owners_select" ON public.property_owners;
DROP POLICY IF EXISTS "property_owners_insert" ON public.property_owners;
DROP POLICY IF EXISTS "property_owners_update" ON public.property_owners;
DROP POLICY IF EXISTS "property_owners_delete" ON public.property_owners;
CREATE POLICY "prop_owners_select" ON public.property_owners FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "prop_owners_insert" ON public.property_owners FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "prop_owners_update" ON public.property_owners FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "prop_owners_delete" ON public.property_owners FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === property_price_history ===
DROP POLICY IF EXISTS "price_history_select" ON public.property_price_history;
DROP POLICY IF EXISTS "price_history_insert" ON public.property_price_history;
DROP POLICY IF EXISTS "property_price_history_select" ON public.property_price_history;
DROP POLICY IF EXISTS "property_price_history_insert" ON public.property_price_history;
CREATE POLICY "price_history_select" ON public.property_price_history FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "price_history_insert" ON public.property_price_history FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());

-- === rent_adjustments ===
DROP POLICY IF EXISTS "rent_adj_select" ON public.rent_adjustments;
DROP POLICY IF EXISTS "rent_adj_insert" ON public.rent_adjustments;
DROP POLICY IF EXISTS "rent_adj_update" ON public.rent_adjustments;
DROP POLICY IF EXISTS "rent_adj_delete" ON public.rent_adjustments;
DROP POLICY IF EXISTS "rent_adjustments_select" ON public.rent_adjustments;
DROP POLICY IF EXISTS "rent_adjustments_insert" ON public.rent_adjustments;
DROP POLICY IF EXISTS "rent_adjustments_update" ON public.rent_adjustments;
DROP POLICY IF EXISTS "rent_adjustments_delete" ON public.rent_adjustments;
CREATE POLICY "rent_adj_select" ON public.rent_adjustments FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "rent_adj_insert" ON public.rent_adjustments FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "rent_adj_update" ON public.rent_adjustments FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "rent_adj_delete" ON public.rent_adjustments FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- === termination_history ===
DROP POLICY IF EXISTS "term_history_select" ON public.termination_history;
DROP POLICY IF EXISTS "term_history_insert" ON public.termination_history;
DROP POLICY IF EXISTS "termination_history_select" ON public.termination_history;
DROP POLICY IF EXISTS "termination_history_insert" ON public.termination_history;
CREATE POLICY "term_history_select" ON public.termination_history FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "term_history_insert" ON public.termination_history FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id());

-- === transfer_line_items ===
DROP POLICY IF EXISTS "tli_select" ON public.transfer_line_items;
DROP POLICY IF EXISTS "tli_insert" ON public.transfer_line_items;
DROP POLICY IF EXISTS "tli_update" ON public.transfer_line_items;
DROP POLICY IF EXISTS "tli_delete" ON public.transfer_line_items;
DROP POLICY IF EXISTS "transfer_line_items_select" ON public.transfer_line_items;
DROP POLICY IF EXISTS "transfer_line_items_insert" ON public.transfer_line_items;
DROP POLICY IF EXISTS "transfer_line_items_update" ON public.transfer_line_items;
DROP POLICY IF EXISTS "transfer_line_items_delete" ON public.transfer_line_items;
CREATE POLICY "tli_select" ON public.transfer_line_items FOR SELECT TO authenticated USING (tenant_id = auth_tenant_id());
CREATE POLICY "tli_insert" ON public.transfer_line_items FOR INSERT TO authenticated WITH CHECK (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "tli_update" ON public.transfer_line_items FOR UPDATE TO authenticated USING (tenant_id = auth_tenant_id() AND (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)));
CREATE POLICY "tli_delete" ON public.transfer_line_items FOR DELETE TO authenticated USING (tenant_id = auth_tenant_id() AND is_admin_or_gerente(auth.uid()));

-- 9. Update triggers that insert data to include tenant_id
-- Update auto_generate_owner_transfer to propagate tenant_id
CREATE OR REPLACE FUNCTION public.auto_generate_owner_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_owner RECORD;
  v_admin_fee_pct numeric;
  v_admin_fee_val numeric;
  v_net numeric;
  v_ref_month text;
  v_cut_off int;
  v_day int;
BEGIN
  IF NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago' AND NEW.transfer_generated = false AND NEW.revenue_type != 'propria' THEN
    SELECT c.id, c.contract_type, c.admin_fee_percentage, c.commission_percentage, c.tenant_id
    INTO v_contract
    FROM contracts c WHERE c.id = NEW.contract_id;

    IF v_contract IS NULL OR v_contract.contract_type != 'locacao' THEN
      RETURN NEW;
    END IF;

    SELECT cp.person_id INTO v_owner
    FROM contract_parties cp WHERE cp.contract_id = NEW.contract_id AND cp.role = 'proprietario'
    LIMIT 1;

    IF v_owner IS NULL THEN
      RETURN NEW;
    END IF;

    v_admin_fee_pct := COALESCE(v_contract.admin_fee_percentage, 10);
    v_admin_fee_val := ROUND(COALESCE(NEW.paid_amount, NEW.amount) * v_admin_fee_pct / 100, 2);
    v_net := COALESCE(NEW.paid_amount, NEW.amount) - v_admin_fee_val;
    v_ref_month := to_char(NEW.due_date, 'YYYY-MM');
    v_day := EXTRACT(DAY FROM CURRENT_DATE)::int;
    IF v_day <= 10 THEN v_cut_off := 10;
    ELSIF v_day <= 20 THEN v_cut_off := 20;
    ELSE v_cut_off := 30;
    END IF;

    INSERT INTO owner_transfers (contract_id, owner_person_id, reference_month, gross_amount, admin_fee_percentage, admin_fee_value, deductions_total, net_amount, status, cut_off_day, created_by, notes, tenant_id)
    VALUES (NEW.contract_id, v_owner.person_id, v_ref_month, COALESCE(NEW.paid_amount, NEW.amount), v_admin_fee_pct, v_admin_fee_val, 0, GREATEST(0, v_net), 'pendente', v_cut_off, NEW.created_by,
            'Repasse gerado automaticamente ao receber parcela #' || NEW.installment_number, NEW.tenant_id);

    NEW.transfer_generated := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Update on_contract_activated to include tenant_id
CREATE OR REPLACE FUNCTION public.on_contract_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ativo' AND (OLD.status IS DISTINCT FROM 'ativo') THEN
    IF NEW.contract_type = 'locacao' THEN
      INSERT INTO public.inspections (property_id, contract_id, inspection_type, status, scheduled_date, created_by, inspector_notes, tenant_id)
      SELECT NEW.property_id, NEW.id, 'entrada', 'agendada', NEW.start_date, NEW.created_by,
             'Vistoria de entrada gerada automaticamente ao ativar contrato.', NEW.tenant_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.inspections WHERE contract_id = NEW.id AND inspection_type = 'entrada'
      );
    END IF;

    IF NEW.contract_type = 'locacao' AND NEW.monthly_value IS NOT NULL AND NEW.start_date IS NOT NULL AND NEW.intermediation_fee_generated = false THEN
      INSERT INTO public.contract_installments (contract_id, installment_number, amount, due_date, status, created_by, revenue_type, notes, tenant_id)
      VALUES (NEW.id, 0, NEW.monthly_value, NEW.start_date, 'pendente', NEW.created_by, 'intermediacao', 'Taxa de intermediação (1º aluguel) - gerada automaticamente', NEW.tenant_id);
      UPDATE public.contracts SET intermediation_fee_generated = true WHERE id = NEW.id;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, category, reference_type, reference_id, tenant_id)
    SELECT ur.user_id, 'Contrato Ativado',
           'Um contrato de ' || NEW.contract_type || ' foi ativado.',
           'contratos', 'contract', NEW.id::text, NEW.tenant_id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'gerente', 'financeiro') AND ur.tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Update notify_new_lead to include tenant_id
CREATE OR REPLACE FUNCTION public.notify_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, category, reference_type, reference_id, tenant_id)
  SELECT ur.user_id,
         'Novo Lead: ' || NEW.name,
         'Lead captado via ' || NEW.source || '. Telefone: ' || COALESCE(NEW.phone, 'N/A'),
         'leads', 'lead', NEW.id::text, NEW.tenant_id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'gerente', 'corretor') AND ur.tenant_id = NEW.tenant_id;
  RETURN NEW;
END;
$$;

-- Update notify_overdue_installment to include tenant_id
CREATE OR REPLACE FUNCTION public.notify_overdue_installment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'atrasado' AND (OLD.status IS DISTINCT FROM 'atrasado') THEN
    INSERT INTO public.notifications (user_id, title, message, category, reference_type, reference_id, tenant_id)
    SELECT ur.user_id,
           'Parcela Vencida #' || NEW.installment_number,
           'Parcela de R$ ' || NEW.amount || ' venceu em ' || NEW.due_date,
           'financeiro', 'installment', NEW.id::text, NEW.tenant_id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'gerente', 'financeiro') AND ur.tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;
