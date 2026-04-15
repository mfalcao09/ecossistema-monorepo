import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BANK_CONFIGS: Record<string, any> = {
  inter: {
    sandbox: "https://cdpj-sandbox.partners.uatinter.co",
    production: "https://cdpj.partners.bancointer.com.br",
    tokenPath: "/oauth/v2/token",
    pixPath: "/pix/v2/cob",
    scopes: "cob.write cob.read pix.read",
  },
};

function decodePem(base64: string): string {
  if (base64.includes("-----BEGIN")) return base64;
  try { return atob(base64); } catch { return base64; }
}

function createMtlsClient(certBase64: string, keyBase64: string): any {
  const cert = decodePem(certBase64);
  const key = decodePem(keyBase64);
  if (typeof Deno.createHttpClient === "function") {
    return Deno.createHttpClient({ cert, key });
  }
  return null;
}

async function fetchWithMtls(url: string, options: RequestInit, httpClient: any): Promise<Response> {
  if (httpClient) return fetch(url, { ...options, client: httpClient } as any);
  return fetch(url, options);
}

async function getAccessToken(supabase: any, credential: any, httpClient: any): Promise<string> {
  if (credential.access_token && credential.token_expires_at) {
    const expiresAt = new Date(credential.token_expires_at);
    if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) return credential.access_token;
  }
  const config = BANK_CONFIGS[credential.provider];
  if (!config) throw new Error(`Provider ${credential.provider} não suportado`);
  const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credential.client_id,
    client_secret: credential.client_secret,
    scope: config.scopes,
  });
  const resp = await fetchWithMtls(`${baseUrl}${config.tokenPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }, httpClient);
  const respText = await resp.text();
  if (!resp.ok) throw new Error(`Token failed: ${resp.status} - ${respText}`);
  const data = JSON.parse(respText);
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  await supabase.from("platform_bank_credentials").update({
    access_token: data.access_token,
    token_expires_at: expiresAt,
  }).eq("id", credential.id);
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) throw new Error("Não autenticado");

    const { pix_charge_id } = await req.json();
    if (!pix_charge_id) throw new Error("pix_charge_id obrigatório");

    // Get pix charge
    const { data: charge, error: chErr } = await supabase
      .from("platform_pix_charges")
      .select("*")
      .eq("id", pix_charge_id)
      .single();
    if (chErr || !charge) throw new Error("Cobrança PIX não encontrada");

    // Already paid?
    if (charge.status === "concluida") {
      return new Response(JSON.stringify({ status: "concluida", paid: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credential
    const { data: credential } = await supabase
      .from("platform_bank_credentials")
      .select("*")
      .eq("id", charge.credential_id)
      .single();
    if (!credential) throw new Error("Credencial não encontrada");

    // mTLS
    let httpClient: any = null;
    if (credential.certificate_base64 && credential.certificate_key_base64) {
      httpClient = createMtlsClient(credential.certificate_base64, credential.certificate_key_base64);
    }

    const accessToken = await getAccessToken(supabase, credential, httpClient);
    const config = BANK_CONFIGS[credential.provider];
    if (!config) throw new Error(`Provider ${credential.provider} não suportado`);

    const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;

    // Query PIX cob status
    const resp = await fetchWithMtls(`${baseUrl}${config.pixPath}/${charge.txid}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${accessToken}` },
    }, httpClient);

    const respText = await resp.text();
    let data: any;
    try { data = JSON.parse(respText); } catch { data = { raw: respText }; }

    if (!resp.ok) {
      return new Response(JSON.stringify({ status: charge.status, paid: false, api_error: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[check-pix-status] txid=${charge.txid} status=${data.status}`);

    // Inter PIX statuses: ATIVA, CONCLUIDA, REMOVIDA_PELO_USUARIO_RECEBEDOR, REMOVIDA_PELO_PSP
    if (data.status === "CONCLUIDA") {
      const paidAmount = data.pix?.[0]?.valor ? parseFloat(data.pix[0].valor) : charge.amount;
      const paidAt = data.pix?.[0]?.horario || new Date().toISOString();

      // Update pix charge
      await supabase.from("platform_pix_charges").update({
        status: "concluida",
        paid_amount: paidAmount,
        paid_at: paidAt,
      }).eq("id", charge.id);

      // Mark invoice as paid + reactivate subscription
      if (charge.tenant_invoice_id) {
        await markInvoicePaidAndReactivate(supabase, charge.tenant_invoice_id, paidAmount, paidAt);
      }

      return new Response(JSON.stringify({ status: "concluida", paid: true, paid_amount: paidAmount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: data.status?.toLowerCase() || charge.status, paid: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[check-pix-status] Error:", error);
    return new Response(JSON.stringify({ error: "Erro ao verificar status PIX" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function markInvoicePaidAndReactivate(supabase: any, invoiceId: string, paidAmount: number, paidAt: string) {
  const now = paidAt || new Date().toISOString();

  // Get invoice
  const { data: invoice } = await supabase
    .from("tenant_invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (!invoice || invoice.status === "quitada") return;

  // Mark paid
  await supabase.from("tenant_invoices").update({
    status: "quitada",
    paid_amount: paidAmount,
    paid_at: now,
    payment_method: "pix",
  }).eq("id", invoiceId);

  // Reactivate subscription
  const tenantId = invoice.tenant_id;
  if (!tenantId) return;

  const { data: sub } = await supabase
    .from("tenant_subscriptions")
    .select("id, status, blocked_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub && (sub.status === "expirado" || sub.status === "bloqueado" || sub.blocked_at)) {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);
    await supabase.from("tenant_subscriptions").update({
      status: "ativo",
      expires_at: newExpiry.toISOString(),
      blocked_at: null,
      blocked_reason: null,
    } as any).eq("id", sub.id);
    console.log(`[check-pix-status] Subscription reactivated for tenant ${tenantId}`);
  }

  // Notify admins
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "gerente"]);

  if (admins) {
    for (const admin of admins) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        title: "Pagamento PIX Confirmado",
        message: `Fatura #${invoice.invoice_number} paga via PIX. Assinatura reativada.`,
        category: "sistema",
        reference_type: "invoice",
        reference_id: invoiceId,
        tenant_id: tenantId,
      });
    }
  }
}
