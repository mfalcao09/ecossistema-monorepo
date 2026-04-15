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
  console.log(`[create-pix-checkout] ${step}${d}`);
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

    const { email, planName, planPriceId, amount, companyData } = await req.json();
    if (!email || !planPriceId || !amount) {
      throw new Error("email, planPriceId e amount são obrigatórios");
    }
    log("Request received", { email, planName, planPriceId, amount });

    // Get platform bank credential
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

    // Payer data from companyData
    const payerDocument = (companyData?.documento || "").replace(/\D/g, "");
    const payerName = companyData?.nomeFantasia || companyData?.razaoSocial || email;
    const seuNumero = `PIX-${Date.now().toString(36).toUpperCase()}`;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDate = tomorrow.toISOString().split("T")[0];

    const payload = {
      seuNumero,
      valorNominal: Number(amount),
      dataVencimento: dueDate,
      numDiasAgenda: 1,
      formasRecebimento: ["BOLETO", "PIX"],
      pagador: {
        cpfCnpj: payerDocument || "00000000000",
        tipoPessoa: payerDocument.length > 11 ? "JURIDICA" : "FISICA",
        nome: payerName,
        email: companyData?.email || email,
        endereco: "Nao informado",
        cidade: "Sao Paulo",
        uf: "SP",
        cep: "01001000",
        numero: "SN",
      },
    };

    log("Creating PIX cobrança", { url: `${baseUrl}${config.cobrancaPath}` });

    const resp = await fetchWithMtls(`${baseUrl}${config.cobrancaPath}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }, httpClient);

    const respText = await resp.text();
    log("Response", { status: resp.status, body: respText.slice(0, 500) });

    let data: any;
    try { data = JSON.parse(respText); } catch { data = { raw: respText }; }

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Erro PIX: ${resp.status}`, details: data }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const codigoSolicitacao = data.codigoSolicitacao || "";
    let qrCode = "";

    // Poll for PIX copia e cola
    if (codigoSolicitacao) {
      const detailUrl = `${baseUrl}${config.cobrancaPath}/${codigoSolicitacao}`;
      for (let attempt = 1; attempt <= 5; attempt++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          log(`Charge detail attempt ${attempt}/5`);
          const detailResp = await fetchWithMtls(detailUrl, {
            method: "GET",
            headers: { "Authorization": `Bearer ${accessToken}` },
          }, httpClient);
          if (detailResp.ok) {
            const detailData = JSON.parse(await detailResp.text());
            qrCode = detailData?.pix?.pixCopiaECola || "";
            if (qrCode) {
              log(`pixCopiaECola obtained on attempt ${attempt}`);
              break;
            }
          }
        } catch (e) {
          log(`Detail attempt ${attempt} error`, { error: String(e) });
        }
      }
    }

    const txid = codigoSolicitacao || crypto.randomUUID().replace(/-/g, "").slice(0, 26);

    // Save platform_pix_charges
    const { data: insertedCharge } = await supabase
      .from("platform_pix_charges")
      .insert({
        credential_id: credential.id,
        txid,
        amount: Number(amount),
        status: "ativa",
        qr_code: qrCode,
        provider_response: data,
        expiration_seconds: 3600,
        created_by: "00000000-0000-0000-0000-000000000001", // system
      } as any)
      .select("id")
      .single();

    // Save pix_checkouts
    const { data: checkout, error: checkoutErr } = await supabase
      .from("pix_checkouts")
      .insert({
        email,
        plan_price_id: planPriceId,
        plan_name: planName || "",
        company_data: companyData || {},
        status: "pending",
        pix_charge_id: insertedCharge?.id || null,
        txid,
        qr_code: qrCode,
        amount: Number(amount),
      })
      .select("id")
      .single();

    if (checkoutErr) log("Error saving pix_checkout", { error: checkoutErr.message });

    log("PIX checkout created", { checkout_id: checkout?.id, txid });

    return new Response(JSON.stringify({
      checkout_id: checkout?.id || null,
      pix_charge_id: insertedCharge?.id || null,
      txid,
      qr_code: qrCode,
      amount: Number(amount),
      expiration: 3600,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    log("Error", { message: error?.message || String(error) });
    return new Response(JSON.stringify({ error: error?.message || "Erro ao criar PIX checkout" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
