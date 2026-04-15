
-- =====================================================
-- MIGRATION: All 15 improvements
-- =====================================================

-- 1. Property intake workflow status
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS intake_status text DEFAULT 'captado';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS intake_approved_at timestamptz;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS intake_approved_by uuid;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS published_portals text[] DEFAULT '{}';

-- 2. Installment line items (decomposition: aluguel, IPTU, condominio, taxas)
CREATE TABLE IF NOT EXISTS public.installment_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL REFERENCES public.contract_installments(id) ON DELETE CASCADE,
  description text NOT NULL,
  item_type text NOT NULL DEFAULT 'aluguel', -- aluguel, iptu, condominio, taxa_extra
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.installment_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "line_items_select" ON public.installment_line_items FOR SELECT USING (true);
CREATE POLICY "line_items_insert" ON public.installment_line_items FOR INSERT WITH CHECK (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)
);
CREATE POLICY "line_items_update" ON public.installment_line_items FOR UPDATE USING (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role)
);
CREATE POLICY "line_items_delete" ON public.installment_line_items FOR DELETE USING (
  is_admin_or_gerente(auth.uid())
);

-- 3. Contract guarantee tracking
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS guarantee_type text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS guarantee_value numeric DEFAULT 0;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS guarantee_details text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS guarantee_policy_number text;

-- 4. Owner transfer approval workflow
ALTER TABLE public.owner_transfers ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.owner_transfers ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.owner_transfers ADD COLUMN IF NOT EXISTS review_notes text;

-- 5. Payment tracking on installments
ALTER TABLE public.contract_installments ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.contract_installments ADD COLUMN IF NOT EXISTS payment_reference text;

-- 6. Property price history
CREATE TABLE IF NOT EXISTS public.property_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  price_type text NOT NULL, -- sale_price, rental_price
  old_value numeric,
  new_value numeric,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.property_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_history_select" ON public.property_price_history FOR SELECT USING (true);
CREATE POLICY "price_history_insert" ON public.property_price_history FOR INSERT WITH CHECK (
  is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'corretor'::app_role)
);

-- 7. Deal request - broker origin tracking
ALTER TABLE public.deal_requests ADD COLUMN IF NOT EXISTS captador_person_id uuid REFERENCES public.people(id);
ALTER TABLE public.deal_requests ADD COLUMN IF NOT EXISTS vendedor_person_id uuid REFERENCES public.people(id);

-- 8. Sale pipeline stages (add to deal_request_status enum if not there already)
-- The existing deal_request_status enum already covers the flow. We'll use deal metadata to distinguish sale vs lease.
-- Add sale-specific fields:
ALTER TABLE public.deal_requests ADD COLUMN IF NOT EXISTS sale_stage text; -- proposta, aceite, promessa_cv, escritura, registro

-- 9. Due diligence blocking field
ALTER TABLE public.deal_requests ADD COLUMN IF NOT EXISTS dd_blocking boolean DEFAULT false;
