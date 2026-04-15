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
  if (!config) throw new Error(`Provider ${credential.provider} não suportado para PIX`);
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

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error("invoice_id obrigatório");

    // Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from("tenant_invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();
    if (invErr || !invoice) throw new Error("Fatura não encontrada");
    if (invoice.status === "quitada") throw new Error("Fatura já está quitada");
    if (invoice.status === "cancelada") throw new Error("Fatura está cancelada");

    const net = Number(invoice.amount) - Number(invoice.discount || 0);

    // Find active platform credential
    const { data: credential, error: credErr } = await supabase
      .from("platform_bank_credentials")
      .select("*")
      .eq("active", true)
      .limit(1)
      .single();
    if (credErr || !credential) throw new Error("Nenhuma credencial bancária ativa configurada");

    // mTLS
    let httpClient: any = null;
    if (credential.certificate_base64 && credential.certificate_key_base64) {
      httpClient = createMtlsClient(credential.certificate_base64, credential.certificate_key_base64);
    }

    const accessToken = await getAccessToken(supabase, credential, httpClient);
    const config = BANK_CONFIGS[credential.provider];
    if (!config) throw new Error(`Provider ${credential.provider} não suportado`);

    const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;

    // Fetch tenant info for payer data
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("name, cnpj, settings")
      .eq("id", invoice.tenant_id)
      .single();

    const payerDocument = (tenantData?.cnpj || "").replace(/\D/g, "");
    const payerName = tenantData?.name || "Cliente";
    const settings = (typeof tenantData?.settings === "object" && tenantData?.settings) ? tenantData.settings as Record<string, any> : {};

    // Use Inter V3 Cobrança API with formasRecebimento: ["PIX"]
    const seuNumero = invoice.invoice_number || crypto.randomUUID().slice(0, 15);

    const payload = {
      seuNumero,
      valorNominal: net,
      dataVencimento: invoice.due_date,
      numDiasAgenda: 1,
      formasRecebimento: ["BOLETO", "PIX"],
      pagador: {
        cpfCnpj: payerDocument,
        tipoPessoa: payerDocument.length > 11 ? "JURIDICA" : "FISICA",
        nome: payerName,
        email: settings?.email || "",
        endereco: settings?.endereco || "Nao informado",
        cidade: settings?.cidade || "Sao Paulo",
        uf: settings?.uf || "SP",
        cep: (settings?.cep || "01001000").replace(/\D/g, ""),
        numero: settings?.numero || "SN",
      },
    };

    console.log(`[pay-invoice-pix] Creating PIX cobrança at: ${baseUrl}${config.cobrancaPath}`);
    console.log(`[pay-invoice-pix] Payload:`, JSON.stringify(payload));

    const resp = await fetchWithMtls(`${baseUrl}${config.cobrancaPath}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }, httpClient);

    const respText = await resp.text();
    console.log(`[pay-invoice-pix] Response: ${resp.status} - ${respText.slice(0, 1000)}`);

    let data: any;
    try { data = JSON.parse(respText); } catch { data = { raw: respText }; }

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Erro PIX: ${resp.status}`, details: data }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const codigoSolicitacao = data.codigoSolicitacao || "";

    // Fetch PIX data from the cobrança details (Inter V3: GET /cobrancas/{codigoSolicitacao})
    let qrCode = "";

    if (codigoSolicitacao) {
      const detailUrl = `${baseUrl}${config.cobrancaPath}/${codigoSolicitacao}`;
      const MAX_RETRIES = 5;
      const RETRY_DELAY_MS = 3000;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        try {
          console.log(`[pay-invoice-pix] Charge detail attempt ${attempt}/${MAX_RETRIES}: ${detailUrl}`);

          const detailResp = await fetchWithMtls(detailUrl, {
            method: "GET",
            headers: { "Authorization": `Bearer ${accessToken}` },
          }, httpClient);

          const detailText = await detailResp.text();
          console.log(`[pay-invoice-pix] Detail response ${attempt}: ${detailResp.status} - ${detailText.slice(0, 1000)}`);

          if (detailResp.ok) {
            const detailData = JSON.parse(detailText);
            qrCode = detailData?.pix?.pixCopiaECola || "";
            if (qrCode) {
              console.log(`[pay-invoice-pix] pixCopiaECola obtained on attempt ${attempt}`);
              break;
            }
          }
        } catch (e) {
          console.error(`[pay-invoice-pix] Detail attempt ${attempt} error:`, e);
        }
      }

      if (!qrCode) {
        console.warn("[pay-invoice-pix] Could not obtain pixCopiaECola after all retries");
      }
    }

    const txid = codigoSolicitacao || crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    // Save PIX charge
    await supabase.from("platform_pix_charges").insert({
      credential_id: credential.id,
      tenant_invoice_id: invoice_id,
      txid,
      amount: net,
      status: "ativa",
      qr_code: qrCode,
      provider_response: data,
      expiration_seconds: 3600,
      created_by: user.id,
    } as any);

    // Update invoice
    await supabase.from("tenant_invoices").update({
      payment_method: "pix",
      notes: `PIX ref: ${txid}` + (invoice.notes ? `\n${invoice.notes}` : ""),
    }).eq("id", invoice_id);

    const { data: insertedCharge } = await supabase
      .from("platform_pix_charges")
      .select("id")
      .eq("txid", txid)
      .single();

    return new Response(JSON.stringify({
      pix_charge_id: insertedCharge?.id || null,
      txid,
      qr_code: qrCode,
      amount: net,
      expiration: 3600,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[pay-invoice-pix] Error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    const safeMsg = /fatura|quitada|cancelada/i.test(msg) ? msg : "Erro ao gerar PIX";
    return new Response(JSON.stringify({ error: safeMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
