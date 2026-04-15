
-- =============================================
-- Etapa 1a: Novos campos na tabela contracts
-- =============================================
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signed_at date,
  ADD COLUMN IF NOT EXISTS signing_platform text,
  ADD COLUMN IF NOT EXISTS down_payment numeric,
  ADD COLUMN IF NOT EXISTS remaining_balance numeric,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_holder text,
  ADD COLUMN IF NOT EXISTS has_intermediation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deed_deadline_days integer,
  ADD COLUMN IF NOT EXISTS possession_deadline text,
  ADD COLUMN IF NOT EXISTS suspensive_conditions text[],
  ADD COLUMN IF NOT EXISTS charges_transfer_date date,
  ADD COLUMN IF NOT EXISTS late_interest_rate numeric,
  ADD COLUMN IF NOT EXISTS late_penalty_rate numeric,
  ADD COLUMN IF NOT EXISTS termination_penalty_rate numeric;

-- =============================================
-- Etapa 1b: Novos campos na tabela contract_parties
-- =============================================
ALTER TABLE public.contract_parties
  ADD COLUMN IF NOT EXISTS legal_representative_name text,
  ADD COLUMN IF NOT EXISTS legal_representative_cpf text,
  ADD COLUMN IF NOT EXISTS ownership_percentage numeric;

-- =============================================
-- Etapa 1c: Novos campos na tabela properties
-- =============================================
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS registry_office text,
  ADD COLUMN IF NOT EXISTS municipal_registration text;

-- =============================================
-- Etapa 1d: Adicionar valores aos enums
-- =============================================
ALTER TYPE public.contract_type ADD VALUE IF NOT EXISTS 'distrato';
ALTER TYPE public.contract_party_role ADD VALUE IF NOT EXISTS 'locador';
ALTER TYPE public.contract_party_role ADD VALUE IF NOT EXISTS 'vendedor';
ALTER TYPE public.contract_party_role ADD VALUE IF NOT EXISTS 'intermediador';

-- =============================================
-- Atualizar trigger de auditoria para incluir novos campos
-- =============================================
CREATE OR REPLACE FUNCTION public.fn_log_contract_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_name text;
  v_fields text[] := ARRAY[
    'status','contract_type','start_date','end_date','total_value','monthly_value',
    'commission_percentage','admin_fee_percentage','adjustment_index','notes','property_id',
    'signed_at','signing_platform','down_payment','remaining_balance','payment_method',
    'bank_name','bank_agency','bank_account','bank_holder','has_intermediation',
    'deed_deadline_days','possession_deadline','charges_transfer_date',
    'late_interest_rate','late_penalty_rate','termination_penalty_rate'
  ];
  v_field text;
  v_old text;
  v_new text;
BEGIN
  SELECT name INTO v_user_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.contract_audit_trail (contract_id, action, performer_name, performed_by, tenant_id, details)
    VALUES (NEW.id, 'criado', COALESCE(v_user_name, 'Sistema'), auth.uid(), NEW.tenant_id,
            jsonb_build_object('contract_type', NEW.contract_type, 'status', NEW.status));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH v_field IN ARRAY v_fields LOOP
      EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_field, v_field) INTO v_old, v_new USING OLD, NEW;
      IF v_old IS DISTINCT FROM v_new THEN
        INSERT INTO public.contract_audit_trail (contract_id, action, field_changed, old_value, new_value, performed_by, performer_name, tenant_id)
        VALUES (NEW.id, 'editado', v_field, v_old, v_new, auth.uid(), COALESCE(v_user_name, 'Sistema'), NEW.tenant_id);
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
