
-- Platform (master company) bank credentials - separate from tenant bank integrations
CREATE TABLE public.platform_bank_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('inter', 'itau', 'sicoob')),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  certificate_base64 TEXT,
  certificate_key_base64 TEXT,
  api_environment TEXT NOT NULL DEFAULT 'sandbox',
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  webhook_url TEXT,
  extra_config JSONB DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  pix_key TEXT,
  bank_name TEXT,
  account_info TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_bank_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage platform credentials"
ON public.platform_bank_credentials FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Platform boletos for tenant invoice billing
CREATE TABLE public.platform_boletos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES public.platform_bank_credentials(id),
  tenant_invoice_id UUID REFERENCES public.tenant_invoices(id),
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  payer_name TEXT NOT NULL,
  payer_document TEXT NOT NULL,
  payer_address TEXT,
  nosso_numero TEXT,
  codigo_barras TEXT,
  linha_digitavel TEXT,
  pdf_url TEXT,
  provider_id TEXT,
  provider_response JSONB,
  status TEXT NOT NULL DEFAULT 'emitido' CHECK (status IN ('emitido','registrado','pago','cancelado','vencido')),
  paid_amount NUMERIC,
  paid_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_boletos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage platform boletos"
ON public.platform_boletos FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Platform PIX charges for tenant invoice billing
CREATE TABLE public.platform_pix_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES public.platform_bank_credentials(id),
  tenant_invoice_id UUID REFERENCES public.tenant_invoices(id),
  amount NUMERIC NOT NULL,
  txid TEXT,
  payer_name TEXT,
  payer_document TEXT,
  pix_key TEXT,
  qr_code TEXT,
  qr_code_image TEXT,
  expiration_seconds INT DEFAULT 3600,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','concluida','cancelada','expirada')),
  paid_amount NUMERIC,
  paid_at TIMESTAMPTZ,
  provider_response JSONB,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_pix_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage platform pix"
ON public.platform_pix_charges FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Platform webhook events
CREATE TABLE public.platform_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  boleto_id UUID REFERENCES public.platform_boletos(id),
  pix_charge_id UUID REFERENCES public.platform_pix_charges(id),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view platform webhook events"
ON public.platform_webhook_events FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Triggers for updated_at
CREATE TRIGGER update_platform_bank_credentials_updated_at BEFORE UPDATE ON public.platform_bank_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_platform_boletos_updated_at BEFORE UPDATE ON public.platform_boletos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_platform_pix_charges_updated_at BEFORE UPDATE ON public.platform_pix_charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Allow tenants to see their own platform PIX charges (for payment QR codes)
CREATE POLICY "Tenants can view their pix charges via invoice"
ON public.platform_pix_charges FOR SELECT
USING (
  tenant_invoice_id IN (
    SELECT id FROM public.tenant_invoices WHERE tenant_id = public.auth_tenant_id()
  )
);

-- Allow tenants to view their own platform boletos (for payment links)
CREATE POLICY "Tenants can view their boletos via invoice"
ON public.platform_boletos FOR SELECT
USING (
  tenant_invoice_id IN (
    SELECT id FROM public.tenant_invoices WHERE tenant_id = public.auth_tenant_id()
  )
);
