/**
 * relationship-ai-insights — v7
 * Migrated to _shared/resolve-persona.ts (centralized AI gateway).
 * CORS whitelist + error sanitization preserved from v6.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolvePersona, callGemini, logInteraction } from "../_shared/resolve-persona.ts";

// ── CORS whitelist ──────────────────────────────────────────────
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

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { dashboardData, tenantId } = body;

    // Resolve persona via shared helper (DB persona → tenant override → fallback)
    const persona = await resolvePersona("cs_analytics", tenantId);

    const prompt = `Dados do Dashboard de Relacionamento:\n${JSON.stringify(dashboardData, null, 2)}\n\nForneça uma análise completa de Customer Success com Health Score, riscos de churn, ações prioritárias e benchmarks.`;

    // Gemini-native tool format (functionDeclarations)
    const tools = [
      {
        functionDeclarations: [
          {
            name: "cs_analysis_result",
            description: "Structured CS analysis result",
            parameters: {
              type: "OBJECT",
              properties: {
                health_score: { type: "INTEGER", description: "0-100 overall health score" },
                health_label: { type: "STRING", description: "Saudável / Em Atenção / Crítico" },
                health_justification: { type: "STRING" },
                churn_risks: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      client: { type: "STRING" },
                      risk_level: { type: "STRING", description: "alto / médio / baixo" },
                      reason: { type: "STRING" },
                      mrr: { type: "NUMBER" },
                    },
                    required: ["client", "risk_level", "reason"],
                  },
                },
                priority_actions: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      action: { type: "STRING" },
                      urgency: { type: "STRING", description: "alta / média / baixa" },
                      impact: { type: "STRING" },
                      owner: { type: "STRING" },
                    },
                    required: ["action", "urgency", "impact"],
                  },
                },
                trends: { type: "STRING" },
                benchmark_summary: { type: "STRING" },
                upsell_opportunities: { type: "STRING" },
              },
              required: ["health_score", "health_label", "health_justification", "churn_risks", "priority_actions"],
            },
          },
        ],
      },
    ];

    const toolConfig = {
      functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["cs_analysis_result"] },
    };

    // Call AI via shared helper (handles gateway routing + response normalization)
    const aiResponse = await callGemini({
      persona,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools,
      toolConfig,
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await aiResponse.json();

    // Parse Google-format response (normalized by callGemini)
    const candidate = aiData.candidates?.[0]?.content?.parts?.[0];
    let result: any;

    if (candidate?.functionCall) {
      result = candidate.functionCall.args;
    } else if (candidate?.text) {
      // Fallback: try to parse text as JSON
      try {
        result = JSON.parse(candidate.text);
      } catch {
        result = { health_score: 50, health_label: "Em Atenção", health_justification: candidate.text, churn_risks: [], priority_actions: [] };
      }
    } else {
      throw new Error("No valid AI response");
    }

    // Fire-and-forget: log interaction
    logInteraction({
      tenantId: tenantId || "",
      userId: user.id,
      functionKey: "cs_analytics",
      inputSummary: `CS analytics dashboard analysis`,
      outputSummary: `Health score: ${result.health_score}, label: ${result.health_label}`,
      responseTimeMs: Date.now() - startTime,
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, analysis: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("relationship-ai-insights error:", e);
    return new Response(JSON.stringify({ error: "Erro interno na análise de relacionamento" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
