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

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }

    const { cnpj } = await req.json();
    if (!cnpj) {
      return new Response(JSON.stringify({ error: "CNPJ obrigatório" }), { status: 400, headers: corsHeaders });
    }

    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      return new Response(JSON.stringify({ error: "CNPJ inválido (deve ter 14 dígitos)" }), { status: 400, headers: corsHeaders });
    }

    const resp = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: `ReceitaWS retornou ${resp.status}`, details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();

    if (data.status === "ERROR") {
      return new Response(JSON.stringify({ error: data.message || "CNPJ não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = {
      cnpj: data.cnpj,
      razao_social: data.nome,
      nome_fantasia: data.fantasia,
      situacao: data.situacao,
      data_situacao: data.data_situacao,
      tipo: data.tipo,
      porte: data.porte,
      natureza_juridica: data.natureza_juridica,
      cnae_principal: data.atividade_principal?.[0]?.text || "",
      cnae_codigo: data.atividade_principal?.[0]?.code || "",
      endereco: {
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        municipio: data.municipio,
        uf: data.uf,
        cep: data.cep,
      },
      telefone: data.telefone,
      email: data.email,
      capital_social: data.capital_social,
      data_abertura: data.abertura,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("cnpj-query error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
