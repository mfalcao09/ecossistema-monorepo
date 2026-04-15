
-- =====================================================
-- BLOCO 1: Qualificação Legal de Pessoas
-- =====================================================
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS marriage_regime text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS nationality text DEFAULT 'Brasileira',
  ADD COLUMN IF NOT EXISTS natural_from text,
  ADD COLUMN IF NOT EXISTS rg_issuer text,
  ADD COLUMN IF NOT EXISTS email_billing text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS notification_preference text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_account_type text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal text,
  ADD COLUMN IF NOT EXISTS cnae text;

-- BLOCO 4: Compliance e LGPD
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS lgpd_consent_date timestamptz,
  ADD COLUMN IF NOT EXISTS lgpd_consent_ip text,
  ADD COLUMN IF NOT EXISTS credit_analysis_status text,
  ADD COLUMN IF NOT EXISTS credit_analysis_date date;

-- =====================================================
-- BLOCO 2: Classificação Técnica de Imóveis
-- =====================================================
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS habite_se_status text,
  ADD COLUMN IF NOT EXISTS avcb_expiry date,
  ADD COLUMN IF NOT EXISTS leasable_area numeric,
  ADD COLUMN IF NOT EXISTS power_capacity text;

-- =====================================================
-- BLOCO 3: Campos Operacionais de Contratos
-- =====================================================
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS notice_period_days integer,
  ADD COLUMN IF NOT EXISTS grace_period_months integer,
  ADD COLUMN IF NOT EXISTS grace_discount_value numeric,
  ADD COLUMN IF NOT EXISTS grace_reason text,
  ADD COLUMN IF NOT EXISTS allows_sublease boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusivity_clause text,
  ADD COLUMN IF NOT EXISTS tenant_pays_iptu boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS tenant_pays_condo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS tenant_pays_insurance boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotion_fund_pct numeric,
  ADD COLUMN IF NOT EXISTS penalty_type text,
  ADD COLUMN IF NOT EXISTS penalty_months integer;

-- =====================================================
-- BLOCO 4: Split Automático de Repasses
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_generate_owner_transfer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract RECORD;
  v_owner RECORD;
  v_admin_fee_pct numeric;
  v_admin_fee_val numeric;
  v_net numeric;
  v_ref_month text;
  v_cut_off int;
  v_day int;
  v_owner_count int;
  v_owner_net numeric;
BEGIN
  IF NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago' AND NEW.transfer_generated = false AND NEW.revenue_type != 'propria' THEN
    SELECT c.id, c.contract_type, c.admin_fee_percentage, c.commission_percentage, c.tenant_id, c.property_id
    INTO v_contract
    FROM contracts c WHERE c.id = NEW.contract_id;

    IF v_contract IS NULL OR v_contract.contract_type != 'locacao' THEN
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

    -- Count owners from property_owners or contract_parties
    v_owner_count := 0;

    -- Try property_owners first (has ownership_percentage)
    FOR v_owner IN
      SELECT po.person_id, COALESCE(po.ownership_percentage, 100) as pct
      FROM property_owners po
      WHERE po.property_id = v_contract.property_id
      ORDER BY po.ownership_percentage DESC NULLS LAST
    LOOP
      v_owner_count := v_owner_count + 1;
      v_owner_net := ROUND(GREATEST(0, v_net) * v_owner.pct / 100, 2);

      INSERT INTO owner_transfers (contract_id, owner_person_id, reference_month, gross_amount, admin_fee_percentage, admin_fee_value, deductions_total, net_amount, status, cut_off_day, created_by, notes, tenant_id)
      VALUES (NEW.contract_id, v_owner.person_id, v_ref_month,
              ROUND(COALESCE(NEW.paid_amount, NEW.amount) * v_owner.pct / 100, 2),
              v_admin_fee_pct,
              ROUND(v_admin_fee_val * v_owner.pct / 100, 2),
              0, v_owner_net, 'pendente', v_cut_off, NEW.created_by,
              'Repasse automático - ' || v_owner.pct || '% (parcela #' || NEW.installment_number || ')', NEW.tenant_id);
    END LOOP;

    -- Fallback: if no property_owners, use contract_parties proprietario
    IF v_owner_count = 0 THEN
      FOR v_owner IN
        SELECT cp.person_id
        FROM contract_parties cp
        WHERE cp.contract_id = NEW.contract_id AND cp.role = 'proprietario'
      LOOP
        v_owner_count := v_owner_count + 1;
      END LOOP;

      IF v_owner_count > 0 THEN
        FOR v_owner IN
          SELECT cp.person_id
          FROM contract_parties cp
          WHERE cp.contract_id = NEW.contract_id AND cp.role = 'proprietario'
        LOOP
          v_owner_net := ROUND(GREATEST(0, v_net) / v_owner_count, 2);

          INSERT INTO owner_transfers (contract_id, owner_person_id, reference_month, gross_amount, admin_fee_percentage, admin_fee_value, deductions_total, net_amount, status, cut_off_day, created_by, notes, tenant_id)
          VALUES (NEW.contract_id, v_owner.person_id, v_ref_month,
                  ROUND(COALESCE(NEW.paid_amount, NEW.amount) / v_owner_count, 2),
                  v_admin_fee_pct,
                  ROUND(v_admin_fee_val / v_owner_count, 2),
                  0, v_owner_net, 'pendente', v_cut_off, NEW.created_by,
                  'Repasse automático - split igual (parcela #' || NEW.installment_number || ')', NEW.tenant_id);
        END LOOP;
      END IF;
    END IF;

    IF v_owner_count > 0 THEN
      NEW.transfer_generated := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
