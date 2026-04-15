import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Legal assistant persona system prompt
const LEGAL_ASSISTANT_SYSTEM_PROMPT = `Você é um assistente jurídico especializado em direito imobiliário brasileiro com profundo conhecimento em:
- Análise de matrículas e registros de imóveis (Lei 6.015/73)
- Contratos sociais e estrutura societária
- Procurações e poderes
- Ônus reais: hipotecas, penhoras, usufruto, servidões, indisponibilidade de bens
- Alienação fiduciária
- Cédulas de crédito imobiliário
- Cláusulas contratuais imobiliárias

Sua análise deve ser:
1. PROFUNDA e DETALHADA - identificar todos os elementos jurídicos relevantes
2. CRÍTICA - alertar sobre riscos, pendências e inconsistências
3. ESTRUTURADA - retornar dados em formato padronizado via tool calling
4. REFERENCIADA - indicar a página e número de registro de cada item extraído
5. PRÁTICA - indicar implicações concretas para a transação imobiliária

Para matrículas, sempre verificar:
- Cadeia dominial completa (histórico de proprietários)
- Ônus e gravames (hipotecas, penhoras, usufruto, indisponibilidade)
- Averbações relevantes (construções, demolições, certidões negativas)
- Proprietário atual e forma de aquisição
- Qualquer irregularidade ou inconsistência

Para contratos sociais:
- Objeto social e se permite imóveis
- Poderes dos sócios-administradores
- Restrições de alienação
- Capital social e integralização

Para procurações:
- Poderes específicos para imóveis
- Vigência e revogabilidade
- Substabelecimento
- Outorgante e outorgado`;

type DocType = "matricula" | "contrato_social" | "procuracao" | "generico";

interface MatriculaSchema {
  proprietario_atual: {
    nome: string;
    documento: string;
    forma_aquisicao: string;
    data_aquisicao: string;
    pagina_referencia: number;
  };
  historico: Array<{
    numero_ato: string;
    tipo: string;
    descricao: string;
    data: string;
    partes: string[];
    pagina: number;
  }>;
  gravames: Array<{
    tipo: string;
    credor: string;
    valor: string;
    data_constituicao: string;
    data_vencimento: string;
    status: string;
    pagina: number;
    nivel_risco: "alto" | "medio" | "baixo";
    descricao_risco: string;
  }>;
  transferencias: Array<{
    de: string;
    para: string;
    data: string;
    valor: string;
    tipo_negocio: string;
    pagina: number;
  }>;
  resumo: {
    numero_matricula: string;
    cartorio: string;
    municipio: string;
    descricao_imovel: string;
    area_total: string;
    area_construida: string;
    inscricao_municipal: string;
    situacao_geral: "regular" | "irregular" | "atencao";
    alertas: string[];
    recomendacoes: string[];
  };
}

interface GenericoSchema {
  tipo_documento_detectado: string;
  campos_extraidos: Array<{
    campo: string;
    valor: string;
    pagina: number;
    confianca: "alta" | "media" | "baixa";
  }>;
  resumo_executivo: string;
  pontos_atencao: string[];
  dados_partes: Array<{
    nome: string;
    papel: string;
    documento: string;
  }>;
}

function getToolsForDocType(docType: DocType) {
  if (docType === "matricula") {
    return [{
      type: "function",
      function: {
        name: "analyze_matricula",
        description: "Analisa e extrai dados estruturados de uma matrícula de imóvel",
        parameters: {
          type: "object",
          properties: {
            proprietario_atual: {
              type: "object",
              properties: {
                nome: { type: "string" },
                documento: { type: "string" },
                forma_aquisicao: { type: "string" },
                data_aquisicao: { type: "string" },
                pagina_referencia: { type: "number" },
              },
              required: ["nome", "documento", "forma_aquisicao", "data_aquisicao", "pagina_referencia"],
            },
            historico: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  numero_ato: { type: "string" },
                  tipo: { type: "string" },
                  descricao: { type: "string" },
                  data: { type: "string" },
                  partes: { type: "array", items: { type: "string" } },
                  pagina: { type: "number" },
                },
                required: ["numero_ato", "tipo", "descricao", "data", "partes", "pagina"],
              },
            },
            gravames: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tipo: { type: "string" },
                  credor: { type: "string" },
                  valor: { type: "string" },
                  data_constituicao: { type: "string" },
                  data_vencimento: { type: "string" },
                  status: { type: "string" },
                  pagina: { type: "number" },
                  nivel_risco: { type: "string", enum: ["alto", "medio", "baixo"] },
                  descricao_risco: { type: "string" },
                },
                required: ["tipo", "credor", "valor", "data_constituicao", "status", "pagina", "nivel_risco", "descricao_risco"],
              },
            },
            transferencias: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  de: { type: "string" },
                  para: { type: "string" },
                  data: { type: "string" },
                  valor: { type: "string" },
                  tipo_negocio: { type: "string" },
                  pagina: { type: "number" },
                },
                required: ["de", "para", "data", "valor", "tipo_negocio", "pagina"],
              },
            },
            resumo: {
              type: "object",
              properties: {
                numero_matricula: { type: "string" },
                cartorio: { type: "string" },
                municipio: { type: "string" },
                descricao_imovel: { type: "string" },
                area_total: { type: "string" },
                area_construida: { type: "string" },
                inscricao_municipal: { type: "string" },
                situacao_geral: { type: "string", enum: ["regular", "irregular", "atencao"] },
                alertas: { type: "array", items: { type: "string" } },
                recomendacoes: { type: "array", items: { type: "string" } },
              },
              required: ["numero_matricula", "cartorio", "municipio", "descricao_imovel", "area_total", "situacao_geral", "alertas", "recomendacoes"],
            },
          },
          required: ["proprietario_atual", "historico", "gravames", "transferencias", "resumo"],
          additionalProperties: false,
        },
      },
    }];
  }

  // Generic / contrato_social / procuracao
  return [{
    type: "function",
    function: {
      name: "analyze_document",
      description: "Analisa e extrai dados estruturados de um documento jurídico",
      parameters: {
        type: "object",
        properties: {
          tipo_documento_detectado: { type: "string" },
          campos_extraidos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                campo: { type: "string" },
                valor: { type: "string" },
                pagina: { type: "number" },
                confianca: { type: "string", enum: ["alta", "media", "baixa"] },
              },
              required: ["campo", "valor", "pagina", "confianca"],
            },
          },
          resumo_executivo: { type: "string" },
          pontos_atencao: { type: "array", items: { type: "string" } },
          dados_partes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nome: { type: "string" },
                papel: { type: "string" },
                documento: { type: "string" },
              },
              required: ["nome", "papel", "documento"],
            },
          },
        },
        required: ["tipo_documento_detectado", "campos_extraidos", "resumo_executivo", "pontos_atencao", "dados_partes"],
        additionalProperties: false,
      },
    },
  }];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { pdfBase64, docType = "matricula", analysisId, customFields } = await req.json() as {
      pdfBase64: string;
      docType: DocType;
      analysisId?: string;
      customFields?: string[];
    };

    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: "pdfBase64 é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build user prompt
    let userPrompt = "";
    if (docType === "matricula") {
      userPrompt = `Analise esta matrícula de imóvel brasileiro em DETALHES COMPLETOS. 
Extraia: proprietário atual, histórico completo de atos registrais e averbações, todos os gravames/ônus (hipotecas, penhoras, usufruto, alienação fiduciária, indisponibilidade), todas as transferências de propriedade, e um resumo executivo com alertas críticos.
Para cada item, indique a página de referência no documento.
Avalie o nível de risco de cada gravame e forneça recomendações específicas para a transação.`;
    } else if (docType === "contrato_social") {
      userPrompt = `Analise este contrato/estatuto social. Extraia: denominação social, CNPJ, objeto social, sócios e quotas, poderes dos administradores (especialmente para alienar/hipotecar imóveis), restrições, cláusulas relevantes para operações imobiliárias. Identifique se há poderes suficientes para realizar transações imobiliárias.`;
    } else if (docType === "procuracao") {
      userPrompt = `Analise esta procuração. Extraia: outorgante, outorgado, poderes específicos (especialmente imobiliários), vigência, revogabilidade, substabelecimento. Verifique se os poderes são suficientes para a transação pretendida e se há riscos.`;
    } else {
      const fieldsHint = customFields?.length ? `\nCampos específicos solicitados: ${customFields.join(", ")}` : "";
      userPrompt = `Analise este documento jurídico. Identifique o tipo de documento, extraia todos os campos relevantes com referência de página e nível de confiança, identifique as partes envolvidas e forneça um resumo executivo com pontos de atenção.${fieldsHint}`;
    }

    const tools = getToolsForDocType(docType);
    const toolName = docType === "matricula" ? "analyze_matricula" : "analyze_document";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: LEGAL_ASSISTANT_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
            ],
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: toolName } },
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns momentos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("IA não retornou resultado estruturado");

    const structuredResult = JSON.parse(toolCall.function.arguments);
    const processingTime = Date.now() - startTime;

    // Update analysis record if ID provided
    if (analysisId) {
      await supabase.from("legal_registry_analyses").update({
        analysis_status: "concluido",
        structured_result: structuredResult,
        processing_time_ms: processingTime,
        ...(docType === "matricula" && structuredResult.proprietario_atual ? {
          owner_name_extracted: structuredResult.proprietario_atual.nome,
          alerts: structuredResult.resumo?.alertas || [],
        } : {}),
      }).eq("id", analysisId);
    }

    return new Response(JSON.stringify({
      success: true,
      docType,
      result: structuredResult,
      processingTimeMs: processingTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("registry-ocr-ai error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
