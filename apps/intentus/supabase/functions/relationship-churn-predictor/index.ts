/**
 * relationship-churn-predictor — v1
 * Churn Prediction Engine Multi-Dimensional (F7)
 *
 * 3 signal layers:
 *   - Quantitative: tickets, payments, response rates, login frequency
 *   - Qualitative: sentiment analysis on messages/tickets via Gemini
 *   - Contextual: contract expiry, market conditions, maintenance patterns
 *
 * Output: score 0-100 + risk_level + top_reasons + recommended_actions
 *
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 * Created: 2026-03-21
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolvePersona, callGemini, logInteraction } from "../_shared/resolve-persona.ts";

// ── CORS whitelist ──────────────────────────────────────────
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

// ── Signal Collectors ───────────────────────────────────────

interface SignalResult {
  name: string;
  type: "quantitative" | "qualitative" | "contextual";
  value: number;
  weight: number;
  detail: string;
}

async function collectQuantitativeSignals(
  supabase: any,
  tenantId: string,
  contractId: string,
  personId: string | null,
): Promise<SignalResult[]> {
  const signals: SignalResult[] = [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // 1. Ticket frequency (last 30/60/90 days)
  const { data: tickets = [] } = await supabase
    .from("tickets")
    .select("id, status, priority, sla_deadline, created_at, updated_at, category")
    .eq("tenant_id", tenantId)
    .or(`contract_id.eq.${contractId}${personId ? `,person_id.eq.${personId}` : ""}`)
    .gte("created_at", ninetyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  const tickets30d = tickets.filter((t: any) => new Date(t.created_at) >= thirtyDaysAgo);
  const tickets60d = tickets.filter((t: any) => new Date(t.created_at) >= sixtyDaysAgo);

  // High ticket volume = frustration signal
  const ticketFreq30 = tickets30d.length;
  if (ticketFreq30 > 3) {
    signals.push({
      name: "high_ticket_frequency_30d",
      type: "quantitative",
      value: Math.min(ticketFreq30 * 10, 80),
      weight: 1.5,
      detail: `${ticketFreq30} tickets nos últimos 30 dias (acima da média)`,
    });
  }

  // Ticket trend: increasing = bad
  const tickets30to60 = tickets60d.length - tickets30d.length;
  if (ticketFreq30 > tickets30to60 && tickets30to60 > 0) {
    const increase = Math.round(((ticketFreq30 - tickets30to60) / tickets30to60) * 100);
    signals.push({
      name: "ticket_trend_increasing",
      type: "quantitative",
      value: Math.min(increase, 70),
      weight: 1.2,
      detail: `Tickets aumentaram ${increase}% nos últimos 30d vs período anterior`,
    });
  }

  // SLA breaches
  const slaBreached = tickets.filter((t: any) =>
    t.sla_deadline &&
    new Date(t.sla_deadline) < now &&
    t.status !== "resolvido" &&
    t.status !== "cancelado"
  );
  if (slaBreached.length > 0) {
    signals.push({
      name: "sla_breaches",
      type: "quantitative",
      value: Math.min(slaBreached.length * 20, 90),
      weight: 2.0,
      detail: `${slaBreached.length} SLAs estourados sem resolução`,
    });
  }

  // 2. Payment delays
  const { data: installments = [] } = await supabase
    .from("installments")
    .select("id, status, due_date, paid_at")
    .eq("tenant_id", tenantId)
    .eq("contract_id", contractId)
    .in("status", ["overdue", "pending"])
    .gte("due_date", ninetyDaysAgo.toISOString())
    .order("due_date", { ascending: false });

  const overdueCount = installments.filter((i: any) => i.status === "overdue").length;
  if (overdueCount > 0) {
    signals.push({
      name: "payment_delays",
      type: "quantitative",
      value: Math.min(overdueCount * 25, 95),
      weight: 2.5,
      detail: `${overdueCount} parcelas em atraso nos últimos 90 dias`,
    });
  }

  // 3. Satisfaction survey responses
  if (personId) {
    const { data: npsResponses = [] } = await supabase
      .from("satisfaction_responses")
      .select("score, responded_at")
      .eq("tenant_id", tenantId)
      .eq("person_id", personId)
      .order("responded_at", { ascending: false })
      .limit(5);

    if (npsResponses.length > 0) {
      const latestScore = npsResponses[0].score;
      if (latestScore <= 6) {
        signals.push({
          name: "low_nps_score",
          type: "quantitative",
          value: (7 - latestScore) * 12,
          weight: 2.0,
          detail: `NPS score ${latestScore}/10 — classificado como Detrator`,
        });
      }

      // NPS declining trend
      if (npsResponses.length >= 2) {
        const avg_recent = npsResponses.slice(0, 2).reduce((s: number, r: any) => s + r.score, 0) / 2;
        const avg_older = npsResponses.slice(2).reduce((s: number, r: any) => s + r.score, 0) / Math.max(1, npsResponses.slice(2).length);
        if (avg_recent < avg_older - 1) {
          signals.push({
            name: "nps_declining",
            type: "quantitative",
            value: Math.min(Math.round((avg_older - avg_recent) * 10), 60),
            weight: 1.5,
            detail: `NPS caindo: média recente ${avg_recent.toFixed(1)} vs anterior ${avg_older.toFixed(1)}`,
          });
        }
      }
    }
  }

  // 4. Maintenance requests
  const { data: maintenanceReqs = [] } = await supabase
    .from("maintenance_requests")
    .select("id, status, priority, created_at")
    .eq("tenant_id", tenantId)
    .eq("contract_id", contractId)
    .gte("created_at", ninetyDaysAgo.toISOString());

  const pendingMaint = maintenanceReqs.filter((m: any) => m.status !== "concluido" && m.status !== "cancelado");
  if (pendingMaint.length >= 2) {
    signals.push({
      name: "pending_maintenance",
      type: "quantitative",
      value: Math.min(pendingMaint.length * 15, 60),
      weight: 1.0,
      detail: `${pendingMaint.length} manutenções pendentes`,
    });
  }

  return signals;
}

async function collectContextualSignals(
  supabase: any,
  tenantId: string,
  contractId: string,
  contract: any,
): Promise<SignalResult[]> {
  const signals: SignalResult[] = [];
  const now = new Date();

  // 1. Contract expiry proximity
  if (contract.end_date) {
    const endDate = new Date(contract.end_date);
    const daysToExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (daysToExpiry <= 30 && daysToExpiry > 0) {
      // Check if there's an active renewal
      const { data: renewals = [] } = await supabase
        .from("contract_renewals")
        .select("id, status")
        .eq("contract_id", contractId)
        .not("status", "eq", "cancelada")
        .limit(1);

      if (renewals.length === 0) {
        signals.push({
          name: "expiring_no_renewal",
          type: "contextual",
          value: 90,
          weight: 3.0,
          detail: `Contrato vence em ${daysToExpiry} dias SEM renovação iniciada`,
        });
      } else {
        signals.push({
          name: "expiring_with_renewal",
          type: "contextual",
          value: 20,
          weight: 0.5,
          detail: `Contrato vence em ${daysToExpiry} dias — renovação em andamento`,
        });
      }
    } else if (daysToExpiry <= 90 && daysToExpiry > 30) {
      const { data: renewals = [] } = await supabase
        .from("contract_renewals")
        .select("id, status")
        .eq("contract_id", contractId)
        .not("status", "eq", "cancelada")
        .limit(1);

      if (renewals.length === 0) {
        signals.push({
          name: "expiring_soon_no_renewal",
          type: "contextual",
          value: 55,
          weight: 2.0,
          detail: `Contrato vence em ${daysToExpiry} dias sem renovação iniciada`,
        });
      }
    }
  }

  // 2. Contract value vs market (high-value clients are higher risk impact)
  const monthlyValue = contract.monthly_value || 0;
  if (monthlyValue > 5000) {
    signals.push({
      name: "high_value_contract",
      type: "contextual",
      value: 30,
      weight: 1.5,
      detail: `Contrato de alto valor: R$ ${monthlyValue.toLocaleString("pt-BR")}/mês — impacto financeiro elevado`,
    });
  }

  // 3. Contract age (very new or very old both risky)
  if (contract.start_date) {
    const startDate = new Date(contract.start_date);
    const contractAgeMonths = Math.floor((now.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000));

    if (contractAgeMonths <= 3) {
      signals.push({
        name: "new_contract",
        type: "contextual",
        value: 35,
        weight: 1.0,
        detail: `Contrato novo (${contractAgeMonths} meses) — período crítico de adaptação`,
      });
    }
  }

  // 4. Insurance gaps
  const { data: policies = [] } = await supabase
    .from("insurance_policies")
    .select("id, status, end_date, insurance_type")
    .eq("tenant_id", tenantId)
    .eq("contract_id", contractId)
    .eq("status", "active");

  const expiringPolicies = policies.filter((p: any) => {
    if (!p.end_date) return false;
    const daysToExpiry = Math.ceil((new Date(p.end_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return daysToExpiry <= 30 && daysToExpiry > 0;
  });

  if (expiringPolicies.length > 0) {
    signals.push({
      name: "insurance_expiring",
      type: "contextual",
      value: 25,
      weight: 0.8,
      detail: `${expiringPolicies.length} apólice(s) de seguro vencendo em 30 dias`,
    });
  }

  return signals;
}

// ── Gemini Qualitative Analysis ─────────────────────────────

async function analyzeQualitativeSignals(
  persona: any,
  contract: any,
  quantSignals: SignalResult[],
  contextSignals: SignalResult[],
  ticketTexts: string[],
): Promise<any> {
  const signalsSummary = [...quantSignals, ...contextSignals].map(s => ({
    name: s.name,
    type: s.type,
    value: s.value,
    detail: s.detail,
  }));

  const prompt = `Você é um especialista em predição de churn no mercado imobiliário brasileiro.

DADOS DO CONTRATO:
- Imóvel: ${contract.property_street || "N/A"}
- Valor mensal: R$ ${(contract.monthly_value || 0).toLocaleString("pt-BR")}
- Status: ${contract.status}
- Início: ${contract.start_date || "N/A"}
- Fim: ${contract.end_date || "N/A"}
- Tipo: ${contract.contract_type || "N/A"}

SINAIS JÁ DETECTADOS (quantitativos + contextuais):
${JSON.stringify(signalsSummary, null, 2)}

${ticketTexts.length > 0 ? `ÚLTIMAS MENSAGENS/TICKETS DO CLIENTE (analise sentimento):
${ticketTexts.slice(0, 5).join("\n---\n")}` : "Sem mensagens recentes para análise de sentimento."}

Com base em TODOS estes dados, forneça sua análise de churn usando a ferramenta churn_prediction_result.`;

  const tools = [
    {
      functionDeclarations: [
        {
          name: "churn_prediction_result",
          description: "Structured churn prediction output",
          parameters: {
            type: "OBJECT",
            properties: {
              churn_score: {
                type: "INTEGER",
                description: "0-100 churn probability score. 0=sem risco, 100=churn iminente",
              },
              risk_level: {
                type: "STRING",
                description: "critical (>80) / high (60-80) / medium (40-60) / low (<40)",
              },
              top_reasons: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    reason: { type: "STRING", description: "Razão do risco em linguagem natural" },
                    weight: { type: "NUMBER", description: "Peso 0-1 no score final" },
                    category: { type: "STRING", description: "financial / service / contract / satisfaction / behavioral" },
                  },
                  required: ["reason", "weight", "category"],
                },
              },
              recommended_actions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    action: { type: "STRING", description: "Ação recomendada em linguagem natural" },
                    priority: { type: "STRING", description: "urgente / alta / média / baixa" },
                    type: { type: "STRING", description: "contact / offer / escalation / task / notification" },
                    script: { type: "STRING", description: "Script sugerido para o CS usar no contato" },
                  },
                  required: ["action", "priority", "type"],
                },
              },
              sentiment_analysis: {
                type: "STRING",
                description: "Análise de sentimento das mensagens do cliente (se disponíveis)",
              },
              qualitative_signals: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    signal: { type: "STRING" },
                    severity: { type: "STRING", description: "high / medium / low" },
                  },
                  required: ["signal", "severity"],
                },
              },
              retention_probability: {
                type: "INTEGER",
                description: "0-100 probabilidade de reter o cliente se ações forem tomadas",
              },
            },
            required: ["churn_score", "risk_level", "top_reasons", "recommended_actions"],
          },
        },
      ],
    },
  ];

  const toolConfig = {
    functionCallingConfig: {
      mode: "ANY",
      allowedFunctionNames: ["churn_prediction_result"],
    },
  };

  const aiResponse = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools,
    toolConfig,
  });

  if (!aiResponse.ok) {
    const status = aiResponse.status;
    throw new Error(`AI error: ${status}`);
  }

  const aiData = await aiResponse.json();
  const candidate = aiData.candidates?.[0]?.content?.parts?.[0];

  if (candidate?.functionCall) {
    return candidate.functionCall.args;
  } else if (candidate?.text) {
    try {
      return JSON.parse(candidate.text);
    } catch {
      return {
        churn_score: 50,
        risk_level: "medium",
        top_reasons: [{ reason: "Análise inconclusiva", weight: 1, category: "behavioral" }],
        recommended_actions: [{ action: "Revisar manualmente", priority: "média", type: "task" }],
      };
    }
  }

  throw new Error("No valid AI response");
}

// ── Main Handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { contractId, tenantId, predictionWindow = 30 } = body;

    if (!contractId || !tenantId) {
      return new Response(JSON.stringify({ error: "contractId and tenantId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch contract data
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select(`
        id, status, contract_type, start_date, end_date, monthly_value,
        tenant_id, person_id, property_id,
        properties!inner(street, neighborhood, city)
      `)
      .eq("id", contractId)
      .maybeSingle();

    if (contractError || !contract) {
      return new Response(JSON.stringify({ error: "Contract not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const personId = contract.person_id;
    const propertyStreet = (contract.properties as any)?.street || "";

    // Collect signals in parallel
    const [quantSignals, contextSignals] = await Promise.all([
      collectQuantitativeSignals(supabase, tenantId, contractId, personId),
      collectContextualSignals(supabase, tenantId, contractId, contract),
    ]);

    // Fetch recent ticket/communication texts for sentiment analysis
    const { data: recentTickets = [] } = await supabase
      .from("tickets")
      .select("title, description, created_at")
      .eq("tenant_id", tenantId)
      .or(`contract_id.eq.${contractId}${personId ? `,person_id.eq.${personId}` : ""}`)
      .order("created_at", { ascending: false })
      .limit(5);

    const ticketTexts = recentTickets.map((t: any) =>
      `[${t.created_at}] ${t.title}: ${t.description || "sem descrição"}`
    );

    // AI qualitative analysis
    const persona = await resolvePersona("churn_predictor", tenantId);
    const aiResult = await analyzeQualitativeSignals(
      persona,
      { ...contract, property_street: propertyStreet },
      quantSignals,
      contextSignals,
      ticketTexts,
    );

    // Determine risk level from score
    const score = Math.max(0, Math.min(100, aiResult.churn_score || 50));
    const riskLevel = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "medium" : "low";

    // Persist signals
    const allSignals = [...quantSignals, ...contextSignals];
    if (allSignals.length > 0) {
      const signalRows = allSignals.map(s => ({
        tenant_id: tenantId,
        person_id: personId,
        contract_id: contractId,
        signal_type: s.type,
        signal_name: s.name,
        signal_value: s.value,
        weight: s.weight,
        raw_data: { detail: s.detail },
      }));

      await serviceSupabase.from("churn_signals").insert(signalRows).throwOnError();
    }

    // Persist prediction
    const predictionRow = {
      tenant_id: tenantId,
      person_id: personId,
      contract_id: contractId,
      score,
      risk_level: riskLevel,
      prediction_window: predictionWindow,
      top_reasons: aiResult.top_reasons || [],
      recommended_actions: aiResult.recommended_actions || [],
      signals_summary: {
        quantitative: quantSignals.length,
        qualitative: aiResult.qualitative_signals?.length || 0,
        contextual: contextSignals.length,
        total_signals: allSignals.length + (aiResult.qualitative_signals?.length || 0),
        sentiment: aiResult.sentiment_analysis || null,
        retention_probability: aiResult.retention_probability || null,
      },
      model_version: "v1",
      expires_at: new Date(Date.now() + predictionWindow * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data: prediction, error: insertError } = await serviceSupabase
      .from("churn_predictions")
      .insert(predictionRow)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save prediction:", insertError);
    }

    // Log interaction
    logInteraction({
      tenantId,
      userId: user.id,
      functionKey: "churn_predictor",
      inputSummary: `Churn prediction for contract ${contractId.slice(0, 8)}`,
      outputSummary: `Score: ${score} (${riskLevel}), ${aiResult.top_reasons?.length || 0} reasons, ${aiResult.recommended_actions?.length || 0} actions`,
      responseTimeMs: Date.now() - startTime,
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        prediction: {
          id: prediction?.id,
          score,
          risk_level: riskLevel,
          prediction_window: predictionWindow,
          top_reasons: aiResult.top_reasons || [],
          recommended_actions: aiResult.recommended_actions || [],
          signals_summary: predictionRow.signals_summary,
          sentiment_analysis: aiResult.sentiment_analysis || null,
          retention_probability: aiResult.retention_probability || null,
          qualitative_signals: aiResult.qualitative_signals || [],
          predicted_at: prediction?.predicted_at || new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("relationship-churn-predictor error:", e);

    if ((e as any)?.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit atingido. Tente novamente em instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Erro interno na predição de churn" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
