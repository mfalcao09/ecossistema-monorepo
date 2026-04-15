import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BANK_CONFIGS: Record<string, any> = {
  inter: {
    sandbox: "https://cdpj-sandbox.partners.uatinter.co",
    production: "https://cdpj.partners.bancointer.com.br",
    tokenPath: "/oauth/v2/token",
    cobrancaPath: "/cobranca/v3/cobrancas",
    scopes: "boleto-cobranca.write boleto-cobranca.read",
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

const log = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[check-pix-checkout-status] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth via PROVISION_SECRET
    const secret = req.headers.get("x-webhook-secret");
    const expected = Deno.env.get("PROVISION_SECRET");
    if (!secret || secret !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { checkout_id } = await req.json();
    if (!checkout_id) throw new Error("checkout_id obrigatório");

    // Get checkout record
    const { data: checkout, error: coErr } = await supabase
      .from("pix_checkouts")
      .select("*")
      .eq("id", checkout_id)
      .single();
    if (coErr || !checkout) throw new Error("Checkout não encontrado");

    // Already paid?
    if (checkout.status === "paid") {
      return new Response(JSON.stringify({
        status: "paid",
        paid: true,
        checkout,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!checkout.pix_charge_id) {
      return new Response(JSON.stringify({ status: checkout.status, paid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pix charge
    const { data: charge } = await supabase
      .from("platform_pix_charges")
      .select("*")
      .eq("id", checkout.pix_charge_id)
      .single();
    if (!charge) throw new Error("Cobrança PIX não encontrada");

    // Already concluded in DB?
    if (charge.status === "concluida") {
      await supabase.from("pix_checkouts").update({
        status: "paid",
        paid_at: charge.paid_at || new Date().toISOString(),
      }).eq("id", checkout_id);

      const { data: updatedCheckout } = await supabase
        .from("pix_checkouts")
        .select("*")
        .eq("id", checkout_id)
        .single();

      return new Response(JSON.stringify({
        status: "paid",
        paid: true,
        checkout: updatedCheckout,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query Inter API for status
    const { data: credential } = await supabase
      .from("platform_bank_credentials")
      .select("*")
      .eq("id", charge.credential_id)
      .single();
    if (!credential) throw new Error("Credencial não encontrada");

    let httpClient: any = null;
    if (credential.certificate_base64 && credential.certificate_key_base64) {
      httpClient = createMtlsClient(credential.certificate_base64, credential.certificate_key_base64);
    }

    const accessToken = await getAccessToken(supabase, credential, httpClient);
    const config = BANK_CONFIGS[credential.provider];
    if (!config) throw new Error(`Provider ${credential.provider} não suportado`);
    const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;

    // Check cobrança status via Inter V3
    const detailUrl = `${baseUrl}${config.cobrancaPath}/${charge.txid}`;
    log("Checking status", { detailUrl });

    const resp = await fetchWithMtls(detailUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${accessToken}` },
    }, httpClient);

    const respText = await resp.text();
    let data: any;
    try { data = JSON.parse(respText); } catch { data = { raw: respText }; }

    if (!resp.ok) {
      log("API error", { status: resp.status });
      return new Response(JSON.stringify({ status: checkout.status, paid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Inter status", { situacao: data.situacao });

    // Inter V3 uses "situacao": "RECEBIDO" for paid cobrancas
    const isPaid = data.situacao === "RECEBIDO" || data.situacao === "MARCADO_RECEBIDO" ||
      (data.pix && Array.isArray(data.pix) && data.pix.length > 0);

    if (isPaid) {
      const paidAmount = data.pix?.[0]?.valor ? parseFloat(data.pix[0].valor) :
        data.valorTotalRecebido ? parseFloat(data.valorTotalRecebido) : Number(charge.amount);
      const paidAt = data.pix?.[0]?.horario || new Date().toISOString();

      // Update pix charge
      await supabase.from("platform_pix_charges").update({
        status: "concluida",
        paid_amount: paidAmount,
        paid_at: paidAt,
      }).eq("id", charge.id);

      // Update checkout
      await supabase.from("pix_checkouts").update({
        status: "paid",
        paid_at: paidAt,
      }).eq("id", checkout_id);

      const { data: updatedCheckout } = await supabase
        .from("pix_checkouts")
        .select("*")
        .eq("id", checkout_id)
        .single();

      log("Payment confirmed", { checkout_id, paidAmount });

      return new Response(JSON.stringify({
        status: "paid",
        paid: true,
        paid_amount: paidAmount,
        checkout: updatedCheckout,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      status: "pending",
      paid: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    log("Error", { message: error?.message || String(error) });
    return new Response(JSON.stringify({ error: error?.message || "Erro ao verificar status" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
