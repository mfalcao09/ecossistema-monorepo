
-- Enum for supported banks
CREATE TYPE public.bank_provider AS ENUM ('inter', 'itau', 'sicoob');

-- Enum for boleto status
CREATE TYPE public.boleto_status AS ENUM ('emitido', 'registrado', 'pago', 'vencido', 'cancelado', 'erro');

-- Enum for pix charge status
CREATE TYPE public.pix_charge_status AS ENUM ('ativa', 'concluida', 'removida_pelo_usuario', 'removida_pelo_psp', 'expirada');

-- Bank API credentials per bank_account
CREATE TABLE public.bank_api_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  provider bank_provider NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  certificate_base64 TEXT,
  certificate_key_base64 TEXT,
  api_environment TEXT NOT NULL DEFAULT 'sandbox',
  webhook_url TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  extra_config JSONB DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bank_account_id)
);

-- Boletos emitidos
CREATE TABLE public.boletos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installment_id UUID REFERENCES public.contract_installments(id),
  bank_credential_id UUID NOT NULL REFERENCES public.bank_api_credentials(id),
  nosso_numero TEXT,
  linha_digitavel TEXT,
  codigo_barras TEXT,
  pdf_url TEXT,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  payer_name TEXT NOT NULL,
  payer_document TEXT NOT NULL,
  payer_address TEXT,
  status boleto_status NOT NULL DEFAULT 'emitido',
  provider_id TEXT,
  provider_response JSONB,
  paid_amount NUMERIC,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- PIX charges (cobranças imediatas e com vencimento)
CREATE TABLE public.pix_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installment_id UUID REFERENCES public.contract_installments(id),
  bank_credential_id UUID NOT NULL REFERENCES public.bank_api_credentials(id),
  txid TEXT,
  location TEXT,
  qr_code TEXT,
  qr_code_image_base64 TEXT,
  amount NUMERIC NOT NULL,
  payer_name TEXT,
  payer_document TEXT,
  status pix_charge_status NOT NULL DEFAULT 'ativa',
  expiration_seconds INTEGER DEFAULT 3600,
  provider_response JSONB,
  paid_amount NUMERIC,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Webhook events log
CREATE TABLE public.bank_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider bank_provider NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  boleto_id UUID REFERENCES public.boletos(id),
  pix_charge_id UUID REFERENCES public.pix_charges(id),
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS: bank_api_credentials (only admin/gerente/financeiro)
CREATE POLICY "bank_creds_select" ON public.bank_api_credentials FOR SELECT
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "bank_creds_insert" ON public.bank_api_credentials FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()));
CREATE POLICY "bank_creds_update" ON public.bank_api_credentials FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()));
CREATE POLICY "bank_creds_delete" ON public.bank_api_credentials FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

-- RLS: boletos
CREATE POLICY "boletos_select" ON public.boletos FOR SELECT USING (true);
CREATE POLICY "boletos_insert" ON public.boletos FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "boletos_update" ON public.boletos FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "boletos_delete" ON public.boletos FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

-- RLS: pix_charges
CREATE POLICY "pix_select" ON public.pix_charges FOR SELECT USING (true);
CREATE POLICY "pix_insert" ON public.pix_charges FOR INSERT
  WITH CHECK (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "pix_update" ON public.pix_charges FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "pix_delete" ON public.pix_charges FOR DELETE
  USING (is_admin_or_gerente(auth.uid()));

-- RLS: webhook events (select for auth users, insert open for webhook endpoint)
CREATE POLICY "webhook_select" ON public.bank_webhook_events FOR SELECT
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));
CREATE POLICY "webhook_insert" ON public.bank_webhook_events FOR INSERT
  WITH CHECK (true);
CREATE POLICY "webhook_update" ON public.bank_webhook_events FOR UPDATE
  USING (is_admin_or_gerente(auth.uid()) OR has_role(auth.uid(), 'financeiro'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_bank_creds_updated_at BEFORE UPDATE ON public.bank_api_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_boletos_updated_at BEFORE UPDATE ON public.boletos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_pix_charges_updated_at BEFORE UPDATE ON public.pix_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
