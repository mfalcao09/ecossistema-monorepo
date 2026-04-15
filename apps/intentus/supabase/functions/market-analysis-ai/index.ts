const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { evaluation_id, property_context, market_results } = await req.json();

    if (!evaluation_id) {
      return new Response(JSON.stringify({ error: "evaluation_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If no market_results provided, fetch from DB
    let results = market_results;
    let evalRecord: any = null;

    if (!results) {
      const { data, error } = await supabase
        .from("market_evaluations")
        .select("*, properties(title, neighborhood, city, area_total, property_type, sale_price, rental_price)")
        .eq("id", evaluation_id)
        .single();
      if (error) throw error;
      evalRecord = data;
      results = data?.market_results || [];
    }

    const propertyCtx = property_context || (evalRecord?.properties
      ? `Imóvel: ${evalRecord.properties.title}, ${evalRecord.properties.neighborhood}, ${evalRecord.properties.city}. Área: ${evalRecord.properties.area_total}m². Tipo: ${evalRecord.properties.property_type}. Preço venda atual: R$ ${evalRecord.properties.sale_price?.toLocaleString("pt-BR") || "N/A"}. Aluguel atual: R$ ${evalRecord.properties.rental_price?.toLocaleString("pt-BR") || "N/A"}/mês. Preço m² venda mercado: ${evalRecord?.preco_m2_venda ? `R$ ${evalRecord.preco_m2_venda.toLocaleString("pt-BR")}` : "N/A"}. Preço m² locação mercado: ${evalRecord?.preco_m2_locacao ? `R$ ${evalRecord.preco_m2_locacao.toLocaleString("pt-BR")}` : "N/A"}.`
      : "Imóvel não especificado");

    const comparaveisText = results && (results as any[]).length > 0
      ? JSON.stringify(results, null, 2)
      : "Nenhum comparável disponível. Use os dados numéricos de preço/m² já salvos para a análise.";

    const systemPrompt = `Você é um especialista em inteligência imobiliária de mercado brasileiro. 
Analise os dados fornecidos e gere um relatório qualitativo rico e acionável sobre o posicionamento do imóvel no mercado.
Responda sempre em português brasileiro. Seja direto, use linguagem profissional mas acessível.
Estruture sua resposta com seções claramente delimitadas.`;

    const userPrompt = `Analise o mercado para o seguinte imóvel e forneça inteligência de mercado completa:

**IMÓVEL EM AVALIAÇÃO:**
${propertyCtx}

**COMPARÁVEIS ENCONTRADOS NO MERCADO:**
${comparaveisText}

Gere um relatório estruturado com estas seções:

## 1. Perfil do Produto de Mercado
Descreva o padrão dos imóveis encontrados como comparáveis: tipologia predominante, estado de conservação aparente, faixa de metragem, perfil do comprador/inquilino típico.

## 2. Análise de Preços
Faixa real de preços encontrada (mínimo, máximo, mediana). Identifique outliers e explique possíveis razões. Compare com o preço atual do imóvel avaliado.

## 3. Posicionamento do Imóvel
Como o imóvel avaliado se posiciona neste mercado? Está bem precificado, abaixo ou acima do mercado? Qual é a sua vantagem competitiva?

## 4. Riscos e Oportunidades
Riscos de mercado identificados (excesso de oferta, sazonalidade, tendência de preços). Oportunidades (demanda reprimida, produto diferenciado, localização estratégica).

## 5. Recomendação Estratégica
Recomendação objetiva: manter preço, reposicionar, negociar ou aguardar condições mais favoráveis. Justifique em 2-3 frases.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices?.[0]?.message?.content || "";

    // Save to DB
    const { error: updateError } = await supabase
      .from("market_evaluations")
      .update({ ai_market_analysis: analysisText })
      .eq("id", evaluation_id);

    if (updateError) {
      console.error("DB update error:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao salvar análise", details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, analysis: analysisText }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("market-analysis-ai error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
