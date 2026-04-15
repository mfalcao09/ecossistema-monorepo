/**
 * relationship-next-best-action — v1
 * F11: Next Best Action Engine
 *
 * 10 actions:
 *   - get_opportunities: List revenue opportunities for tenant (with filters)
 *   - add_opportunity: Create manual opportunity
 *   - update_opportunity: Update opportunity status/value
 *   - get_recommendations: List NBA recommendations for tenant
 *   - add_recommendation: Create manual recommendation
 *   - update_recommendation: Update recommendation status/tracking
 *   - scan_opportunities: AI scans client data to detect new revenue opportunities
 *   - generate_offer: AI generates personalized offer content for a recommendation
 *   - get_stats: Dashboard statistics
 *   - get_ab_results: A/B testing results
 *
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 * Created: 2026-03-21
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolvePersona, callGemini, logInteraction } from "./resolve-persona.ts";

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
const OPPORTUNITY_SCAN_TOOL = [
  {
    functionDeclarations: [
      {
        name: "detected_opportunities",
        description: "Revenue opportunities detected from client data analysis",
        parameters: {
          type: "OBJECT",
          properties: {
            opportunities: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  opportunity_type: { type: "STRING", enum: ["cross_sell_insurance", "cross_sell_services", "upsell_property", "upsell_plan", "early_renewal", "standard_renewal", "referral_program", "reactivation", "custom"] },
                  title: { type: "STRING" },
                  description: { type: "STRING" },
                  estimated_value: { type: "NUMBER" },
                  probability_score: { type: "NUMBER" },
                  optimal_timing: { type: "STRING" },
                  best_channel: { type: "STRING", enum: ["email", "whatsapp", "phone", "in_person", "push_notification"] },
                  propensity_factors: {
                    type: "OBJECT",
                    properties: {
                      contract_health: { type: "NUMBER" },
                      payment_regularity: { type: "NUMBER" },
                      engagement_level: { type: "NUMBER" },
                      tenure_factor: { type: "NUMBER" },
                      market_timing: { type: "NUMBER" },
                    },
                  },
                  person_id: { type: "STRING" },
                  property_id: { type: "STRING" },
                  contract_id: { type: "STRING" },
                  confidence: { type: "NUMBER" },
                  recommended_action: { type: "STRING" },
                },
                required: ["opportunity_type", "title", "estimated_value", "probability_score", "best_channel"],
              },
            },
            summary: { type: "STRING" },
            total_estimated_revenue: { type: "NUMBER" },
            top_priority_count: { type: "NUMBER" },
          },
          required: ["opportunities", "summary", "total_estimated_revenue"],
        },
      },
    ],
  },
];

const OFFER_GENERATION_TOOL = [
  {
    functionDeclarations: [
      {
        name: "generated_offer",
        description: "Personalized offer content for a recommendation",
        parameters: {
          type: "OBJECT",
          properties: {
            subject: { type: "STRING" },
            greeting: { type: "STRING" },
            value_proposition: { type: "STRING" },
            body: { type: "STRING" },
            call_to_action: { type: "STRING" },
            closing: { type: "STRING" },
            tone: { type: "STRING" },
            personalization_score: { type: "NUMBER" },
            urgency_level: { type: "STRING", enum: ["low", "medium", "high"] },
            alternative_channels: {
              type: "ARRAY",
              items: { type: "STRING" },
            },
            ab_variant_suggestion: { type: "STRING" },
          },
          required: ["subject", "greeting", "value_proposition", "body", "call_to_action", "closing", "personalization_score"],
        },
      },
    ],
  },
];

// ── Data Fetchers ───────────────────────────────────────────
async function fetchTenantClients(sb: any, tenantId: string) {
  const { data } = await sb.from("people").select("id, full_name, email, phone, cpf, tags, notes, lead_source, created_at").eq("tenant_id", tenantId).limit(200);
  return data || [];
}

async function fetchTenantContracts(sb: any, tenantId: string) {
  const { data } = await sb.from("contracts").select("id, person_id, property_id, contract_type, status, start_date, end_date, monthly_value, total_value, payment_day, created_at").eq("tenant_id", tenantId).limit(300);
  return data || [];
}

async function fetchRecentPayments(sb: any, tenantId: string) {
  const { data } = await sb.from("payments").select("id, contract_id, amount, due_date, paid_date, status, payment_method").eq("tenant_id", tenantId).order("due_date", { ascending: false }).limit(500);
  return data || [];
}

async function fetchRecentInteractions(sb: any, tenantId: string) {
  const { data } = await sb.from("client_interactions").select("id, person_id, interaction_type, channel, subject, sentiment_score, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200);
  return data || [];
}

async function fetchExistingOpportunities(sb: any, tenantId: string) {
  const { data } = await sb.from("revenue_opportunities").select("id, person_id, opportunity_type, status, estimated_value").eq("tenant_id", tenantId).in("status", ["identified", "qualified", "in_progress"]);
  return data || [];
}

async function fetchOpportunityWithDetails(sb: any, tenantId: string, opportunityId: string) {
  const { data } = await sb.from("revenue_opportunities").select("*").eq("tenant_id", tenantId).eq("id", opportunityId).maybeSingle();
  return data;
}

async function fetchPersonContext(sb: any, tenantId: string, personId: string) {
  const { data: person } = await sb.from("people").select("*").eq("tenant_id", tenantId).eq("id", personId).maybeSingle();
  const { data: contracts } = await sb.from("contracts").select("*").eq("tenant_id", tenantId).eq("person_id", personId);
  const { data: payments } = await sb.from("payments").select("*").eq("tenant_id", tenantId).in("contract_id", (contracts || []).map((c: any) => c.id)).order("due_date", { ascending: false }).limit(20);
  const { data: interactions } = await sb.from("client_interactions").select("*").eq("tenant_id", tenantId).eq("person_id", personId).order("created_at", { ascending: false }).limit(10);
  return { person, contracts: contracts || [], payments: payments || [], interactions: interactions || [] };
}

// ── Handlers ────────────────────────────────────────────────
async function handleScanOpportunities(sb: any, tenantId: string, profileId: string) {
  const [clients, contracts, payments, interactions, existing] = await Promise.all([
    fetchTenantClients(sb, tenantId),
    fetchTenantContracts(sb, tenantId),
    fetchRecentPayments(sb, tenantId),
    fetchRecentInteractions(sb, tenantId),
    fetchExistingOpportunities(sb, tenantId),
  ]);

  const persona = await resolvePersona("nba_engine_ai", tenantId);
  const userMessage = `Analise os dados do tenant para detectar oportunidades de receita.

DADOS DO TENANT:
- ${clients.length} clientes
- ${contracts.length} contratos
- ${payments.length} pagamentos recentes
- ${interactions.length} interações recentes
- ${existing.length} oportunidades já identificadas

CLIENTES: ${JSON.stringify(clients.slice(0, 50))}
CONTRATOS: ${JSON.stringify(contracts.slice(0, 80))}
PAGAMENTOS: ${JSON.stringify(payments.slice(0, 100))}
INTERAÇÕES: ${JSON.stringify(interactions.slice(0, 50))}
OPORTUNIDADES EXISTENTES (ignorar duplicatas): ${JSON.stringify(existing)}

Detecte NOVAS oportunidades de cross-sell, upsell, renovação, referral e reativação. Para cada uma, calcule probability_score (0-100), estimated_value em reais, optimal_timing e best_channel.`;

  const aiResponse = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    tools: OPPORTUNITY_SCAN_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["detected_opportunities"] } },
  });
  if (!aiResponse.ok) throw new Error("AI error");
  const aiData = await aiResponse.json();
  const fnCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  const detected = fnCall?.args;

  if (!detected?.opportunities?.length) return { opportunities: [], summary: "Nenhuma nova oportunidade detectada.", total_estimated_revenue: 0 };

  const rows = detected.opportunities.map((o: any) => ({
    tenant_id: tenantId,
    person_id: o.person_id || null,
    property_id: o.property_id || null,
    contract_id: o.contract_id || null,
    opportunity_type: o.opportunity_type,
    title: o.title,
    description: o.description || null,
    estimated_value: o.estimated_value || 0,
    probability_score: Math.min(100, Math.max(0, o.probability_score || 50)),
    optimal_timing: o.optimal_timing || null,
    best_channel: o.best_channel || "email",
    propensity_factors: o.propensity_factors || {},
    status: "identified",
    ai_generated: true,
    ai_confidence: o.confidence || 0.7,
  }));

  const { data: inserted } = await sb.from("revenue_opportunities").insert(rows).select("id");
  await logInteraction({ tenantId, userId: profileId, functionKey: "nba_engine_ai", inputSummary: userMessage.slice(0, 500), outputSummary: JSON.stringify(detected).slice(0, 500) }).catch(() => {});

  return { opportunities: inserted || [], summary: detected.summary, total_estimated_revenue: detected.total_estimated_revenue, count: rows.length };
}

async function handleGenerateOffer(sb: any, tenantId: string, profileId: string, opportunityId: string, recommendationId?: string) {
  const opportunity = await fetchOpportunityWithDetails(sb, tenantId, opportunityId);
  if (!opportunity) throw new Error("Opportunity not found");

  const context = opportunity.person_id ? await fetchPersonContext(sb, tenantId, opportunity.person_id) : { person: null, contracts: [], payments: [], interactions: [] };

  const persona = await resolvePersona("nba_engine_ai", tenantId);
  const userMessage = `Gere conteúdo personalizado de oferta para esta oportunidade:

OPORTUNIDADE: ${JSON.stringify(opportunity)}

CONTEXTO DO CLIENTE:
- Pessoa: ${JSON.stringify(context.person)}
- Contratos: ${JSON.stringify(context.contracts)}
- Pagamentos recentes: ${JSON.stringify(context.payments.slice(0, 10))}
- Interações recentes: ${JSON.stringify(context.interactions.slice(0, 5))}

Gere um conteúdo altamente personalizado, com tom consultivo e orientado a valor. Inclua value_proposition clara, call_to_action específico, e sugestão de variante A/B para teste.`;

  const aiResponse = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    tools: OFFER_GENERATION_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["generated_offer"] } },
  });
  if (!aiResponse.ok) throw new Error("AI error");
  const aiData = await aiResponse.json();
  const fnCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  const content = fnCall?.args;

  if (!content) throw new Error("AI did not generate offer content");

  // Save as recommendation if no recommendationId provided
  if (!recommendationId) {
    const { data: rec } = await sb.from("nba_recommendations").insert({
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      person_id: opportunity.person_id,
      action_type: "send_offer",
      priority_score: opportunity.probability_score || 50,
      channel: opportunity.best_channel || "email",
      offer_content: content,
      personalization: { ai_generated: true, personalization_score: content.personalization_score },
      status: "pending",
    }).select("id").maybeSingle();
    recommendationId = rec?.id;
  } else {
    await sb.from("nba_recommendations").update({ offer_content: content, personalization: { ai_generated: true, personalization_score: content.personalization_score } }).eq("id", recommendationId).eq("tenant_id", tenantId);
  }

  // Update opportunity status
  await sb.from("revenue_opportunities").update({ status: "qualified" }).eq("id", opportunityId).eq("tenant_id", tenantId).eq("status", "identified");

  await logInteraction({ tenantId, userId: profileId, functionKey: "nba_engine_ai", inputSummary: userMessage.slice(0, 500), outputSummary: JSON.stringify(content).slice(0, 500) }).catch(() => {});

  return { content, recommendation_id: recommendationId };
}

async function handleGetStats(sb: any, tenantId: string) {
  const { data: opps } = await sb.from("revenue_opportunities").select("id, opportunity_type, status, estimated_value, actual_value, probability_score, ai_generated").eq("tenant_id", tenantId);
  const { data: recs } = await sb.from("nba_recommendations").select("id, action_type, status, channel, priority_score, converted_at").eq("tenant_id", tenantId);

  const opportunities = opps || [];
  const recommendations = recs || [];

  const by_type: Record<string, number> = {};
  const by_status: Record<string, number> = {};
  let total_estimated = 0;
  let total_converted = 0;
  let total_probability = 0;

  for (const o of opportunities) {
    by_type[o.opportunity_type] = (by_type[o.opportunity_type] || 0) + 1;
    by_status[o.status] = (by_status[o.status] || 0) + 1;
    total_estimated += o.estimated_value || 0;
    if (o.status === "converted") total_converted += o.actual_value || o.estimated_value || 0;
    total_probability += o.probability_score || 0;
  }

  const by_action: Record<string, number> = {};
  const by_rec_status: Record<string, number> = {};
  let conversions = 0;

  for (const r of recommendations) {
    by_action[r.action_type] = (by_action[r.action_type] || 0) + 1;
    by_rec_status[r.status] = (by_rec_status[r.status] || 0) + 1;
    if (r.status === "converted") conversions++;
  }

  return {
    opportunities: { total: opportunities.length, by_type, by_status, total_estimated, total_converted, avg_probability: opportunities.length ? Math.round(total_probability / opportunities.length) : 0 },
    recommendations: { total: recommendations.length, by_action, by_status: by_rec_status, conversions, conversion_rate: recommendations.length ? Math.round((conversions / recommendations.length) * 100) : 0 },
  };
}

async function handleGetAbResults(sb: any, tenantId: string) {
  const { data } = await sb.from("nba_recommendations").select("id, ab_test_id, variant, status, channel, offer_content, sent_at, opened_at, clicked_at, converted_at").eq("tenant_id", tenantId).not("ab_test_id", "is", null);

  const tests: Record<string, any[]> = {};
  for (const r of data || []) {
    if (!tests[r.ab_test_id]) tests[r.ab_test_id] = [];
    tests[r.ab_test_id].push(r);
  }

  const results = Object.entries(tests).map(([testId, recs]) => {
    const variants: Record<string, { sent: number; opened: number; clicked: number; converted: number }> = {};
    for (const r of recs) {
      const v = r.variant || "control";
      if (!variants[v]) variants[v] = { sent: 0, opened: 0, clicked: 0, converted: 0 };
      if (r.sent_at) variants[v].sent++;
      if (r.opened_at) variants[v].opened++;
      if (r.clicked_at) variants[v].clicked++;
      if (r.converted_at) variants[v].converted++;
    }
    return { test_id: testId, total_recs: recs.length, variants };
  });

  return { tests: results, total_tests: results.length };
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
      case "get_opportunities": {
        let q = sb.from("revenue_opportunities").select("*").eq("tenant_id", tenantId).order("probability_score", { ascending: false });
        if (params.status) q = q.eq("status", params.status);
        if (params.opportunity_type) q = q.eq("opportunity_type", params.opportunity_type);
        if (params.person_id) q = q.eq("person_id", params.person_id);
        const { data } = await q.limit(params.limit || 100);
        result = data || [];
        break;
      }
      case "add_opportunity": {
        const { data } = await sb.from("revenue_opportunities").insert({ tenant_id: tenantId, ...params.opportunity }).select("*").maybeSingle();
        result = data;
        break;
      }
      case "update_opportunity": {
        const { data } = await sb.from("revenue_opportunities").update(params.updates).eq("id", params.id).eq("tenant_id", tenantId).select("*").maybeSingle();
        result = data;
        break;
      }
      case "get_recommendations": {
        let q = sb.from("nba_recommendations").select("*, revenue_opportunities(title, opportunity_type, estimated_value)").eq("tenant_id", tenantId).order("priority_score", { ascending: false });
        if (params.status) q = q.eq("status", params.status);
        if (params.opportunity_id) q = q.eq("opportunity_id", params.opportunity_id);
        if (params.person_id) q = q.eq("person_id", params.person_id);
        const { data } = await q.limit(params.limit || 100);
        result = data || [];
        break;
      }
      case "add_recommendation": {
        const { data } = await sb.from("nba_recommendations").insert({ tenant_id: tenantId, ...params.recommendation }).select("*").maybeSingle();
        result = data;
        break;
      }
      case "update_recommendation": {
        const updates = { ...params.updates };
        // Auto-set tracking timestamps based on status
        if (updates.status === "sent" && !updates.sent_at) updates.sent_at = new Date().toISOString();
        if (updates.status === "opened" && !updates.opened_at) updates.opened_at = new Date().toISOString();
        if (updates.status === "clicked" && !updates.clicked_at) updates.clicked_at = new Date().toISOString();
        if (updates.status === "converted" && !updates.converted_at) updates.converted_at = new Date().toISOString();
        const { data } = await sb.from("nba_recommendations").update(updates).eq("id", params.id).eq("tenant_id", tenantId).select("*").maybeSingle();
        // If converted, also update opportunity
        if (updates.status === "converted" && data?.opportunity_id) {
          await sb.from("revenue_opportunities").update({ status: "converted", actual_value: params.actual_value || null, conversion_date: new Date().toISOString().slice(0, 10) }).eq("id", data.opportunity_id).eq("tenant_id", tenantId);
        }
        result = data;
        break;
      }
      case "scan_opportunities": {
        result = await handleScanOpportunities(sb, tenantId, profileId);
        break;
      }
      case "generate_offer": {
        result = await handleGenerateOffer(sb, tenantId, profileId, params.opportunity_id, params.recommendation_id);
        break;
      }
      case "get_stats": {
        result = await handleGetStats(sb, tenantId);
        break;
      }
      case "get_ab_results": {
        result = await handleGetAbResults(sb, tenantId);
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
