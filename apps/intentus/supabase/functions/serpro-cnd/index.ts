import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SerproCndRequest {
  cpf_cnpj: string;
  check_id: string;
  gerar_pdf?: boolean;
  use_trial?: boolean;
}

async function getSerproToken(): Promise<string> {
  const key = Deno.env.get("SERPRO_CONSUMER_KEY");
  const secret = Deno.env.get("SERPRO_CONSUMER_SECRET");
  if (!key || !secret) throw new Error("Credenciais SERPRO não configuradas");

  const basic = btoa(`${key}:${secret}`);
  const res = await fetch("https://gateway.apiserpro.serpro.gov.br/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao obter token SERPRO: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

function parseCpfCnpj(raw: string): { digits: string; tipo: number; codigo: number } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return { digits, tipo: 2, codigo: 9002 };
  if (digits.length === 14) return { digits, tipo: 1, codigo: 9001 };
  throw new Error("CPF/CNPJ inválido: deve ter 11 ou 14 dígitos");
}

function interpretResult(certidao: any): { status: string; score: number; summary: string } {
  const tipo = (certidao?.TipoCertidao || certidao?.tipoCertidao || "").toLowerCase();
  const validade = certidao?.DataValidade || certidao?.dataValidade || "";
  const situacao = certidao?.SituacaoContribuinte || certidao?.situacaoContribuinte || "";

  if (tipo.includes("negativa") && !tipo.includes("positiva")) {
    return {
      status: "aprovado",
      score: 100,
      summary: `Certidão Negativa de Débitos. Validade: ${validade}. Situação: ${situacao}. Nada consta.`,
    };
  }
  if (tipo.includes("positiva com efeitos de negativa") || tipo.includes("positiva com efeito de negativa")) {
    return {
      status: "aprovado",
      score: 80,
      summary: `Certidão Positiva com Efeitos de Negativa. Validade: ${validade}. Existem débitos, porém com exigibilidade suspensa.`,
    };
  }
  if (tipo.includes("positiva")) {
    return {
      status: "reprovado",
      score: 0,
      summary: `Certidão Positiva. Existem débitos perante a Receita Federal / PGFN. Situação: ${situacao}.`,
    };
  }

  // Fallback: try to interpret from other fields
  const mensagem = certidao?.Mensagem || certidao?.mensagem || JSON.stringify(certidao);
  return {
    status: "inconclusivo",
    score: 0,
    summary: `Resultado não identificado automaticamente. Resposta: ${mensagem}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient.from("profiles").select("tenant_id").eq("user_id", user.id).single();
    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Sem tenant" }), { status: 403, headers: corsHeaders });
    }

    const body: SerproCndRequest = await req.json();
    const { cpf_cnpj, check_id, gerar_pdf = true, use_trial = false } = body;

    if (!cpf_cnpj || !check_id) {
      return new Response(JSON.stringify({ error: "cpf_cnpj e check_id são obrigatórios" }), { status: 400, headers: corsHeaders });
    }

    // Verify the check belongs to this tenant
    const { data: checkRecord } = await adminClient
      .from("due_diligence_checks")
      .select("id, tenant_id")
      .eq("id", check_id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (!checkRecord) {
      return new Response(JSON.stringify({ error: "Verificação não encontrada" }), { status: 404, headers: corsHeaders });
    }

    // Update status to em_andamento
    await adminClient.from("due_diligence_checks").update({ status: "em_andamento" }).eq("id", check_id);

    // Get SERPRO token
    const token = await getSerproToken();

    // Parse CPF/CNPJ
    const { digits, tipo, codigo } = parseCpfCnpj(cpf_cnpj);

    // Build request
    const baseUrl = use_trial
      ? "https://gateway.apiserpro.serpro.gov.br/consulta-cnd-trial/v1/certidao"
      : "https://gateway.apiserpro.serpro.gov.br/consulta-cnd/v1/certidao";

    const cndPayload = {
      TipoContribuinte: tipo,
      ContribuinteConsulta: digits,
      CodigoIdentificacao: codigo,
      GerarCertidaoPdf: gerar_pdf,
    };

    console.log("Consultando CND SERPRO:", { baseUrl, tipo, codigo, digits: digits.substring(0, 4) + "..." });

    const cndRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cndPayload),
    });

    if (!cndRes.ok) {
      const errText = await cndRes.text();
      console.error("Erro SERPRO CND:", cndRes.status, errText);

      // Update check as inconclusivo
      await adminClient.from("due_diligence_checks").update({
        status: "inconclusivo",
        result_summary: `Erro na consulta SERPRO: ${cndRes.status} - ${errText.substring(0, 200)}`,
        checked_at: new Date().toISOString(),
      }).eq("id", check_id);

      return new Response(JSON.stringify({
        error: "Erro na consulta SERPRO",
        details: errText.substring(0, 200),
        status_code: cndRes.status,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cndData = await cndRes.json();
    console.log("Resposta SERPRO CND:", JSON.stringify(cndData).substring(0, 500));

    // Interpret result
    const result = interpretResult(cndData);

    // Save PDF if available
    let pdfPath: string | null = null;
    const pdfBase64 = cndData?.CertidaoPdf || cndData?.certidaoPdf || cndData?.Pdf || null;
    if (pdfBase64 && typeof pdfBase64 === "string") {
      try {
        const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
        const fileName = `cnd-serpro/${check_id}-${Date.now()}.pdf`;
        await adminClient.storage.from("deal-attachments").upload(fileName, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });
        pdfPath = fileName;
      } catch (e) {
        console.error("Erro ao salvar PDF:", e);
      }
    }

    // Update due diligence check
    await adminClient.from("due_diligence_checks").update({
      status: result.status,
      score: result.score,
      result_summary: result.summary,
      checked_at: new Date().toISOString(),
      notes: pdfPath ? `PDF salvo: ${pdfPath}` : undefined,
    }).eq("id", check_id);

    return new Response(JSON.stringify({
      success: true,
      result: {
        status: result.status,
        score: result.score,
        summary: result.summary,
        pdf_path: pdfPath,
        raw: cndData,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("serpro-cnd error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
