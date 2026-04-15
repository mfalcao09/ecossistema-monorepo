import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    // Get tenant_id from profile
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();
    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Sem tenant vinculado" }), { status: 403, headers: corsHeaders });
    }
    const tenantId = profile.tenant_id;

    // Get tenant settings with credentials
    const { data: tenant } = await adminClient
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();
    const settings = tenant?.settings as Record<string, any> | null;
    const providers = settings?.signature_providers || {};

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "GET" && action === "status") {
      const envelopeId = url.searchParams.get("envelope_id");
      if (!envelopeId) {
        return new Response(JSON.stringify({ error: "envelope_id required" }), { status: 400, headers: corsHeaders });
      }

      const { data: envelope } = await adminClient
        .from("legal_signature_envelopes")
        .select("*")
        .eq("id", envelopeId)
        .eq("tenant_id", tenantId)
        .single();

      return new Response(JSON.stringify({ envelope }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { provider, envelope_data, signers: signerData } = body;

      if (!provider) {
        return new Response(JSON.stringify({ error: "provider required" }), { status: 400, headers: corsHeaders });
      }

      // For manual provider, just save locally
      if (provider === "manual") {
        return new Response(JSON.stringify({ success: true, message: "Envelope manual criado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const providerConfig = providers[provider];
      if (!providerConfig?.enabled) {
        return new Response(JSON.stringify({ error: `Provedor ${provider} não está configurado` }), { status: 400, headers: corsHeaders });
      }

      let externalId: string | null = null;
      let apiResponse: any = null;

      // Route to provider API
      switch (provider) {
        case "docusign": {
          const baseUrl = providerConfig.base_url || "https://demo.docusign.net/restapi";
          const accountId = providerConfig.account_id;
          const integrationKey = providerConfig.integration_key;

          // DocuSign requires OAuth — for now, log the intent
          apiResponse = {
            provider: "docusign",
            status: "configured",
            message: "DocuSign API call prepared. OAuth flow required for production.",
            config_valid: !!(accountId && integrationKey),
          };
          break;
        }

        case "clicksign": {
          const token = providerConfig.api_token;
          const env = providerConfig.environment === "production"
            ? "https://app.clicksign.com"
            : "https://sandbox.clicksign.com";

          try {
            const csResp = await fetch(`${env}/api/v3/envelopes?access_token=${token}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                envelope: {
                  name: envelope_data?.title || "Envelope",
                  locale: envelope_data?.locale || "pt-BR",
                  auto_close: true,
                  remind_interval: 3,
                  block_after_refusal: true,
                  deadline_at: envelope_data?.deadline_at || null,
                  sequence_enabled: envelope_data?.sequence_enabled || false,
                  message: envelope_data?.message || "",
                },
              }),
            });
            apiResponse = await csResp.json();
            externalId = apiResponse?.data?.id || apiResponse?.envelope?.id || null;
          } catch (e: any) {
            apiResponse = { error: e.message };
          }
          break;
        }

        case "d4sign": {
          const token = providerConfig.token_api;
          const cryptKey = providerConfig.crypt_key;
          const env = providerConfig.environment === "production"
            ? "https://secure.d4sign.com.br/api/v1"
            : "https://sandbox.d4sign.com.br/api/v1";

          apiResponse = {
            provider: "d4sign",
            status: "configured",
            message: "D4Sign requires document upload first via /documents endpoint.",
            config_valid: !!token,
          };
          break;
        }

        case "registro_imoveis": {
          apiResponse = {
            provider: "registro_imoveis",
            status: "configured",
            message: "ONR integration prepared. Protocol submission requires specific document formats.",
            config_valid: !!(providerConfig.login && providerConfig.password),
          };
          break;
        }

        case "govbr": {
          const govbrEnv = providerConfig.environment === "production"
            ? "https://assinador.iti.gov.br"
            : "https://signer.staging.iti.br";

          apiResponse = {
            provider: "govbr",
            status: "configured",
            message: "Assinatura gov.br preparada. Requer autenticação OAuth do signatário via gov.br.",
            config_valid: !!(providerConfig.client_id && providerConfig.client_secret),
            auth_url: `${govbrEnv}/authorize`,
          };
          break;
        }

        default:
          return new Response(JSON.stringify({ error: "Provider not supported" }), { status: 400, headers: corsHeaders });
      }

      // Update envelope with external ID if obtained
      if (externalId && body.envelope_id) {
        await adminClient
          .from("legal_signature_envelopes")
          .update({ external_envelope_id: externalId, status: "enviado" })
          .eq("id", body.envelope_id)
          .eq("tenant_id", tenantId);
      }

      return new Response(JSON.stringify({ success: true, external_id: externalId, api_response: apiResponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  } catch (e: any) {
    console.error("signature-proxy error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
