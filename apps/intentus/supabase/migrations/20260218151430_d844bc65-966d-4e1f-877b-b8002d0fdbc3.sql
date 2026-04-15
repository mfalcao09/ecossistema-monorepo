
-- ============================================
-- P0: COMMISSION SPLITS, BANK ACCOUNTS, OWNER TRANSFERS
-- ============================================

-- 1. Commission split roles
CREATE TYPE public.commission_role AS ENUM ('house', 'captador', 'vendedor');
CREATE TYPE public.commission_status AS ENUM ('pendente', 'aprovado', 'pago', 'cancelado');
CREATE TYPE public.transfer_status AS ENUM ('pendente', 'processado', 'pago', 'cancelado');
CREATE TYPE public.bank_account_type AS ENUM ('operacional', 'transitoria');

-- 2. Bank Accounts (contas bancárias)
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bank_name TEXT,
  agency TEXT,
  account_number TEXT,
  account_type bank_account_type NOT NULL DEFAULT 'operacional',
  pix_key TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_select" ON public.bank_accounts FOR SELECT USING (true);
CREATE POLICY "bank_accounts_insert" ON public.bank_accounts FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'));
CREATE POLICY "bank_accounts_update" ON public.bank_accounts FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'));
CREATE POLICY "bank_accounts_delete" ON public.bank_accounts FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Commission Splits (rateio de comissões)
CREATE TABLE public.commission_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  deal_request_id UUID REFERENCES public.deal_requests(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people(id),
  role commission_role NOT NULL,
  percentage NUMERIC NOT NULL DEFAULT 0,
  calculated_value NUMERIC NOT NULL DEFAULT 0,
  status commission_status NOT NULL DEFAULT 'pendente',
  payment_date DATE,
  nf_number TEXT,
  rpa_number TEXT,
  tax_inss NUMERIC DEFAULT 0,
  tax_irrf NUMERIC DEFAULT 0,
  net_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT commission_splits_source CHECK (contract_id IS NOT NULL OR deal_request_id IS NOT NULL)
);

ALTER TABLE public.commission_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_splits_select" ON public.commission_splits FOR SELECT USING (true);
CREATE POLICY "commission_splits_insert" ON public.commission_splits FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro') OR has_role(auth.uid(), 'corretor'));
CREATE POLICY "commission_splits_update" ON public.commission_splits FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'));
CREATE POLICY "commission_splits_delete" ON public.commission_splits FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_commission_splits_updated_at BEFORE UPDATE ON public.commission_splits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Owner Transfers (repasses ao proprietário)
CREATE TABLE public.owner_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id),
  owner_person_id UUID NOT NULL REFERENCES public.people(id),
  reference_month TEXT NOT NULL, -- 'YYYY-MM'
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  admin_fee_percentage NUMERIC NOT NULL DEFAULT 0,
  admin_fee_value NUMERIC NOT NULL DEFAULT 0,
  deductions_total NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  status transfer_status NOT NULL DEFAULT 'pendente',
  cut_off_day INTEGER NOT NULL DEFAULT 10,
  payment_date DATE,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_transfers_select" ON public.owner_transfers FOR SELECT USING (true);
CREATE POLICY "owner_transfers_insert" ON public.owner_transfers FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'));
CREATE POLICY "owner_transfers_update" ON public.owner_transfers FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'));
CREATE POLICY "owner_transfers_delete" ON public.owner_transfers FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

CREATE TRIGGER update_owner_transfers_updated_at BEFORE UPDATE ON public.owner_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Transfer Line Items (itens do repasse)
CREATE TABLE public.transfer_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES public.owner_transfers(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'credito', -- credito or debito
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transfer_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_line_items_select" ON public.transfer_line_items FOR SELECT USING (true);
CREATE POLICY "transfer_line_items_insert" ON public.transfer_line_items FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'));
CREATE POLICY "transfer_line_items_update" ON public.transfer_line_items FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'));
CREATE POLICY "transfer_line_items_delete" ON public.transfer_line_items FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

-- Indexes
CREATE INDEX idx_commission_splits_contract ON public.commission_splits(contract_id);
CREATE INDEX idx_commission_splits_deal ON public.commission_splits(deal_request_id);
CREATE INDEX idx_owner_transfers_contract ON public.owner_transfers(contract_id);
CREATE INDEX idx_owner_transfers_month ON public.owner_transfers(reference_month);
CREATE INDEX idx_transfer_line_items_transfer ON public.transfer_line_items(transfer_id);
