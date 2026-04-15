/**
 * relationship-revenue-ltv — v1
 * F12: Revenue Attribution & LTV Predictor
 *
 * 10 actions:
 *   - get_attributions: List revenue attributions (with filters)
 *   - add_attribution: Create revenue attribution
 *   - get_predictions: List LTV predictions (with filters)
 *   - get_prediction: Get single LTV prediction for a person
 *   - get_snapshots: Get LTV history snapshots for a person
 *   - calculate_ltv: AI calculates LTV predictions for all/specific clients
 *   - attribute_revenue: AI analyzes touchpoints and attributes revenue
 *   - get_stats: Dashboard statistics (revenue by channel, LTV distribution, segments)
 *   - get_roi_by_channel: ROI analysis per channel/touchpoint
 *   - get_segment_analysis: Detailed segment breakdown with trends
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

// ── AI Tool Declarations ────────────────────────────────────
const LTV_PREDICTION_TOOL = [
  {
    functionDeclarations: [
      {
        name: "ltv_predictions",
        description: "LTV predictions for clients based on their data",
        parameters: {
          type: "OBJECT",
          properties: {
            predictions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  person_id: { type: "STRING" },
                  current_ltv: { type: "NUMBER" },
                  predicted_ltv_12m: { type: "NUMBER" },
                  predicted_ltv_36m: { type: "NUMBER" },
                  predicted_ltv_lifetime: { type: "NUMBER" },
                  confidence_score: { type: "NUMBER" },
                  ltv_segment: { type: "STRING", enum: ["platinum", "gold", "silver", "bronze", "at_risk", "churned"] },
                  tenure_months: { type: "NUMBER" },
                  total_contracts: { type: "NUMBER" },
                  total_revenue: { type: "NUMBER" },
                  avg_monthly_revenue: { type: "NUMBER" },
                  payment_score: { type: "NUMBER" },
                  engagement_score: { type: "NUMBER" },
                  churn_probability: { type: "NUMBER" },
                  expansion_probability: { type: "NUMBER" },
                  referral_potential: { type: "NUMBER" },
                  risk_factors: { type: "ARRAY", items: { type: "OBJECT", properties: { factor: { type: "STRING" }, severity: { type: "STRING" }, detail: { type: "STRING" } } } },
                  growth_drivers: { type: "ARRAY", items: { type: "OBJECT", properties: { driver: { type: "STRING" }, potential: { type: "STRING" }, detail: { type: "STRING" } } } },
                  recommended_actions: { type: "ARRAY", items: { type: "OBJECT", properties: { action: { type: "STRING" }, priority: { type: "STRING" }, expected_impact: { type: "STRING" } } } },
                },
                required: ["person_id", "current_ltv", "predicted_ltv_12m", "confidence_score", "ltv_segment"],
              },
            },
            summary: { type: "STRING" },
            total_portfolio_ltv: { type: "NUMBER" },
            avg_client_ltv: { type: "NUMBER" },
          },
          required: ["predictions", "summary"],
        },
      },
    ],
  },
];

const REVENUE_ATTRIBUTION_TOOL = [
  {
    functionDeclarations: [
      {
        name: "revenue_attributions",
        description: "Revenue attribution analysis for touchpoints and channels",
        parameters: {
          type: "OBJECT",
          properties: {
            attributions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  person_id: { type: "STRING" },
                  contract_id: { type: "STRING" },
                  attribution_type: { type: "STRING" },
                  channel: { type: "STRING" },
                  touchpoint: { type: "STRING" },
                  source_detail: { type: "STRING" },
                  revenue_amount: { type: "NUMBER" },
                  attribution_weight: { type: "NUMBER" },
                  touchpoint_date: { type: "STRING" },
                  conversion_date: { type: "STRING" },
                  days_to_conversion: { type: "NUMBER" },
                },
                required: ["channel", "touchpoint", "revenue_amount", "attribution_weight"],
              },
            },
            summary: { type: "STRING" },
            top_channel: { type: "STRING" },
            top_touchpoint: { type: "STRING" },
            total_attributed_revenue: { type: "NUMBER" },
          },
          required: ["attributions", "summary", "total_attributed_revenue"],
        },
      },
    ],
  },
];

// ── Data Fetchers ───────────────────────────────────────────
async function fetchTenantClients(sb: any, tenantId: string) {
  const { data } = await sb.from("people").select("id, full_name, email, phone, tags, lead_source, created_at").eq("tenant_id", tenantId).limit(200);
  return data || [];
}

async function fetchTenantContracts(sb: any, tenantId: string) {
  const { data } = await sb.from("contracts").select("id, person_id, property_id, contract_type, status, start_date, end_date, monthly_value, total_value, payment_day, created_at").eq("tenant_id", tenantId).limit(300);
  return data || [];
}

async function fetchAllPayments(sb: any, tenantId: string) {
  const { data } = await sb.from("payments").select("id, contract_id, amount, due_date, paid_date, status, payment_method").eq("tenant_id", tenantId).order("due_date", { ascending: false }).limit(1000);
  return data || [];
}

async function fetchInteractions(sb: any, tenantId: string) {
  const { data } = await sb.from("client_interactions").select("id, person_id, interaction_type, channel, subject, sentiment_score, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500);
  return data || [];
}

async function fetchExistingPredictions(sb: any, tenantId: string) {
  const { data } = await sb.from("ltv_predictions").select("id, person_id, ltv_segment, predicted_ltv_lifetime, last_calculated_at").eq("tenant_id", tenantId);
  return data || [];
}

// ── Handlers ────────────────────────────────────────────────
async function handleCalculateLtv(sb: any, tenantId: string, profileId: string, personId?: string) {
  const [clients, contracts, payments, interactions, existing] = await Promise.all([
    fetchTenantClients(sb, tenantId),
    fetchTenantContracts(sb, tenantId),
    fetchAllPayments(sb, tenantId),
    fetchInteractions(sb, tenantId),
    fetchExistingPredictions(sb, tenantId),
  ]);

  const targetClients = personId ? clients.filter((c: any) => c.id === personId) : clients;
  if (!targetClients.length) return { predictions: [], summary: "Nenhum cliente encontrado." };

  const persona = await resolvePersona("revenue_ltv_ai", tenantId);
  const userMessage = `Calcule o LTV (Lifetime Value) para ${targetClients.length} clientes.

DADOS DO TENANT:
- ${clients.length} clientes totais
- ${contracts.length} contratos
- ${payments.length} pagamentos
- ${interactions.length} interações

CLIENTES ALVO: ${JSON.stringify(targetClients.slice(0, 50))}
CONTRATOS: ${JSON.stringify(contracts.slice(0, 100))}
PAGAMENTOS: ${JSON.stringify(payments.slice(0, 200))}
INTERAÇÕES: ${JSON.stringify(interactions.slice(0, 100))}
PREDIÇÕES EXISTENTES: ${JSON.stringify(existing)}

Para cada cliente, calcule: current_ltv, predicted_ltv_12m, predicted_ltv_36m, predicted_ltv_lifetime, confidence_score, ltv_segment, payment_score, engagement_score, churn_probability, expansion_probability, referral_potential. Inclua risk_factors, growth_drivers e recommended_actions.`;

  const aiResponse = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    tools: LTV_PREDICTION_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["ltv_predictions"] } }
  });
  if (!aiResponse.ok) throw new Error("AI error: " + aiResponse.status);
  const aiData = await aiResponse.json();
  const fnCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  const result = fnCall?.args;
  if (!result?.predictions?.length) return { predictions: [], summary: "IA não gerou predições." };

  const now = new Date().toISOString();
  let upserted = 0;

  for (const p of result.predictions) {
    // Check existing prediction
    const { data: existingPred } = await sb.from("ltv_predictions").select("id, ltv_segment").eq("tenant_id", tenantId).eq("person_id", p.person_id).maybeSingle();

    const row = {
      tenant_id: tenantId,
      person_id: p.person_id,
      current_ltv: p.current_ltv || 0,
      predicted_ltv_12m: p.predicted_ltv_12m,
      predicted_ltv_36m: p.predicted_ltv_36m,
      predicted_ltv_lifetime: p.predicted_ltv_lifetime,
      confidence_score: Math.min(1, Math.max(0, p.confidence_score || 0.5)),
      ltv_segment: p.ltv_segment || "bronze",
      tenure_months: p.tenure_months || 0,
      total_contracts: p.total_contracts || 0,
      total_revenue: p.total_revenue || 0,
      avg_monthly_revenue: p.avg_monthly_revenue || 0,
      payment_score: Math.min(100, Math.max(0, p.payment_score || 0)),
      engagement_score: Math.min(100, Math.max(0, p.engagement_score || 0)),
      churn_probability: Math.min(1, Math.max(0, p.churn_probability || 0)),
      expansion_probability: Math.min(1, Math.max(0, p.expansion_probability || 0)),
      referral_potential: Math.min(100, Math.max(0, p.referral_potential || 0)),
      risk_factors: p.risk_factors || [],
      growth_drivers: p.growth_drivers || [],
      recommended_actions: p.recommended_actions || [],
      ai_generated: true,
      last_calculated_at: now,
    };

    if (existingPred) {
      // Update + track segment change
      const updates: any = { ...row, previous_segment: existingPred.ltv_segment };
      if (existingPred.ltv_segment !== p.ltv_segment) updates.segment_changed_at = now;
      await sb.from("ltv_predictions").update(updates).eq("id", existingPred.id);
    } else {
      await sb.from("ltv_predictions").insert(row);
    }

    // Save snapshot
    await sb.from("ltv_snapshots").insert({
      tenant_id: tenantId,
      person_id: p.person_id,
      current_ltv: p.current_ltv || 0,
      predicted_ltv_12m: p.predicted_ltv_12m,
      predicted_ltv_lifetime: p.predicted_ltv_lifetime,
      ltv_segment: p.ltv_segment,
      churn_probability: p.churn_probability,
      confidence_score: p.confidence_score,
    });

    upserted++;
  }

  await logInteraction({ tenantId, userId: profileId, functionKey: "revenue_ltv_ai", inputSummary: userMessage.slice(0, 500), outputSummary: JSON.stringify(result).slice(0, 500) }).catch(() => {});

  return { predictions_count: upserted, summary: result.summary, total_portfolio_ltv: result.total_portfolio_ltv, avg_client_ltv: result.avg_client_ltv };
}

async function handleAttributeRevenue(sb: any, tenantId: string, profileId: string) {
  const [clients, contracts, payments, interactions] = await Promise.all([
    fetchTenantClients(sb, tenantId),
    fetchTenantContracts(sb, tenantId),
    fetchAllPayments(sb, tenantId),
    fetchInteractions(sb, tenantId),
  ]);

  const persona = await resolvePersona("revenue_ltv_ai", tenantId);
  const userMessage = `Analise os dados do tenant e atribua receita aos touchpoints e canais corretos.

DADOS:
- ${clients.length} clientes (lead_source disponível)
- ${contracts.length} contratos (com valores e datas)
- ${payments.length} pagamentos
- ${interactions.length} interações (com canal e tipo)

CLIENTES: ${JSON.stringify(clients.slice(0, 50))}
CONTRATOS: ${JSON.stringify(contracts.slice(0, 80))}
PAGAMENTOS: ${JSON.stringify(payments.slice(0, 150))}
INTERAÇÕES: ${JSON.stringify(interactions.slice(0, 100))}

Atribua receita usando o modelo mais apropriado para cada caso. Identifique o canal e touchpoint mais eficazes.`;

  const aiResponse = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    tools: REVENUE_ATTRIBUTION_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["revenue_attributions"] } }
  });
  if (!aiResponse.ok) throw new Error("AI error: " + aiResponse.status);
  const aiData = await aiResponse.json();
  const fnCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  const result = fnCall?.args;
  if (!result?.attributions?.length) return { attributions: [], summary: "IA não gerou atribuições." };

  const rows = result.attributions.map((a: any) => ({
    tenant_id: tenantId,
    person_id: a.person_id || null,
    contract_id: a.contract_id || null,
    attribution_type: a.attribution_type || "algorithmic",
    channel: a.channel,
    touchpoint: a.touchpoint,
    source_detail: a.source_detail || null,
    revenue_amount: a.revenue_amount || 0,
    attribution_weight: Math.min(1, Math.max(0, a.attribution_weight || 1)),
    touchpoint_date: a.touchpoint_date || null,
    conversion_date: a.conversion_date || null,
    days_to_conversion: a.days_to_conversion || null,
    ai_generated: true,
    ai_confidence: 0.75,
  }));

  const { data: inserted } = await sb.from("revenue_attributions").insert(rows).select("id");
  await logInteraction({ tenantId, userId: profileId, functionKey: "revenue_ltv_ai", inputSummary: userMessage.slice(0, 500), outputSummary: JSON.stringify(result).slice(0, 500) }).catch(() => {});

  return { count: (inserted || []).length, summary: result.summary, top_channel: result.top_channel, top_touchpoint: result.top_touchpoint, total_attributed_revenue: result.total_attributed_revenue };
}

async function handleGetStats(sb: any, tenantId: string) {
  const [{ data: attrs }, { data: preds }] = await Promise.all([
    sb.from("revenue_attributions").select("id, channel, touchpoint, revenue_amount, attribution_weight, attributed_revenue").eq("tenant_id", tenantId),
    sb.from("ltv_predictions").select("id, person_id, ltv_segment, current_ltv, predicted_ltv_lifetime, churn_probability, payment_score, engagement_score").eq("tenant_id", tenantId),
  ]);

  const attributions = attrs || [];
  const predictions = preds || [];

  // Revenue by channel
  const by_channel: Record<string, { count: number; revenue: number }> = {};
  for (const a of attributions) {
    if (!by_channel[a.channel]) by_channel[a.channel] = { count: 0, revenue: 0 };
    by_channel[a.channel].count++;
    by_channel[a.channel].revenue += a.attributed_revenue || (a.revenue_amount * a.attribution_weight) || 0;
  }

  // Revenue by touchpoint
  const by_touchpoint: Record<string, { count: number; revenue: number }> = {};
  for (const a of attributions) {
    if (!by_touchpoint[a.touchpoint]) by_touchpoint[a.touchpoint] = { count: 0, revenue: 0 };
    by_touchpoint[a.touchpoint].count++;
    by_touchpoint[a.touchpoint].revenue += a.attributed_revenue || (a.revenue_amount * a.attribution_weight) || 0;
  }

  // LTV segments
  const by_segment: Record<string, { count: number; total_ltv: number; avg_ltv: number }> = {};
  let total_predicted_ltv = 0;
  let total_current_ltv = 0;

  for (const p of predictions) {
    if (!by_segment[p.ltv_segment]) by_segment[p.ltv_segment] = { count: 0, total_ltv: 0, avg_ltv: 0 };
    by_segment[p.ltv_segment].count++;
    by_segment[p.ltv_segment].total_ltv += p.predicted_ltv_lifetime || 0;
    total_predicted_ltv += p.predicted_ltv_lifetime || 0;
    total_current_ltv += p.current_ltv || 0;
  }

  for (const seg of Object.values(by_segment)) {
    seg.avg_ltv = seg.count ? Math.round(seg.total_ltv / seg.count) : 0;
  }

  return {
    attributions: { total: attributions.length, by_channel, by_touchpoint },
    predictions: {
      total_clients: predictions.length,
      by_segment,
      total_predicted_ltv: Math.round(total_predicted_ltv),
      total_current_ltv: Math.round(total_current_ltv),
      avg_ltv: predictions.length ? Math.round(total_predicted_ltv / predictions.length) : 0,
      avg_churn: predictions.length ? +(predictions.reduce((s: number, p: any) => s + (p.churn_probability || 0), 0) / predictions.length).toFixed(4) : 0,
      avg_payment_score: predictions.length ? Math.round(predictions.reduce((s: number, p: any) => s + (p.payment_score || 0), 0) / predictions.length) : 0,
    },
  };
}

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(sbUrl, sbKey);

    const authClient = createClient(sbUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await sb.from("profiles").select("id, tenant_id").eq("user_id", user.id).maybeSingle();
    if (!profile) return new Response(JSON.stringify({ error: "Profile not found" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { tenant_id: tenantId, id: profileId } = profile;
    const { action, ...params } = await req.json();
    let result: any;

    switch (action) {
      case "get_attributions": {
        let q = sb.from("revenue_attributions").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
        if (params.channel) q = q.eq("channel", params.channel);
        if (params.touchpoint) q = q.eq("touchpoint", params.touchpoint);
        if (params.person_id) q = q.eq("person_id", params.person_id);
        if (params.attribution_type) q = q.eq("attribution_type", params.attribution_type);
        const { data } = await q.limit(params.limit || 100);
        result = data || [];
        break;
      }
      case "add_attribution": {
        const { data } = await sb.from("revenue_attributions").insert({ tenant_id: tenantId, ...params.attribution }).select("*").maybeSingle();
        result = data;
        break;
      }
      case "get_predictions": {
        let q = sb.from("ltv_predictions").select("*, people(full_name, email)").eq("tenant_id", tenantId).order("predicted_ltv_lifetime", { ascending: false });
        if (params.segment) q = q.eq("ltv_segment", params.segment);
        const { data } = await q.limit(params.limit || 100);
        result = data || [];
        break;
      }
      case "get_prediction": {
        const { data } = await sb.from("ltv_predictions").select("*, people(full_name, email, phone)").eq("tenant_id", tenantId).eq("person_id", params.person_id).maybeSingle();
        result = data;
        break;
      }
      case "get_snapshots": {
        const { data } = await sb.from("ltv_snapshots").select("*").eq("tenant_id", tenantId).eq("person_id", params.person_id).order("snapshot_date", { ascending: false }).limit(params.limit || 30);
        result = data || [];
        break;
      }
      case "calculate_ltv": {
        result = await handleCalculateLtv(sb, tenantId, profileId, params.person_id);
        break;
      }
      case "attribute_revenue": {
        result = await handleAttributeRevenue(sb, tenantId, profileId);
        break;
      }
      case "get_stats": {
        result = await handleGetStats(sb, tenantId);
        break;
      }
      case "get_roi_by_channel": {
        const { data } = await sb.from("revenue_attributions").select("channel, revenue_amount, attribution_weight, attributed_revenue").eq("tenant_id", tenantId);
        const channels: Record<string, { total_revenue: number; attributed: number; count: number }> = {};
        for (const a of data || []) {
          if (!channels[a.channel]) channels[a.channel] = { total_revenue: 0, attributed: 0, count: 0 };
          channels[a.channel].total_revenue += a.revenue_amount || 0;
          channels[a.channel].attributed += a.attributed_revenue || (a.revenue_amount * a.attribution_weight) || 0;
          channels[a.channel].count++;
        }
        result = channels;
        break;
      }
      case "get_segment_analysis": {
        const { data: preds } = await sb.from("ltv_predictions").select("ltv_segment, previous_segment, segment_changed_at, current_ltv, predicted_ltv_lifetime, churn_probability, expansion_probability, payment_score, engagement_score").eq("tenant_id", tenantId);
        const segments: Record<string, any> = {};
        for (const p of preds || []) {
          if (!segments[p.ltv_segment]) segments[p.ltv_segment] = { count: 0, total_current: 0, total_predicted: 0, avg_churn: 0, avg_expansion: 0, migrations_in: 0, migrations_out: 0 };
          const s = segments[p.ltv_segment];
          s.count++;
          s.total_current += p.current_ltv || 0;
          s.total_predicted += p.predicted_ltv_lifetime || 0;
          s.avg_churn += p.churn_probability || 0;
          s.avg_expansion += p.expansion_probability || 0;
          if (p.previous_segment && p.previous_segment !== p.ltv_segment) s.migrations_in++;
        }
        for (const s of Object.values(segments) as any[]) {
          if (s.count) { s.avg_churn = +(s.avg_churn / s.count).toFixed(4); s.avg_expansion = +(s.avg_expansion / s.count).toFixed(4); }
        }
        result = segments;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
