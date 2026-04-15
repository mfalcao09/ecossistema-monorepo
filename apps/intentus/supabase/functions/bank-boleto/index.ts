import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============= BANK API CONFIGURATIONS =============

const BANK_CONFIGS = {
  inter: {
    sandbox: "https://cdpj-sandbox.partners.uatinter.co",
    production: "https://cdpj.partners.bancointer.com.br",
    tokenPath: "/oauth/v2/token",
    boletoPath: "/cobranca/v3/cobrancas",
    consultaPath: "/cobranca/v3/cobrancas/{codigoSolicitacao}",
    pixPath: "/pix/v2/cob",
    scopes: "boleto-cobranca.write boleto-cobranca.read cob.write cob.read",
  },
  itau: {
    sandbox: "https://devportal.itau.com.br/sandboxapi",
    production: "https://secure.api.itau",
    tokenPath: "/api/oauth/token",
    boletoPath: "/itau-ep9-gtw-cash-boletos-conciliation-ext-v2/v2/boletos",
    pixPath: "/pix/cob",
    scopes: "",
  },
  sicoob: {
    sandbox: "https://sandbox.sicoob.com.br",
    production: "https://api.sicoob.com.br",
    tokenPath: "/cooperado/oauth/token",
    boletoPath: "/cobranca-bancaria/v2/boletos",
    pixPath: "/pix/api/v2/cob",
    scopes: "cobranca_boletos_incluir cobranca_boletos_consultar cob.write cob.read",
  },
};

// ============= TOKEN MANAGEMENT =============

async function getAccessToken(
  supabase: any,
  credential: any
): Promise<string> {
  // Check if existing token is still valid (with 5min buffer)
  if (credential.access_token && credential.token_expires_at) {
    const expiresAt = new Date(credential.token_expires_at);
    if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
      return credential.access_token;
    }
  }

  const config = BANK_CONFIGS[credential.provider as keyof typeof BANK_CONFIGS];
  const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;
  const tokenUrl = `${baseUrl}${config.tokenPath}`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credential.client_id,
    client_secret: credential.client_secret,
    scope: config.scopes,
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Token request failed for ${credential.provider}: ${resp.status} - ${errText}`);
  }

  const data = await resp.json();
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  // Cache token in database
  await supabase.from("bank_api_credentials").update({
    access_token: data.access_token,
    token_expires_at: expiresAt,
  }).eq("id", credential.id);

  return data.access_token;
}

// ============= BOLETO CREATION PER PROVIDER =============

function buildInterBoletoPayload(params: any) {
  return {
    seuNumero: params.nosso_numero || params.installment_id?.slice(0, 15),
    valorNominal: params.amount,
    dataVencimento: params.due_date,
    numDiasAgenda: 30,
    formasRecebimento: params.formas_recebimento || ["BOLETO"],
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
}

function buildItauBoletoPayload(params: any) {
  return {
    etapa_processo_boleto: "efetivacao",
    beneficiario: { id_beneficiario: params.extra_config?.beneficiario_id || "" },
    dado_boleto: {
      tipo_boleto: "a vista",
      valor_total_titulo: { valor: params.amount.toFixed(2), moeda: { codigo_moeda: 9, quantidade_casas_decimais: 2 } },
      pagador: {
        pessoa: {
          nome_pessoa: params.payer_name,
          tipo_pessoa: { codigo_tipo_pessoa: params.payer_document.replace(/\D/g, "").length > 11 ? "J" : "F" },
          tipo_documento: { codigo_tipo_documento: params.payer_document.replace(/\D/g, "").length > 11 ? 2 : 1 },
          numero_cadastro_nacional_pessoa: params.payer_document.replace(/\D/g, ""),
        },
      },
      dados_individuais_boleto: [{
        numero_nosso_numero: params.nosso_numero || "",
        data_vencimento: params.due_date,
        valor_titulo: { valor: params.amount.toFixed(2) },
      }],
    },
  };
}

function buildSicoobBoletoPayload(params: any) {
  return {
    numeroContrato: params.extra_config?.numero_contrato || 0,
    modalidade: 1,
    numeroContaCorrente: params.extra_config?.conta_corrente || 0,
    especieDocumento: "DM",
    dataEmissao: new Date().toISOString().split("T")[0],
    seuNumero: params.nosso_numero || params.installment_id?.slice(0, 15),
    identificacaoBoletoEmpresa: params.installment_id?.slice(0, 25) || "",
    identificacaoEmissaoBoleto: 2,
    valor: params.amount,
    dataVencimento: params.due_date,
    pagador: {
      numeroCpfCnpj: params.payer_document.replace(/\D/g, ""),
      nome: params.payer_name,
      endereco: params.payer_address || "",
      bairro: params.payer_neighborhood || "",
      cidade: params.payer_city || "",
      cep: params.payer_zip || "",
      uf: params.payer_state || "",
    },
  };
}

async function createBoleto(token: string, credential: any, params: any) {
  const provider = credential.provider as keyof typeof BANK_CONFIGS;
  const config = BANK_CONFIGS[provider];
  const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;

  let payload: any;
  switch (provider) {
    case "inter": payload = buildInterBoletoPayload(params); break;
    case "itau": payload = buildItauBoletoPayload(params); break;
    case "sicoob": payload = buildSicoobBoletoPayload(params); break;
  }

  const resp = await fetch(`${baseUrl}${config.boletoPath}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Boleto creation failed (${provider}): ${resp.status} - ${JSON.stringify(data)}`);
  }

  // Normalize response per provider
  switch (provider) {
    case "inter":
      // V3 is ASYNC: POST returns only codigoSolicitacao.
      // nossoNumero, linhaDigitavel, etc. come later via webhook or GET.
      return {
        nosso_numero: null, // filled async via webhook
        linha_digitavel: null, // filled async via webhook
        codigo_barras: null, // filled async via webhook
        provider_id: data.codigoSolicitacao,
        status: "em_processamento", // async status
        provider_response: data,
      };
    case "itau":
      return {
        nosso_numero: data.dado_boleto?.dados_individuais_boleto?.[0]?.numero_nosso_numero,
        linha_digitavel: data.dado_boleto?.dados_individuais_boleto?.[0]?.texto_linha_digitavel,
        codigo_barras: data.dado_boleto?.dados_individuais_boleto?.[0]?.numero_codigo_barras,
        provider_id: data.dado_boleto?.dados_individuais_boleto?.[0]?.id_boleto_individual,
        status: "registrado",
        provider_response: data,
      };
    case "sicoob":
      return {
        nosso_numero: data.nossoNumero?.toString(),
        linha_digitavel: data.linhaDigitavel,
        codigo_barras: data.codigoBarraNumerico,
        provider_id: data.nossoNumero?.toString(),
        status: "registrado",
        provider_response: data,
      };
  }
}

// ============= INTER: POLL BOLETO STATUS =============

async function consultInterBoleto(token: string, credential: any, codigoSolicitacao: string) {
  const config = BANK_CONFIGS.inter;
  const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;
  const url = `${baseUrl}${config.boletoPath}/${codigoSolicitacao}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Inter consult failed: ${resp.status} - ${JSON.stringify(data)}`);
  }

  return {
    situacao: data.situacao,
    nosso_numero: data.nossoNumero,
    linha_digitavel: data.linhaDigitavel,
    codigo_barras: data.codigoBarras,
    provider_response: data,
  };
}

// ============= PIX CHARGE CREATION =============

async function createPixCharge(token: string, credential: any, params: any) {
  const provider = credential.provider as keyof typeof BANK_CONFIGS;
  const config = BANK_CONFIGS[provider];
  const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;

  const txid = params.txid || crypto.randomUUID().replace(/-/g, "").slice(0, 26);
  const pixPayload: any = {
    calendario: { expiracao: params.expiration_seconds || 3600 },
    valor: { original: params.amount.toFixed(2) },
    chave: params.pix_key || credential.extra_config?.pix_key || "",
    solicitacaoPagador: `Parcela ${params.installment_number || ""}`.trim(),
  };

  if (params.payer_document) {
    pixPayload.devedor = {
      cpf: params.payer_document.replace(/\D/g, "").length <= 11 ? params.payer_document.replace(/\D/g, "") : undefined,
      cnpj: params.payer_document.replace(/\D/g, "").length > 11 ? params.payer_document.replace(/\D/g, "") : undefined,
      nome: params.payer_name,
    };
  }

  const resp = await fetch(`${baseUrl}${config.pixPath}/${txid}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pixPayload),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`PIX charge failed (${provider}): ${resp.status} - ${JSON.stringify(data)}`);
  }

  return {
    txid: data.txid || txid,
    location: data.location || data.loc?.location,
    qr_code: data.pixCopiaECola || data.qrCode,
    provider_response: data,
  };
}

// ============= MAIN HANDLER =============

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
    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { action, credential_id, ...params } = await req.json();

    // Fetch credential
    const { data: credential, error: credErr } = await supabase
      .from("bank_api_credentials")
      .select("*")
      .eq("id", credential_id)
      .eq("active", true)
      .single();

    if (credErr || !credential) {
      return new Response(JSON.stringify({ error: "Credencial bancária não encontrada ou inativa" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(supabase, credential);

    if (action === "create_boleto") {
      const result = await createBoleto(accessToken, credential, params);

      // Save to database — Inter V3 is async, so status may be "em_processamento"
      const { data: boleto, error: saveErr } = await supabase.from("boletos").insert({
        installment_id: params.installment_id || null,
        bank_credential_id: credential_id,
        nosso_numero: result?.nosso_numero,
        linha_digitavel: result?.linha_digitavel,
        codigo_barras: result?.codigo_barras,
        amount: params.amount,
        due_date: params.due_date,
        payer_name: params.payer_name,
        payer_document: params.payer_document,
        payer_address: params.payer_address || null,
        status: result?.status || "registrado",
        provider_id: result?.provider_id,
        provider_response: result?.provider_response,
        created_by: userId,
      }).select().single();

      if (saveErr) throw saveErr;

      return new Response(JSON.stringify({ success: true, boleto }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Inter V3: consult a boleto to get nossoNumero/linhaDigitavel after async emission
    if (action === "consult_boleto_inter") {
      if (credential.provider !== "inter") {
        return new Response(JSON.stringify({ error: "Ação disponível apenas para Inter" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await consultInterBoleto(accessToken, credential, params.codigo_solicitacao);

      // Update the boleto record with the real data
      if (params.boleto_id) {
        await supabase.from("boletos").update({
          nosso_numero: result.nosso_numero,
          linha_digitavel: result.linha_digitavel,
          codigo_barras: result.codigo_barras,
          status: result.situacao === "EMITIDO" ? "registrado"
            : result.situacao === "PAGO" ? "pago"
            : result.situacao === "CANCELADO" ? "cancelado"
            : "em_processamento",
          provider_response: result.provider_response,
        }).eq("id", params.boleto_id);
      }

      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_pix") {
      const result = await createPixCharge(accessToken, credential, params);

      const { data: pixCharge, error: saveErr } = await supabase.from("pix_charges").insert({
        installment_id: params.installment_id || null,
        bank_credential_id: credential_id,
        txid: result.txid,
        location: result.location,
        qr_code: result.qr_code,
        amount: params.amount,
        payer_name: params.payer_name || null,
        payer_document: params.payer_document || null,
        status: "ativa",
        expiration_seconds: params.expiration_seconds || 3600,
        provider_response: result.provider_response,
        created_by: userId,
      }).select().single();

      if (saveErr) throw saveErr;

      return new Response(JSON.stringify({ success: true, pix_charge: pixCharge }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel_boleto") {
      const { data: boleto } = await supabase.from("boletos")
        .select("*, bank_api_credentials:bank_credential_id(*)")
        .eq("id", params.boleto_id)
        .single();

      if (!boleto) throw new Error("Boleto não encontrado");

      const config = BANK_CONFIGS[credential.provider as keyof typeof BANK_CONFIGS];
      const baseUrl = credential.api_environment === "production" ? config.production : config.sandbox;

      // Provider-specific cancellation
      if (credential.provider === "inter") {
        await fetch(`${baseUrl}${config.boletoPath}/${boleto.provider_id}/cancelar`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ motivoCancelamento: "APEDIDODOCLIENTE" }),
        });
      }

      await supabase.from("boletos").update({ status: "cancelado" }).eq("id", params.boleto_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use: create_boleto, create_pix, cancel_boleto, consult_boleto_inter" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("bank-boleto error:", error);
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
