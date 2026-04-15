const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-api-key",
};

const API_KEY = "intentus_retorno_2026";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = req.headers.get("x-n8n-api-key");
  if (apiKey !== API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    evaluation_id?: string;
    preco_m2_estimado?: number;
    preco_m2_venda?: number;
    preco_m2_locacao?: number;
    segmento_mercado?: string;
    market_results?: unknown[];
    ai_market_analysis?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { evaluation_id, preco_m2_estimado, preco_m2_venda, preco_m2_locacao, segmento_mercado, market_results, ai_market_analysis } = body;

  if (!evaluation_id) {
    return new Response(
      JSON.stringify({ error: "Campo obrigatório: evaluation_id" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (preco_m2_estimado === undefined && preco_m2_venda === undefined && preco_m2_locacao === undefined && market_results === undefined) {
    return new Response(
      JSON.stringify({ error: "Informe ao menos um campo de preço (preco_m2_estimado, preco_m2_venda, preco_m2_locacao) ou market_results" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Build update payload — only include defined fields
  const updatePayload: Record<string, unknown> = {
    market_analysis_status: "concluido",
    market_analysis_at: new Date().toISOString(),
  };
  if (preco_m2_estimado !== undefined) updatePayload.preco_m2_estimado = preco_m2_estimado;
  if (preco_m2_venda !== undefined)    updatePayload.preco_m2_venda = preco_m2_venda;
  if (preco_m2_locacao !== undefined)  updatePayload.preco_m2_locacao = preco_m2_locacao;
  if (segmento_mercado !== undefined)    updatePayload.segmento_mercado = segmento_mercado;
  if (market_results !== undefined)      updatePayload.market_results = market_results;
  if (ai_market_analysis !== undefined)  updatePayload.ai_market_analysis = ai_market_analysis;
  // preco_m2_estimado fallback: use venda if not provided explicitly
  if (preco_m2_estimado === undefined && (preco_m2_venda ?? preco_m2_locacao)) {
    updatePayload.preco_m2_estimado = preco_m2_venda ?? preco_m2_locacao;
  }

  const { error } = await supabase
    .from("market_evaluations")
    .update(updatePayload)
    .eq("id", evaluation_id);

  if (error) {
    console.error("Update error:", error);
    return new Response(JSON.stringify({ error: "Erro ao atualizar avaliação", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ success: true, message: "Avaliação atualizada com sucesso", evaluation_id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
