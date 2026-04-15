import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface HealthResult {
  key: string;
  status: "active" | "error" | "unavailable" | "unconfigured";
  latency_ms?: number;
  error?: string;
}

async function checkEndpoint(url: string, timeoutMs = 8000): Promise<{ ok: boolean; latency: number; error?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.ok, latency: Date.now() - start };
  } catch (e: any) {
    return { ok: false, latency: Date.now() - start, error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient.from("profiles").select("tenant_id").eq("user_id", userId).single();
    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Sem tenant" }), { status: 403, headers: corsHeaders });
    }
    const tenantId = profile.tenant_id;

    // Get tenant settings for signature providers check
    const { data: tenant } = await adminClient.from("tenants").select("settings").eq("id", tenantId).single();
    const settings = (tenant?.settings as Record<string, any>) || {};
    const sigProviders = settings.signature_providers || {};

    const results: HealthResult[] = [];

    // Run all checks in parallel
    const [cnpjCheck, cepCheck, bcbCheck] = await Promise.all([
      checkEndpoint("https://receitaws.com.br/v1/cnpj/00000000000191"),
      checkEndpoint("https://viacep.com.br/ws/01001000/json/"),
      checkEndpoint("https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json"),
    ]);

    results.push({ key: "cnpj_query", status: cnpjCheck.ok ? "active" : "error", latency_ms: cnpjCheck.latency, error: cnpjCheck.error });
    results.push({ key: "cpf_validation", status: "active", latency_ms: 0 }); // local validation
    results.push({ key: "cep_query", status: cepCheck.ok ? "active" : "error", latency_ms: cepCheck.latency, error: cepCheck.error });
    // Check SERPRO CND credentials
    const serproKey = Deno.env.get("SERPRO_CONSUMER_KEY");
    const serproSecret = Deno.env.get("SERPRO_CONSUMER_SECRET");
    if (serproKey && serproSecret) {
      try {
        const basic = btoa(`${serproKey}:${serproSecret}`);
        const tokenRes = await fetch("https://gateway.apiserpro.serpro.gov.br/token", {
          method: "POST",
          headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: "grant_type=client_credentials",
        });
        results.push({ key: "cnd_receita", status: tokenRes.ok ? "active" : "error", latency_ms: 0, error: tokenRes.ok ? undefined : `Token error: ${tokenRes.status}` });
      } catch (e: any) {
        results.push({ key: "cnd_receita", status: "error", error: e.message });
      }
    } else {
      results.push({ key: "cnd_receita", status: "unconfigured", error: "Credenciais SERPRO não configuradas" });
    }
    // Check Infosimples CRF/FGTS
    const infosimplesToken = Deno.env.get("INFOSIMPLES_TOKEN");
    results.push({
      key: "crf_fgts",
      status: infosimplesToken ? "active" : "unconfigured",
      error: infosimplesToken ? undefined : "Token Infosimples não configurado",
    });

    results.push({ key: "cadin", status: "unavailable", error: "Requer credenciamento Conecta gov.br" });
    results.push({ key: "divida_ativa", status: "unavailable", error: "Requer credenciamento Conecta gov.br" });
    results.push({ key: "bcb_indices", status: bcbCheck.ok ? "active" : "error", latency_ms: bcbCheck.latency, error: bcbCheck.error });

    // Check signature providers
    const anySignEnabled = Object.values(sigProviders).some((p: any) => p?.enabled);
    results.push({ key: "assinaturas_digitais", status: anySignEnabled ? "active" : "unconfigured" });

    // Check gov.br signature
    const govbrConfig = sigProviders.govbr;
    results.push({
      key: "govbr_assinatura",
      status: govbrConfig?.enabled && govbrConfig?.client_id ? "active" : "unconfigured",
      error: !govbrConfig?.client_id ? "Requer credenciamento gov.br" : undefined,
    });

    // Check bank integration
    const { count: bankCount } = await adminClient.from("bank_api_credentials").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("active", true);
    results.push({ key: "bank_integration", status: (bankCount || 0) > 0 ? "active" : "unconfigured" });

    // Stripe always active (platform level)
    results.push({ key: "stripe", status: "active" });

    // Check WhatsApp channels
    const { count: chatCount } = await adminClient.from("chat_channels").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "connected");
    results.push({ key: "whatsapp", status: (chatCount || 0) > 0 ? "active" : "unconfigured" });

    // Email always active
    results.push({ key: "email_resend", status: "active" });

    // Parse contract AI always active
    results.push({ key: "parse_contract_ai", status: "active" });

    // N8n webhook
    const { data: tenantWh } = await adminClient.from("tenants").select("webhook_url").eq("id", tenantId).single();
    results.push({ key: "webhook_n8n", status: tenantWh?.webhook_url ? "active" : "unconfigured" });

    // Registro de Imoveis
    results.push({
      key: "registro_imoveis",
      status: sigProviders.registro_imoveis?.enabled ? "active" : "unconfigured",
    });

    // Upsert results into api_integrations
    const now = new Date().toISOString();
    for (const r of results) {
      await adminClient.from("api_integrations").upsert(
        {
          tenant_id: tenantId,
          integration_key: r.key,
          status: r.status,
          last_check_at: now,
          last_error: r.error || null,
        },
        { onConflict: "tenant_id,integration_key" }
      );
    }

    return new Response(JSON.stringify({ results, checked_at: now }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("api-health-check error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
