
-- Table for card members
CREATE TABLE public.deal_request_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_request_id UUID NOT NULL REFERENCES public.deal_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_request_id, user_id)
);

ALTER TABLE public.deal_request_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view members"
  ON public.deal_request_members FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can insert members"
  ON public.deal_request_members FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can delete members"
  ON public.deal_request_members FOR DELETE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- Auto-add checklist assignee as member
CREATE OR REPLACE FUNCTION public.auto_add_checklist_assignee_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.deal_request_members (deal_request_id, user_id, tenant_id, added_by)
    VALUES (NEW.deal_request_id, NEW.assigned_to, NEW.tenant_id, NEW.created_by)
    ON CONFLICT (deal_request_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_add_checklist_member
AFTER INSERT OR UPDATE OF assigned_to ON public.deal_request_checklists
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_checklist_assignee_as_member();
