import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { addendum_text, contract_context } = await req.json();

    if (!addendum_text || addendum_text.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Texto do aditivo muito curto ou vazio." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um especialista em análise de aditivos de contratos imobiliários brasileiros.
Sua tarefa é extrair com precisão os dados de renovação de um aditivo contratual.

REGRAS DE EXTRAÇÃO:
1. new_end_date: Data de término da nova vigência (formato ISO YYYY-MM-DD). Procure por frases como "nova vigência", "prorrogado até", "novo prazo".
2. new_value: Novo valor mensal de aluguel em reais (apenas número, sem R$). Se não alterado, deixe null.
3. adjustment_index: Índice de reajuste usado (IGP-M, IPCA, INPC, IPC, manual). Normalize para padrão: "igpm", "ipca", "inpc", "ipc", "manual".
4. adjustment_pct: Percentual de reajuste aplicado (número decimal). Ex: 4.83 para 4,83%.
5. addendum_number: Identificação do aditivo. Ex: "1º Aditivo", "2º Termo Aditivo".
6. effective_date: Data de assinatura/vigência do aditivo (formato ISO YYYY-MM-DD).
7. modified_clauses: Lista de cláusulas alteradas (array de strings resumidas).
8. risk_flags: Lista de alertas jurídicos detectados (cláusulas potencialmente abusivas, reajuste fora do índice, prazo excessivo, etc).
9. risk_score: Score de conformidade de 0 a 100 (100 = totalmente conforme). Reduza por: reajuste acima do índice oficial (-15), prazo > 30 meses sem garantia adequada (-10), cláusulas abusivas (-20), dados incompletos (-5).
10. summary: Resumo executivo de 2-3 linhas descrevendo as principais alterações.

CONTEXTO DO CONTRATO (se fornecido): ${contract_context || "Não fornecido."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analise o seguinte aditivo de renovação de contrato de locação:\n\n${addendum_text.slice(0, 15000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_addendum_data",
              description: "Extrai dados estruturados de um aditivo de renovação contratual.",
              parameters: {
                type: "object",
                properties: {
                  new_end_date: {
                    type: "string",
                    description: "Nova data de término da vigência no formato YYYY-MM-DD",
                  },
                  new_value: {
                    type: "number",
                    description: "Novo valor mensal de aluguel em reais (null se não alterado)",
                  },
                  adjustment_index: {
                    type: "string",
                    enum: ["igpm", "ipca", "inpc", "ipc", "manual"],
                    description: "Índice de reajuste aplicado",
                  },
                  adjustment_pct: {
                    type: "number",
                    description: "Percentual de reajuste aplicado",
                  },
                  addendum_number: {
                    type: "string",
                    description: "Identificação do aditivo (ex: 1º Aditivo)",
                  },
                  effective_date: {
                    type: "string",
                    description: "Data de assinatura do aditivo no formato YYYY-MM-DD",
                  },
                  modified_clauses: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista de cláusulas alteradas",
                  },
                  risk_flags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Alertas e riscos jurídicos detectados",
                  },
                  risk_score: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100,
                    description: "Score de conformidade jurídica de 0 a 100",
                  },
                  summary: {
                    type: "string",
                    description: "Resumo executivo das alterações",
                  },
                },
                required: ["risk_score", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_addendum_data" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes. Adicione créditos no workspace." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`AI gateway error ${response.status}: ${errText}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "A IA não conseguiu extrair dados do documento. Verifique se o texto está legível." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ success: true, data: extracted, raw: aiResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("parse-addendum-ai error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
