
-- =============================================
-- CLM (Contract Lifecycle Management) Tables
-- =============================================

-- 1. contract_documents - Repositório Central + Versionamento
CREATE TABLE public.contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'outro',
  title text NOT NULL,
  file_path text NOT NULL,
  version int NOT NULL DEFAULT 1,
  parent_document_id uuid REFERENCES public.contract_documents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'rascunho',
  uploaded_by uuid NOT NULL,
  notes text,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for contract_documents"
  ON public.contract_documents FOR ALL
  USING (tenant_id = public.auth_tenant_id() OR public.superadmin_tenant_filter(tenant_id))
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE TRIGGER update_contract_documents_updated_at
  BEFORE UPDATE ON public.contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. contract_approvals - Workflow de Aprovação
CREATE TABLE public.contract_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  step_order int NOT NULL DEFAULT 1,
  step_name text NOT NULL,
  approver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  decided_at timestamptz,
  comments text,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for contract_approvals"
  ON public.contract_approvals FOR ALL
  USING (tenant_id = public.auth_tenant_id() OR public.superadmin_tenant_filter(tenant_id))
  WITH CHECK (tenant_id = public.auth_tenant_id());

-- 3. contract_obligations - Gestão de Obrigações
CREATE TABLE public.contract_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  obligation_type text NOT NULL DEFAULT 'operacional',
  responsible_party text NOT NULL DEFAULT 'administradora',
  due_date date NOT NULL,
  recurrence text,
  status text NOT NULL DEFAULT 'pendente',
  alert_days_before int NOT NULL DEFAULT 30,
  completed_at timestamptz,
  completed_by uuid,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for contract_obligations"
  ON public.contract_obligations FOR ALL
  USING (tenant_id = public.auth_tenant_id() OR public.superadmin_tenant_filter(tenant_id))
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE TRIGGER update_contract_obligations_updated_at
  BEFORE UPDATE ON public.contract_obligations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. contract_clauses - Biblioteca de Cláusulas
CREATE TABLE public.contract_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  contract_types text[] DEFAULT '{}',
  is_mandatory boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for contract_clauses"
  ON public.contract_clauses FOR ALL
  USING (tenant_id = public.auth_tenant_id() OR public.superadmin_tenant_filter(tenant_id))
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE TRIGGER update_contract_clauses_updated_at
  BEFORE UPDATE ON public.contract_clauses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. contract_audit_trail - Trilha de Auditoria (INSERT only)
CREATE TABLE public.contract_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  performed_by uuid,
  performer_name text,
  ip_address text,
  details jsonb,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_audit_trail ENABLE ROW LEVEL SECURITY;

-- Only SELECT and INSERT allowed (immutable log)
CREATE POLICY "Tenant can read audit trail"
  ON public.contract_audit_trail FOR SELECT
  USING (tenant_id = public.auth_tenant_id() OR public.superadmin_tenant_filter(tenant_id));

CREATE POLICY "Tenant can insert audit trail"
  ON public.contract_audit_trail FOR INSERT
  WITH CHECK (tenant_id = public.auth_tenant_id());

-- =============================================
-- Triggers
-- =============================================

-- Trigger: Auto-log contract changes to audit trail
CREATE OR REPLACE FUNCTION public.fn_log_contract_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_name text;
  v_fields text[] := ARRAY['status','contract_type','start_date','end_date','total_value','monthly_value','commission_percentage','admin_fee_percentage','adjustment_index','notes','property_id'];
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
$$;

CREATE TRIGGER trg_contract_audit_on_change
  AFTER INSERT OR UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_contract_changes();

-- Trigger: Notify next approver when current approves
CREATE OR REPLACE FUNCTION public.fn_approval_chain_notification()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_next RECORD;
  v_approver_name text;
BEGIN
  IF NEW.status = 'aprovado' AND OLD.status = 'pendente' THEN
    SELECT name INTO v_approver_name FROM public.profiles WHERE user_id = NEW.approver_id LIMIT 1;

    -- Log to audit trail
    INSERT INTO public.contract_audit_trail (contract_id, action, performer_name, performed_by, tenant_id, details)
    VALUES (NEW.contract_id, 'aprovacao', COALESCE(v_approver_name, 'Aprovador'), NEW.approver_id, NEW.tenant_id,
            jsonb_build_object('step', NEW.step_name, 'comments', NEW.comments));

    -- Find next pending step
    SELECT * INTO v_next FROM public.contract_approvals
    WHERE contract_id = NEW.contract_id AND step_order > NEW.step_order AND status = 'pendente'
    ORDER BY step_order LIMIT 1;

    IF v_next IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, category, reference_type, reference_id, tenant_id)
      VALUES (v_next.approver_id, 'Aprovação Pendente', 'Etapa "' || v_next.step_name || '" aguarda sua aprovação.', 'contratos', 'contract', NEW.contract_id::text, NEW.tenant_id);
    END IF;
  END IF;

  IF NEW.status = 'rejeitado' AND OLD.status = 'pendente' THEN
    SELECT name INTO v_approver_name FROM public.profiles WHERE user_id = NEW.approver_id LIMIT 1;
    INSERT INTO public.contract_audit_trail (contract_id, action, performer_name, performed_by, tenant_id, details)
    VALUES (NEW.contract_id, 'aprovacao_rejeitada', COALESCE(v_approver_name, 'Aprovador'), NEW.approver_id, NEW.tenant_id,
            jsonb_build_object('step', NEW.step_name, 'comments', NEW.comments));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approval_chain_notification
  AFTER UPDATE ON public.contract_approvals
  FOR EACH ROW EXECUTE FUNCTION public.fn_approval_chain_notification();

-- Trigger: Mark overdue obligations and notify
CREATE OR REPLACE FUNCTION public.fn_obligation_overdue_check()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pendente' AND NEW.due_date < CURRENT_DATE AND OLD.status = 'pendente' THEN
    NEW.status := 'vencida';
    INSERT INTO public.notifications (user_id, title, message, category, reference_type, reference_id, tenant_id)
    SELECT ur.user_id, 'Obrigação Vencida', 'A obrigação "' || NEW.title || '" venceu em ' || NEW.due_date, 'contratos', 'contract', NEW.contract_id::text, NEW.tenant_id
    FROM public.user_roles ur WHERE ur.role IN ('admin', 'gerente', 'juridico') AND ur.tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_obligation_overdue
  BEFORE UPDATE ON public.contract_obligations
  FOR EACH ROW EXECUTE FUNCTION public.fn_obligation_overdue_check();

-- =============================================
-- Storage bucket for contract documents
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-documents', 'contract-documents', false);

CREATE POLICY "Tenant can upload contract documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contract-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant can view contract documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contract-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant can delete own contract documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contract-documents' AND auth.uid() IS NOT NULL);
