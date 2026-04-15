
-- =============================================
-- AI Knowledge Base: tenant-specific knowledge snippets
-- =============================================
CREATE TABLE public.ai_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  function_key text,
  category text NOT NULL DEFAULT 'regra_negocio',
  title text NOT NULL,
  content text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_id text,
  relevance_score numeric NOT NULL DEFAULT 0.5,
  usage_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their KB" ON public.ai_knowledge_base
  FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Admins can manage KB" ON public.ai_knowledge_base
  FOR ALL TO authenticated
  USING (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()))
  WITH CHECK (tenant_id = public.auth_tenant_id() AND public.is_admin_or_gerente(auth.uid()));

CREATE POLICY "SuperAdmin can manage all KB" ON public.ai_knowledge_base
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX idx_ai_kb_tenant_function ON public.ai_knowledge_base (tenant_id, function_key, is_active);
CREATE INDEX idx_ai_kb_relevance ON public.ai_knowledge_base (relevance_score DESC, usage_count DESC);

CREATE TRIGGER update_ai_knowledge_base_updated_at
  BEFORE UPDATE ON public.ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- AI Interaction Logs: records every AI call
-- =============================================
CREATE TABLE public.ai_interaction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  function_key text NOT NULL,
  input_summary text,
  output_summary text,
  rating smallint CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  feedback_text text,
  tokens_used integer,
  response_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_interaction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.ai_interaction_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.auth_tenant_id());

CREATE POLICY "Users can update rating on own logs" ON public.ai_interaction_logs
  FOR UPDATE TO authenticated
  USING (tenant_id = public.auth_tenant_id() AND user_id = auth.uid())
  WITH CHECK (tenant_id = public.auth_tenant_id() AND user_id = auth.uid());

CREATE POLICY "Service role can insert logs" ON public.ai_interaction_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.auth_tenant_id());

CREATE POLICY "SuperAdmin can manage all logs" ON public.ai_interaction_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX idx_ai_logs_tenant_function ON public.ai_interaction_logs (tenant_id, function_key);
CREATE INDEX idx_ai_logs_rating ON public.ai_interaction_logs (tenant_id, rating) WHERE rating IS NOT NULL;
CREATE INDEX idx_ai_logs_created ON public.ai_interaction_logs (created_at DESC);
