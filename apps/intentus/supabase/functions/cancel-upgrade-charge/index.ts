import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth: Bearer token, check if superadmin for cross-tenant access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) throw new Error("Não autenticado");

    // Check if user is superadmin
    const { data: superadminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "superadmin")
      .maybeSingle();
    const isSuperAdmin = !!superadminRole;

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id obrigatório");

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from("tenant_invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();
    if (invErr || !invoice) throw new Error("Fatura não encontrada");

    // Validate invoice belongs to user's tenant (skip for superadmin)
    if (!isSuperAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      if (!profile?.tenant_id || profile.tenant_id !== invoice.tenant_id) {
        throw new Error("Fatura não pertence ao seu tenant");
      }
    }

    if (invoice.status !== "aberta") {
      return new Response(JSON.stringify({ success: true, message: "Fatura já não está aberta" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let pixCancelled = false;
    let stripeCancelled = false;

    // 1. Cancel PIX charge if exists
    const { data: pixCharge } = await supabase
      .from("platform_pix_charges")
      .select("*")
      .eq("tenant_invoice_id", invoice_id)
      .in("status", ["ativa", "pendente"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pixCharge) {
      const codigoSolicitacao = (pixCharge.provider_response as any)?.codigoSolicitacao || pixCharge.txid;

      if (codigoSolicitacao) {
        // Find platform bank credential
        const { data: credential } = await supabase
          .from("platform_bank_credentials")
          .select("*")
          .eq("active", true)
          .limit(1)
          .single();

        if (credential) {
          let httpClient: any = null;
          if (credential.certificate_base64 && credential.certificate_key_base64) {
            httpClient = createMtlsClient(credential.certificate_base64, credential.certificate_key_base64);
          }

          try {
            const accessToken = await getAccessToken(supabase, credential, httpClient);
            const config = BANK_CONFIGS[credential.provider];
            const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;

            const cancelUrl = `${baseUrl}${config.cobrancaPath}/${codigoSolicitacao}/cancelar`;
            console.log(`[cancel-upgrade-charge] Cancelling PIX at: ${cancelUrl}`);

            const cancelResp = await fetchWithMtls(cancelUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ motivoCancelamento: "ACESSO" }),
            }, httpClient);

            const cancelText = await cancelResp.text();
            console.log(`[cancel-upgrade-charge] PIX cancel response: ${cancelResp.status} - ${cancelText}`);

            pixCancelled = cancelResp.ok || cancelResp.status === 204;
          } catch (e) {
            console.error("[cancel-upgrade-charge] PIX cancel error:", e);
          }
        }
      }

      // Update PIX charge status regardless
      await supabase
        .from("platform_pix_charges")
        .update({ status: "cancelada" } as any)
        .eq("id", pixCharge.id);
      pixCancelled = true;
    }

    // 2. Cancel Stripe PaymentIntent if exists
    const notes = (invoice.notes as string) || "";
    const piMatch = notes.match(/pi_[a-zA-Z0-9]+/);
    if (piMatch) {
      try {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2025-08-27.basil",
        });
        const pi = await stripe.paymentIntents.retrieve(piMatch[0]);
        if (["requires_payment_method", "requires_confirmation", "requires_action", "processing"].includes(pi.status)) {
          await stripe.paymentIntents.cancel(piMatch[0]);
          stripeCancelled = true;
          console.log(`[cancel-upgrade-charge] Stripe PI ${piMatch[0]} cancelled`);
        }
      } catch (e) {
        console.error("[cancel-upgrade-charge] Stripe cancel error:", e);
      }
    }

    // 3. Cancel the invoice
    await supabase
      .from("tenant_invoices")
      .update({ status: "cancelada" })
      .eq("id", invoice_id);

    return new Response(JSON.stringify({
      success: true,
      pix_cancelled: pixCancelled,
      stripe_cancelled: stripeCancelled,
      message: "Cobrança cancelada com sucesso",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[cancel-upgrade-charge] Error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    const safeMsg = /fatura|tenant|autenticado/i.test(msg) ? msg : "Erro ao cancelar cobrança";
    return new Response(JSON.stringify({ error: safeMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
