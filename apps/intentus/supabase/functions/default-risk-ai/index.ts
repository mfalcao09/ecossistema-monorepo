/**
 * default-risk-ai — v2
 * Migrated to _shared/resolve-persona.ts (centralized AI gateway).
 * CORS whitelist + error sanitization preserved.
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
    const { person_id, contract_id, tenantId } = body;

    // Resolve persona via shared helper (DB persona → tenant override → fallback)
    const persona = await resolvePersona("default_risk", tenantId);

    // Buscar histórico de parcelas do inquilino via contract_parties
    const { data: installments } = await supabase
      .from("contract_installments")
      .select("due_date, amount, status, paid_at, installment_number, contract_id")
      .in("contract_id",
        (await supabase
          .from("contract_parties")
          .select("contract_id")
          .eq("person_id", person_id)
          .then(r => (r.data || []).map((x: any) => x.contract_id))
        )
      )
      .order("due_date", { ascending: false })
      .limit(36);

    // Buscar tickets abertos do inquilino (coluna correta: person_id)
    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("status, priority, category, created_at")
      .eq("person_id", person_id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Buscar dados da pessoa
    const { data: person } = await supabase
      .from("people")
      .select("name, cpf_cnpj, person_type, created_at")
      .eq("id", person_id)
      .single();

    // Buscar contratos ativos da pessoa
    const { data: contracts } = await supabase
      .from("contract_parties")
      .select("role, contracts(id, status, monthly_value, start_date, adjustment_index)")
      .eq("person_id", person_id);

    // Calcular estatísticas de pagamento
    const allInstallments = installments || [];
    const paid = allInstallments.filter((i: any) => i.status === "pago");
    const late = allInstallments.filter((i: any) => i.status === "atrasado" || (i.status === "pago" && i.paid_at && new Date(i.paid_at) > new Date(i.due_date)));
    const pending = allInstallments.filter((i: any) => i.status === "pendente");

    const paymentStats = {
      total: allInstallments.length,
      paid_on_time: paid.length - late.filter((i: any) => i.status === "pago").length,
      paid_late: late.filter((i: any) => i.status === "pago").length,
      currently_overdue: late.filter((i: any) => i.status === "atrasado").length,
      pending: pending.length,
      late_rate: allInstallments.length > 0 ? (late.length / allInstallments.length * 100).toFixed(1) : "0",
    };

    const context = {
      person: person || { id: person_id },
      payment_stats: paymentStats,
      recent_installments: allInstallments.slice(0, 12).map((i: any) => ({
        due_date: i.due_date,
        amount: i.amount,
        status: i.status,
        paid_at: i.paid_at,
      })),
      tickets: tickets || [],
      active_contracts: contracts || [],
    };

    const prompt = `Analise o risco de inadimplência com base nos dados abaixo e forneça um score e recomendações:\n\n${JSON.stringify(context, null, 2)}`;

    // Gemini-native tool format (functionDeclarations)
    const tools = [
      {
        functionDeclarations: [
          {
            name: "risk_assessment",
            description: "Retorna análise de risco de inadimplência do inquilino",
            parameters: {
              type: "OBJECT",
              properties: {
                risk_score: { type: "NUMBER", description: "Score de risco de 0 (sem risco) a 100 (alto risco)" },
                risk_level: { type: "STRING", description: "baixo / medio / alto / critico" },
                probability_default: { type: "NUMBER", description: "Probabilidade de inadimplência % nos próximos 90 dias" },
                payment_behavior: { type: "STRING", description: "Análise do comportamento de pagamento" },
                risk_factors: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                  description: "Fatores que aumentam o risco",
                },
                positive_factors: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                  description: "Fatores positivos do histórico",
                },
                recommended_action: { type: "STRING", description: "monitorar / contato_preventivo / acordo_amigavel / notificacao_formal / encaminhar_juridico" },
                recommended_action_label: { type: "STRING", description: "Descrição da ação recomendada" },
                reasoning: { type: "STRING", description: "Justificativa detalhada da análise" },
              },
              required: ["risk_score", "risk_level", "probability_default", "recommended_action", "recommended_action_label", "reasoning"],
            },
          },
        ],
      },
    ];

    const toolConfig = {
      functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["risk_assessment"] },
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
        result = {
          risk_score: 50,
          risk_level: "medio",
          probability_default: 25,
          recommended_action: "monitorar",
          recommended_action_label: "Monitorar situação",
          reasoning: candidate.text,
        };
      }
    } else {
      throw new Error("No valid AI response");
    }

    // Fire-and-forget: log interaction
    logInteraction({
      tenantId: tenantId || "",
      userId: user.id,
      functionKey: "default_risk",
      inputSummary: `Risk analysis for person ${person_id}`,
      outputSummary: `Risk score: ${result.risk_score}, level: ${result.risk_level}`,
      responseTimeMs: Date.now() - startTime,
    }).catch(() => {});

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("default-risk-ai error:", e);
    return new Response(JSON.stringify({ error: "Erro interno na análise de risco" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
