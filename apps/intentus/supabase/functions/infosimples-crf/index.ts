import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const infosimplesToken = Deno.env.get("INFOSIMPLES_TOKEN");

    if (!infosimplesToken) {
      return new Response(JSON.stringify({ error: "INFOSIMPLES_TOKEN não configurado" }), { status: 500, headers: corsHeaders });
    }

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }

    const { cnpj, check_id } = await req.json();
    if (!cnpj || !check_id) {
      return new Response(JSON.stringify({ error: "cnpj e check_id são obrigatórios" }), { status: 400, headers: corsHeaders });
    }

    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      return new Response(JSON.stringify({ error: "CNPJ inválido. CRF/FGTS é apenas para pessoa jurídica." }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Update status to em_andamento
    await adminClient.from("due_diligence_checks").update({
      status: "em_andamento",
    }).eq("id", check_id);

    // Call Infosimples API
    const apiRes = await fetch("https://api.infosimples.com/api/v2/consultas/caixa/regularidade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cnpj: cleanCnpj,
        token: infosimplesToken,
        timeout: 300,
      }),
    });

    const apiData = await apiRes.json();

    let status: string;
    let score: number | null = null;
    let resultSummary: string;

    if (apiData.code === 200 && apiData.data && apiData.data.length > 0) {
      const entry = apiData.data[0];
      const situacao = (entry.situacao || "").toUpperCase();

      if (situacao === "REGULAR") {
        status = "aprovado";
        score = 100;
        const crf = entry.crf || "N/A";
        const validadeInicio = entry.validade_inicio_data || "N/A";
        const validadeFim = entry.validade_fim_data || "N/A";
        resultSummary = `CRF Regular. Certificado: ${crf}. Validade: ${validadeInicio} a ${validadeFim}. Razão Social: ${entry.razao_social || "N/A"}.`;
      } else {
        status = "reprovado";
        score = 0;
        resultSummary = `Situação FGTS: ${situacao}. Empregador irregular perante o FGTS. Razão Social: ${entry.razao_social || "N/A"}.`;
      }
    } else {
      status = "inconclusivo";
      const errorMsg = apiData.errors?.join("; ") || apiData.code_message || "Erro desconhecido";
      resultSummary = `Erro na consulta CRF/FGTS: código ${apiData.code} - ${errorMsg}`;
    }

    // Update the check record
    const { error: updateErr } = await adminClient.from("due_diligence_checks").update({
      status,
      score,
      result_summary: resultSummary,
      checked_at: new Date().toISOString(),
    }).eq("id", check_id);

    if (updateErr) {
      console.error("Error updating check:", updateErr);
    }

    return new Response(JSON.stringify({
      success: true,
      result: { status, score, result_summary: resultSummary },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("infosimples-crf error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
