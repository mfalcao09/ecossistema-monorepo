
-- ITEM 1: Create unique partial index on people.cpf_cnpj (no duplicates exist)
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_unique_cpf ON public.people(cpf_cnpj) WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_unique_email ON public.people(email) WHERE email IS NOT NULL AND email != '';

-- ITEM 2: Drop duplicate old-style updated_at triggers (keep trg_updated_at_*)
DROP TRIGGER IF EXISTS update_bank_accounts_updated_at ON public.bank_accounts;
DROP TRIGGER IF EXISTS update_collection_rules_updated_at ON public.collection_rules;
DROP TRIGGER IF EXISTS update_commission_splits_updated_at ON public.commission_splits;
DROP TRIGGER IF EXISTS update_terminations_updated_at ON public.contract_terminations;
DROP TRIGGER IF EXISTS update_deal_requests_updated_at ON public.deal_requests;
DROP TRIGGER IF EXISTS update_debt_agreements_updated_at ON public.debt_agreements;
DROP TRIGGER IF EXISTS update_dd_checks_updated_at ON public.due_diligence_checks;
DROP TRIGGER IF EXISTS update_guarantee_types_updated_at ON public.guarantee_types;
DROP TRIGGER IF EXISTS update_inspections_updated_at ON public.inspections;
DROP TRIGGER IF EXISTS update_ir_withholdings_updated_at ON public.ir_withholdings;
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
DROP TRIGGER IF EXISTS update_dimob_entries_updated_at ON public.dimob_entries;
DROP TRIGGER IF EXISTS update_owner_transfers_updated_at ON public.owner_transfers;
DROP TRIGGER IF EXISTS update_rent_adjustments_updated_at ON public.rent_adjustments;

-- Add missing trg_updated_at for tables that only had the old trigger
CREATE TRIGGER trg_updated_at_dimob_entries BEFORE UPDATE ON public.dimob_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_updated_at_owner_transfers BEFORE UPDATE ON public.owner_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_updated_at_rent_adjustments BEFORE UPDATE ON public.rent_adjustments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_updated_at_maintenance_requests BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ITEM 9: Trigger to auto-generate owner_transfer when installment is marked as paid
CREATE OR REPLACE FUNCTION public.auto_generate_owner_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  -- Only act when status changes to 'pago' and transfer not yet generated
  IF NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago' AND NEW.transfer_generated = false AND NEW.revenue_type != 'propria' THEN
    -- Get contract info
    SELECT c.id, c.contract_type, c.admin_fee_percentage, c.commission_percentage
    INTO v_contract
    FROM contracts c WHERE c.id = NEW.contract_id;

    IF v_contract IS NULL OR v_contract.contract_type != 'locacao' THEN
      RETURN NEW;
    END IF;

    -- Find the owner
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

    INSERT INTO owner_transfers (contract_id, owner_person_id, reference_month, gross_amount, admin_fee_percentage, admin_fee_value, deductions_total, net_amount, status, cut_off_day, created_by, notes)
    VALUES (NEW.contract_id, v_owner.person_id, v_ref_month, COALESCE(NEW.paid_amount, NEW.amount), v_admin_fee_pct, v_admin_fee_val, 0, GREATEST(0, v_net), 'pendente', v_cut_off, NEW.created_by,
            'Repasse gerado automaticamente ao receber parcela #' || NEW.installment_number);

    NEW.transfer_generated := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_owner_transfer
BEFORE UPDATE ON public.contract_installments
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_owner_transfer();
