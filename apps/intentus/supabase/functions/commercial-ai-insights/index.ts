import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolvePersona, callGemini, logInteraction } from "../_shared/resolve-persona.ts";

// ── CORS whitelist (replaces wildcard *) ──────────────────────────
const PROD_ORIGINS = ["https://intentus-plataform.vercel.app", "https://app.intentusrealestate.com.br"];
const DEV_PATTERNS = [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];
const PREVIEW_RE = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const extra = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);
  if (PROD_ORIGINS.includes(origin) || extra.includes(origin)) return true;
  if (PREVIEW_RE.test(origin)) return true;
  return DEV_PATTERNS.some(p => p.test(origin));
}

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : PROD_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();
  try {
    const { dashboardData, tenantId, userId } = await req.json();

    if (!dashboardData) {
      return new Response(JSON.stringify({ error: "dashboardData é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const persona = await resolvePersona("commercial_analytics", tenantId);

    const prompt = `Analise os dados do dashboard comercial abaixo e forneça insights estratégicos:

${JSON.stringify(dashboardData, null, 2)}

Retorne uma análise completa via tool calling com insights, riscos, ações e score.`;

    const response = await callGemini({
      persona,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{
        functionDeclarations: [{
          name: "commercial_analysis",
          description: "Análise completa do dashboard comercial com insights, riscos e recomendações",
          parameters: {
            type: "OBJECT",
            properties: {
              score_comercial: {
                type: "INTEGER",
                description: "Score de saúde comercial geral de 0 a 100"
              },
              score_label: {
                type: "STRING",
                description: "Label do score: Crítico, Atenção, Regular, Bom ou Excelente"
              },
              score_summary: {
                type: "STRING",
                description: "Resumo de 1-2 frases sobre a saúde comercial geral"
              },
              insights: {
                type: "ARRAY",
                description: "3 insights prioritários sobre o desempenho comercial",
                items: {
                  type: "OBJECT",
                  properties: {
                    titulo: { type: "STRING" },
                    descricao: { type: "STRING" },
                    impacto: { type: "STRING", description: "alto, médio ou baixo" },
                    metrica: { type: "STRING", description: "Dado quantitativo relevante" }
                  }
                }
              },
              riscos: {
                type: "ARRAY",
                description: "2 riscos identificados que precisam atenção",
                items: {
                  type: "OBJECT",
                  properties: {
                    titulo: { type: "STRING" },
                    descricao: { type: "STRING" },
                    urgencia: { type: "STRING", description: "imediato, esta_semana ou este_mes" }
                  }
                }
              },
              acoes: {
                type: "ARRAY",
                description: "3 ações recomendadas com impacto estimado",
                items: {
                  type: "OBJECT",
                  properties: {
                    titulo: { type: "STRING" },
                    descricao: { type: "STRING" },
                    urgencia: { type: "STRING", description: "imediato, esta_semana ou este_mes" },
                    impacto_estimado: { type: "STRING" }
                  }
                }
              },
              destaque_corretor: {
                type: "STRING",
                description: "Nome do corretor com melhor desempenho no período, ou vazio"
              },
              alerta_corretor: {
                type: "STRING",
                description: "Nome do corretor que precisa de atenção, ou vazio"
              },
              canal_melhor: {
                type: "STRING",
                description: "Canal de origem com melhor conversão"
              },
              canal_pior: {
                type: "STRING",
                description: "Canal de origem com pior conversão ou ROI"
              }
            },
            required: ["score_comercial", "score_label", "score_summary", "insights", "riscos", "acoes"]
          }
        }]
      }],
      toolConfig: { functionCallingConfig: { mode: "ANY" } }
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit atingido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes. Verifique seu plano." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao processar análise de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const data = await response.json();
    const funcCall = data?.candidates?.[0]?.content?.parts?.[0]?.functionCall;

    if (!funcCall?.args) {
      return new Response(JSON.stringify({ error: "IA não retornou análise estruturada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const result = funcCall.args;
    const ms = Date.now() - start;

    // Log async
    if (tenantId && userId) {
      logInteraction({
        tenantId, userId,
        functionKey: "commercial_analytics",
        inputSummary: `Score: ${result.score_comercial}, ${Object.keys(dashboardData).length} campos`,
        outputSummary: result.score_summary || "",
        responseTimeMs: ms,
      }).catch(() => {});
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("commercial-ai-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
