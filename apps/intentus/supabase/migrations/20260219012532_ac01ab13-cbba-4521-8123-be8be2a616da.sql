
-- TRIGGERS: Drop + Create all missing triggers
DROP TRIGGER IF EXISTS trg_notify_new_lead ON public.leads;
CREATE TRIGGER trg_notify_new_lead AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.notify_new_lead();

DROP TRIGGER IF EXISTS trg_notify_overdue_installment ON public.contract_installments;
CREATE TRIGGER trg_notify_overdue_installment AFTER UPDATE ON public.contract_installments FOR EACH ROW EXECUTE FUNCTION public.notify_overdue_installment();

DROP TRIGGER IF EXISTS trg_on_contract_activated ON public.contracts;
CREATE TRIGGER trg_on_contract_activated AFTER UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.on_contract_activated();

DROP TRIGGER IF EXISTS trg_updated_at_contracts ON public.contracts;
CREATE TRIGGER trg_updated_at_contracts BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_contract_installments ON public.contract_installments;
CREATE TRIGGER trg_updated_at_contract_installments BEFORE UPDATE ON public.contract_installments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_contract_terminations ON public.contract_terminations;
CREATE TRIGGER trg_updated_at_contract_terminations BEFORE UPDATE ON public.contract_terminations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_collection_rules ON public.collection_rules;
CREATE TRIGGER trg_updated_at_collection_rules BEFORE UPDATE ON public.collection_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_commission_splits ON public.commission_splits;
CREATE TRIGGER trg_updated_at_commission_splits BEFORE UPDATE ON public.commission_splits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_deal_requests ON public.deal_requests;
CREATE TRIGGER trg_updated_at_deal_requests BEFORE UPDATE ON public.deal_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_debt_agreements ON public.debt_agreements;
CREATE TRIGGER trg_updated_at_debt_agreements BEFORE UPDATE ON public.debt_agreements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_due_diligence_checks ON public.due_diligence_checks;
CREATE TRIGGER trg_updated_at_due_diligence_checks BEFORE UPDATE ON public.due_diligence_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_guarantee_types ON public.guarantee_types;
CREATE TRIGGER trg_updated_at_guarantee_types BEFORE UPDATE ON public.guarantee_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_inspections ON public.inspections;
CREATE TRIGGER trg_updated_at_inspections BEFORE UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_ir_brackets ON public.ir_brackets;
CREATE TRIGGER trg_updated_at_ir_brackets BEFORE UPDATE ON public.ir_brackets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_ir_withholdings ON public.ir_withholdings;
CREATE TRIGGER trg_updated_at_ir_withholdings BEFORE UPDATE ON public.ir_withholdings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_leads ON public.leads;
CREATE TRIGGER trg_updated_at_leads BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_bank_accounts ON public.bank_accounts;
CREATE TRIGGER trg_updated_at_bank_accounts BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_developments ON public.developments;
CREATE TRIGGER trg_updated_at_developments BEFORE UPDATE ON public.developments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at_development_units ON public.development_units;
CREATE TRIGGER trg_updated_at_development_units BEFORE UPDATE ON public.development_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- REALTIME
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.leads; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_installments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- UNIQUE CONSTRAINTS (duplicates already cleaned)
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_unique_cpf ON public.people (cpf_cnpj) WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_unique_email ON public.people (email) WHERE email IS NOT NULL AND email <> '';

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_select') THEN
    CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_update') THEN
    CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_insert') THEN
    CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
