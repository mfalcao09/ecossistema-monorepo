import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { contract_id, template_id, contract_type, instructions } = await req.json();

    // Buscar dados do contrato
    const { data: contract } = contract_id ? await supabase
      .from("contracts")
      .select(`
        *,
        properties:property_id (title, street, number, complement, neighborhood, city, state, zip_code, total_area, bedrooms, bathrooms, property_type, iptu_value),
        contract_parties (role, people:person_id (name, cpf_cnpj, rg, nationality, marital_status, profession, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip, email, phone, person_type, company_name, legal_representative_name))
      `)
      .eq("id", contract_id)
      .single() : { data: null };

    // Buscar template/minuta se informado
    const { data: template } = template_id ? await supabase
      .from("contract_templates")
      .select("name, content, variables")
      .eq("id", template_id)
      .single() : { data: null };

    // Buscar cláusulas padrão do tipo de contrato
    const { data: clauses } = await supabase
      .from("contract_clauses")
      .select("title, content, category")
      .eq("contract_type", contract_type || contract?.contract_type || "locacao")
      .eq("is_active", true)
      .limit(30);

    const contractData = {
      contract_type: contract_type || contract?.contract_type,
      property: contract?.properties,
      parties: contract?.contract_parties,
      financial: {
        monthly_value: contract?.monthly_value,
        total_value: contract?.total_value,
        admin_fee_percentage: contract?.admin_fee_percentage,
        adjustment_index: contract?.adjustment_index,
        payment_method: contract?.payment_method,
        has_intermediation: contract?.has_intermediation,
      },
      dates: {
        start_date: contract?.start_date,
        end_date: contract?.end_date,
      },
      clauses: clauses || [],
      template: template ? { name: template.name, structure: template.content?.substring(0, 2000) } : null,
      special_instructions: instructions,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const systemPrompt = `Você é um especialista jurídico em direito imobiliário brasileiro, especializado na elaboração de contratos de locação, venda e administração de imóveis. 

Suas minutas seguem rigorosamente:
- Lei do Inquilinato (Lei 8.245/1991) para contratos de locação
- Código Civil Brasileiro
- Normas da CRECI e COFECI para intermediação imobiliária

Ao redigir contratos:
- Use linguagem jurídica formal e precisa
- Inclua todas as cláusulas obrigatórias por lei
- Preencha variáveis com os dados reais fornecidos
- Sinalize com [A PREENCHER] campos que não foram fornecidos
- Estruture com numeração clara das cláusulas`;

    const userPrompt = `Redija um contrato completo de ${contractData.contract_type} com base nos dados abaixo:

${JSON.stringify(contractData, null, 2)}

${instructions ? `\nInstruções especiais: ${instructions}` : ""}

Gere o contrato completo em HTML formatado, pronto para impressão, com todas as cláusulas necessárias preenchidas com os dados fornecidos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_contract",
              description: "Gera o contrato imobiliário completo",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título do contrato" },
                  contract_html: { type: "string", description: "Conteúdo completo do contrato em HTML formatado" },
                  clauses_count: { type: "number", description: "Número de cláusulas geradas" },
                  missing_fields: {
                    type: "array",
                    items: { type: "string" },
                    description: "Campos que precisam ser preenchidos manualmente"
                  },
                  legal_notes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Observações jurídicas importantes"
                  },
                  summary: { type: "string", description: "Resumo executivo do contrato gerado" },
                },
                required: ["title", "contract_html", "clauses_count", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_contract" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar contrato" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Resposta inválida da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("contract-draft-ai error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
