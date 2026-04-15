import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BANK_CONFIGS: Record<string, any> = {
  inter: {
    sandbox: "https://cdpj-sandbox.partners.uatinter.co",
    production: "https://cdpj.partners.bancointer.com.br",
    tokenPath: "/oauth/v2/token",
    boletoPath: "/cobranca/v3/cobrancas",
    scopes: "boleto-cobranca.write boleto-cobranca.read",
  },
};

function decodePem(base64: string): string {
  // If already PEM formatted, return as-is
  if (base64.includes("-----BEGIN")) return base64;
  // Otherwise decode from base64
  try {
    return atob(base64);
  } catch {
    return base64;
  }
}

function createMtlsClient(certBase64: string, keyBase64: string): any {
  const cert = decodePem(certBase64);
  const key = decodePem(keyBase64);
  
  console.log(`[platform-bank] Cert starts with: ${cert.slice(0, 40)}...`);
  console.log(`[platform-bank] Key starts with: ${key.slice(0, 40)}...`);

  // Try Deno.createHttpClient for mTLS
  if (typeof Deno.createHttpClient === "function") {
    console.log("[platform-bank] Deno.createHttpClient is available! Using mTLS.");
    return Deno.createHttpClient({ cert, key });
  }
  
  console.warn("[platform-bank] Deno.createHttpClient NOT available. mTLS not possible in this runtime.");
  return null;
}

async function fetchWithMtls(url: string, options: RequestInit, httpClient: any): Promise<Response> {
  if (httpClient) {
    return fetch(url, { ...options, client: httpClient } as any);
  }
  return fetch(url, options);
}

async function getAccessToken(supabase: any, credential: any, httpClient: any): Promise<string> {
  if (credential.access_token && credential.token_expires_at) {
    const expiresAt = new Date(credential.token_expires_at);
    if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
      console.log("[platform-bank] Using cached token");
      return credential.access_token;
    }
  }

  const config = BANK_CONFIGS[credential.provider];
  if (!config) throw new Error(`Provider ${credential.provider} não suportado`);

  const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;
  const tokenUrl = `${baseUrl}${config.tokenPath}`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credential.client_id,
    client_secret: credential.client_secret,
    scope: config.scopes,
  });

  console.log(`[platform-bank] Requesting token from: ${tokenUrl}`);

  const resp = await fetchWithMtls(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }, httpClient);

  const respText = await resp.text();
  console.log(`[platform-bank] Token response status: ${resp.status}`);
  console.log(`[platform-bank] Token response: ${respText.slice(0, 500)}`);

  if (!resp.ok) {
    throw new Error(`Token request failed: ${resp.status} - ${respText}`);
  }

  const data = JSON.parse(respText);
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  await supabase.from("platform_bank_credentials").update({
    access_token: data.access_token,
    token_expires_at: expiresAt,
  }).eq("id", credential.id);

  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify user
    const userToken = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: userErr } = await userClient.auth.getUser(userToken);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, credential_id, ...params } = await req.json();
    console.log(`[platform-bank] Action: ${action}, credential_id: ${credential_id}`);

    // Fetch platform credential
    const { data: credential, error: credErr } = await supabase
      .from("platform_bank_credentials")
      .select("*")
      .eq("id", credential_id)
      .eq("active", true)
      .single();

    if (credErr || !credential) {
      return new Response(JSON.stringify({ error: "Credencial não encontrada ou inativa", details: credErr?.message }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[platform-bank] Provider: ${credential.provider}, env: ${credential.api_environment}`);
    console.log(`[platform-bank] Has cert: ${!!credential.certificate_base64}, Has key: ${!!credential.certificate_key_base64}`);

    // Create mTLS client if certificates available
    let httpClient: any = null;
    if (credential.certificate_base64 && credential.certificate_key_base64) {
      httpClient = createMtlsClient(credential.certificate_base64, credential.certificate_key_base64);
    }

    // ─── TEST CONNECTION ───
    if (action === "test_connection") {
      try {
        const accessToken = await getAccessToken(supabase, credential, httpClient);
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Conexão com o banco estabelecida com sucesso! Token OAuth obtido.",
          token_preview: accessToken.slice(0, 10) + "...",
          mtls_available: typeof Deno.createHttpClient === "function",
          mtls_used: !!httpClient,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: err.message,
          message: "Falha ao conectar com a API do banco.",
          mtls_available: typeof Deno.createHttpClient === "function",
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── CREATE BOLETO ───
    if (action === "create_boleto") {
      const accessToken = await getAccessToken(supabase, credential, httpClient);
      
      const config = BANK_CONFIGS[credential.provider];
      const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;

      // Use invoice_number (AAAAMM0001) as nossoNumero when available
      const seuNumero = params.invoice_number || params.seu_numero || crypto.randomUUID().slice(0, 15);

      const payload = {
        seuNumero,
        valorNominal: params.amount,
        dataVencimento: params.due_date,
        numDiasAgenda: 30,
        formasRecebimento: ["BOLETO"],
        pagador: {
          cpfCnpj: params.payer_document.replace(/\D/g, ""),
          tipoPessoa: params.payer_document.replace(/\D/g, "").length > 11 ? "JURIDICA" : "FISICA",
          nome: params.payer_name,
          email: params.payer_email || "",
          endereco: params.payer_address || "",
          bairro: params.payer_neighborhood || "",
          cidade: params.payer_city || "",
          uf: params.payer_state || "",
          cep: params.payer_zip || "",
        },
      };

      console.log(`[platform-bank] Creating boleto at: ${baseUrl}${config.boletoPath}`);

      const resp = await fetchWithMtls(`${baseUrl}${config.boletoPath}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }, httpClient);

      const respText = await resp.text();
      console.log(`[platform-bank] Boleto response: ${resp.status} - ${respText.slice(0, 1000)}`);

      let data: any;
      try { data = JSON.parse(respText); } catch { data = { raw: respText }; }

      if (!resp.ok) {
        return new Response(JSON.stringify({ success: false, error: `Erro ${resp.status}`, details: data }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: boleto, error: saveErr } = await supabase.from("platform_boletos").insert({
        credential_id,
        tenant_invoice_id: params.tenant_invoice_id || null,
        amount: params.amount,
        due_date: params.due_date,
        payer_name: params.payer_name,
        payer_document: params.payer_document,
        payer_address: params.payer_address || null,
        status: "em_processamento",
        provider_id: data.codigoSolicitacao,
        provider_response: data,
        created_by: user.id,
      } as any).select().single();

      return new Response(JSON.stringify({ success: true, boleto, api_response: data, save_error: saveErr?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CANCEL BOLETO (Inter V3) ───
    if (action === "cancel_boleto") {
      const accessToken = await getAccessToken(supabase, credential, httpClient);
      const config = BANK_CONFIGS[credential.provider];
      const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;

      const codigoSolicitacao = params.codigo_solicitacao;
      if (!codigoSolicitacao) {
        return new Response(JSON.stringify({ error: "codigo_solicitacao é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cancelUrl = `${baseUrl}${config.boletoPath}/${codigoSolicitacao}/cancelar`;
      console.log(`[platform-bank] Cancelling boleto at: ${cancelUrl}`);

      const resp = await fetchWithMtls(cancelUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ motivoCancelamento: "APEDIDODOCLIENTE" }),
      }, httpClient);

      const respText = await resp.text();
      console.log(`[platform-bank] Cancel response: ${resp.status} - ${respText.slice(0, 500)}`);

      let data: any;
      try { data = JSON.parse(respText); } catch { data = { raw: respText }; }

      if (!resp.ok && resp.status !== 204) {
        return new Response(JSON.stringify({ success: false, error: `Erro ${resp.status}`, details: data }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update local record if boleto_id provided
      if (params.boleto_id) {
        await supabase.from("platform_boletos").update({ status: "cancelado" } as any).eq("id", params.boleto_id);
      }

      return new Response(JSON.stringify({ success: true, message: "Cobrança cancelada com sucesso", details: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use: test_connection, create_boleto, cancel_boleto" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[platform-bank] Error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    const safeMsg = /duplicate key/i.test(msg) ? "Registro já existe"
      : /not found/i.test(msg) ? "Recurso não encontrado"
      : /violates.*constraint/i.test(msg) ? "Dados inválidos"
      : "Erro ao processar solicitação";
    return new Response(JSON.stringify({ error: safeMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
