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
  console.log(`[cancel-pix-checkout] ${step}${d}`);
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
    log("Request received", { checkout_id });

    // Get checkout record
    const { data: checkout, error: coErr } = await supabase
      .from("pix_checkouts")
      .select("*")
      .eq("id", checkout_id)
      .single();
    if (coErr || !checkout) throw new Error("Checkout não encontrado");

    // Already paid — cannot cancel
    if (checkout.status === "paid") {
      return new Response(JSON.stringify({
        success: false,
        error: "Checkout já foi pago, não é possível cancelar",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already cancelled
    if (checkout.status === "cancelled") {
      return new Response(JSON.stringify({ success: true, already_cancelled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bankCancelled = false;

    // Cancel at Banco Inter if we have a pix_charge
    if (checkout.pix_charge_id) {
      const { data: charge } = await supabase
        .from("platform_pix_charges")
        .select("*")
        .eq("id", checkout.pix_charge_id)
        .single();

      if (charge && charge.status === "ativa") {
        try {
          const { data: credential } = await supabase
            .from("platform_bank_credentials")
            .select("*")
            .eq("id", charge.credential_id)
            .single();

          if (credential) {
            let httpClient: any = null;
            if (credential.certificate_base64 && credential.certificate_key_base64) {
              httpClient = createMtlsClient(credential.certificate_base64, credential.certificate_key_base64);
            }

            const accessToken = await getAccessToken(supabase, credential, httpClient);
            const config = BANK_CONFIGS[credential.provider];
            if (config) {
              const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;
              const cancelUrl = `${baseUrl}${config.cobrancaPath}/${charge.txid}/cancelar`;

              log("Cancelling at Inter", { cancelUrl });

              const cancelResp = await fetchWithMtls(cancelUrl, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ motivoCancelamento: "ACME" }),
              }, httpClient);

              const cancelText = await cancelResp.text();
              log("Inter cancel response", { status: cancelResp.status, body: cancelText.slice(0, 300) });

              // 204 or 200 = success, 409 = already cancelled/expired
              if (cancelResp.ok || cancelResp.status === 204 || cancelResp.status === 409) {
                bankCancelled = true;
              }
            }
          }
        } catch (bankErr: any) {
          log("Bank cancel error (non-fatal)", { message: bankErr.message });
        }

        // Update platform_pix_charges status
        await supabase.from("platform_pix_charges").update({
          status: "cancelada",
        }).eq("id", charge.id);
      } else {
        // Charge already not active
        bankCancelled = true;
      }
    }

    // Update checkout status
    await supabase.from("pix_checkouts").update({
      status: "cancelled",
    }).eq("id", checkout_id);

    log("Checkout cancelled", { checkout_id, bankCancelled });

    return new Response(JSON.stringify({
      success: true,
      bank_cancelled: bankCancelled,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    log("Error", { message: error?.message || String(error) });
    return new Response(JSON.stringify({ error: error?.message || "Erro ao cancelar PIX checkout" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
