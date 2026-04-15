/**
 * relationship-exit-intelligence — v1
 * F9: Exit Experience Architecture
 *
 * 12 actions:
 *   - get_interviews: List exit interviews for tenant (with filters)
 *   - add_interview: Create new exit interview
 *   - update_interview: Update interview status/data
 *   - get_interview_detail: Get single interview with feedback
 *   - get_feedback: List feedback items for an interview
 *   - add_feedback: Add feedback item to interview
 *   - conduct_interview: AI conducts/analyzes exit interview
 *   - analyze_winback: AI generates win-back offer for a client
 *   - get_stats: Dashboard statistics
 *   - get_analytics: Aggregated analytics by period
 *   - generate_analytics: AI generates trend analysis for a period
 *   - get_category_insights: Feedback breakdown by category
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
const EXIT_INTERVIEW_TOOL = [
  {
    functionDeclarations: [
      {
        name: "exit_interview_analysis",
        description: "Análise completa de exit interview com sentimento, categorização e recomendações",
        parameters: {
          type: "OBJECT",
          properties: {
            ai_sentiment: {
              type: "STRING",
              description: "Sentimento geral: very_negative, negative, neutral, positive, very_positive",
            },
            ai_churn_category: {
              type: "STRING",
              description: "Categoria principal do churn (ex: pricing, service_quality, competitor, relocation)",
            },
            ai_summary: {
              type: "STRING",
              description: "Resumo executivo da entrevista em 3-5 frases",
            },
            ai_recommendations: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  action: { type: "STRING", description: "Ação recomendada" },
                  priority: { type: "STRING", description: "alta, media, baixa" },
                  impact: { type: "STRING", description: "Impacto esperado" },
                  responsible: { type: "STRING", description: "Área responsável" },
                },
              },
              description: "Lista de recomendações de melhoria",
            },
            feedback_analysis: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  category: { type: "STRING" },
                  rating: { type: "NUMBER" },
                  importance: { type: "NUMBER" },
                  feedback_text: { type: "STRING" },
                  ai_sentiment: { type: "STRING" },
                  ai_theme: { type: "STRING" },
                },
              },
              description: "Feedback detalhado por categoria",
            },
            pain_points: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Principais pontos de dor",
            },
            positive_aspects: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Aspectos positivos mencionados",
            },
            improvement_suggestions: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Sugestões de melhoria acionáveis",
            },
            ai_confidence: {
              type: "NUMBER",
              description: "Confiança da análise (0.0 a 1.0)",
            },
          },
          required: ["ai_sentiment", "ai_churn_category", "ai_summary", "ai_recommendations", "pain_points", "positive_aspects", "improvement_suggestions", "ai_confidence"],
        },
      },
    ],
  },
];

const WINBACK_TOOL = [
  {
    functionDeclarations: [
      {
        name: "winback_offer",
        description: "Oferta personalizada de win-back para cliente que saiu",
        parameters: {
          type: "OBJECT",
          properties: {
            offer_type: {
              type: "STRING",
              description: "Tipo: discount, upgrade, flexible_terms, maintenance, combined",
            },
            offer_value: {
              type: "STRING",
              description: "Valor/detalhe da oferta (ex: '15% desconto por 6 meses')",
            },
            expiry_days: {
              type: "NUMBER",
              description: "Dias de validade da oferta",
            },
            message_whatsapp: {
              type: "STRING",
              description: "Mensagem personalizada para WhatsApp",
            },
            message_email: {
              type: "STRING",
              description: "Mensagem personalizada para email",
            },
            success_probability: {
              type: "NUMBER",
              description: "Probabilidade estimada de sucesso (0-100)",
            },
            roi_estimate: {
              type: "STRING",
              description: "Estimativa de ROI se o cliente voltar",
            },
            reasoning: {
              type: "STRING",
              description: "Justificativa da estratégia de win-back",
            },
          },
          required: ["offer_type", "offer_value", "expiry_days", "message_whatsapp", "message_email", "success_probability", "reasoning"],
        },
      },
    ],
  },
];

// ── Data Fetchers ───────────────────────────────────────────
async function fetchTenantInterviews(client: any, tenantId: string, filters?: any) {
  let q = client
    .from("exit_interviews")
    .select("*, people!inner(id, name, email, phone)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (filters?.exit_status) q = q.eq("exit_status", filters.exit_status);
  if (filters?.exit_type) q = q.eq("exit_type", filters.exit_type);
  if (filters?.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function fetchInterviewWithFeedback(client: any, tenantId: string, interviewId: string) {
  const { data: interview, error: ie } = await client
    .from("exit_interviews")
    .select("*, people!inner(id, name, email, phone)")
    .eq("id", interviewId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (ie) throw ie;
  if (!interview) return null;
  const { data: feedback } = await client
    .from("exit_feedback")
    .select("*")
    .eq("exit_interview_id", interviewId)
    .eq("tenant_id", tenantId)
    .order("category");
  return { ...interview, feedback: feedback || [] };
}

async function fetchPersonContext(client: any, tenantId: string, personId: string) {
  const [personRes, contractsRes, paymentsRes, interactionsRes] = await Promise.all([
    client.from("people").select("*").eq("id", personId).maybeSingle(),
    client.from("contracts").select("id, property_id, status, start_date, end_date, monthly_rent, contract_type").eq("tenant_id", tenantId).eq("person_id", personId).order("created_at", { ascending: false }).limit(5),
    client.from("payments").select("id, amount, status, due_date, paid_date").eq("tenant_id", tenantId).eq("person_id", personId).order("due_date", { ascending: false }).limit(12),
    client.from("interactions").select("id, type, channel, sentiment, summary, created_at").eq("tenant_id", tenantId).eq("person_id", personId).order("created_at", { ascending: false }).limit(10),
  ]);
  return {
    person: personRes.data,
    contracts: contractsRes.data || [],
    payments: paymentsRes.data || [],
    interactions: interactionsRes.data || [],
  };
}

// ── Handlers ────────────────────────────────────────────────

async function handleGetInterviews(client: any, tenantId: string, body: any, cors: any) {
  const data = await fetchTenantInterviews(client, tenantId, body.filters);
  return new Response(JSON.stringify({ data }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleAddInterview(client: any, tenantId: string, body: any, cors: any) {
  const { person_id, contract_id, exit_type, scheduled_date, exit_reason_primary, exit_reason_secondary, interviewer_id } = body;
  if (!person_id) return new Response(JSON.stringify({ error: "person_id obrigatório" }), { status: 400, headers: cors });
  const { data, error } = await client.from("exit_interviews").insert({
    tenant_id: tenantId, person_id, contract_id: contract_id || null,
    exit_type: exit_type || "other", scheduled_date: scheduled_date || null,
    exit_reason_primary: exit_reason_primary || null, exit_reason_secondary: exit_reason_secondary || null,
    interviewer_id: interviewer_id || null,
  }).select("*").single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data }), { status: 201, headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleUpdateInterview(client: any, tenantId: string, body: any, cors: any) {
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: "id obrigatório" }), { status: 400, headers: cors });
  // Auto-set completed_date when status changes to completed
  if (updates.exit_status === "completed" && !updates.completed_date) {
    updates.completed_date = new Date().toISOString();
  }
  const { data, error } = await client.from("exit_interviews")
    .update(updates).eq("id", id).eq("tenant_id", tenantId).select("*").maybeSingle();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleGetInterviewDetail(client: any, tenantId: string, body: any, cors: any) {
  const { id } = body;
  if (!id) return new Response(JSON.stringify({ error: "id obrigatório" }), { status: 400, headers: cors });
  const data = await fetchInterviewWithFeedback(client, tenantId, id);
  if (!data) return new Response(JSON.stringify({ error: "Entrevista não encontrada" }), { status: 404, headers: cors });
  return new Response(JSON.stringify({ data }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleGetFeedback(client: any, tenantId: string, body: any, cors: any) {
  const { exit_interview_id } = body;
  if (!exit_interview_id) return new Response(JSON.stringify({ error: "exit_interview_id obrigatório" }), { status: 400, headers: cors });
  const { data, error } = await client.from("exit_feedback")
    .select("*").eq("exit_interview_id", exit_interview_id).eq("tenant_id", tenantId).order("category");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data: data || [] }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleAddFeedback(client: any, tenantId: string, body: any, cors: any) {
  const { exit_interview_id, category, rating, importance, feedback_text, subcategory } = body;
  if (!exit_interview_id || !category || !rating) return new Response(JSON.stringify({ error: "exit_interview_id, category e rating obrigatórios" }), { status: 400, headers: cors });
  const { data, error } = await client.from("exit_feedback").insert({
    tenant_id: tenantId, exit_interview_id, category, subcategory: subcategory || null,
    rating, importance: importance || 3, feedback_text: feedback_text || null,
  }).select("*").single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data }), { status: 201, headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleConductInterview(client: any, tenantId: string, userId: string, body: any, cors: any) {
  const { interview_id } = body;
  if (!interview_id) return new Response(JSON.stringify({ error: "interview_id obrigatório" }), { status: 400, headers: cors });
  const t0 = Date.now();

  // Fetch interview + person context
  const interview = await fetchInterviewWithFeedback(client, tenantId, interview_id);
  if (!interview) return new Response(JSON.stringify({ error: "Entrevista não encontrada" }), { status: 404, headers: cors });

  const context = await fetchPersonContext(client, tenantId, interview.person_id);

  // Fetch existing churn data if available
  const { data: churnData } = await client.from("churn_predictions")
    .select("risk_score, risk_level, primary_reasons").eq("tenant_id", tenantId).eq("person_id", interview.person_id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  const persona = await resolvePersona("exit_experience_ai", tenantId);
  const prompt = `Analise esta exit interview e forneça insights completos.

DADOS DA ENTREVISTA:
- Tipo de saída: ${interview.exit_type}
- Status: ${interview.exit_status}
- Motivo principal: ${interview.exit_reason_primary || "Não informado"}
- Motivo secundário: ${interview.exit_reason_secondary || "N/A"}
- Satisfação: ${interview.satisfaction_score ?? "Não avaliado"}/10
- NPS: ${interview.recommendation_likelihood ?? "Não avaliado"}/10

CLIENTE: ${JSON.stringify(context.person, null, 2)}
CONTRATOS: ${JSON.stringify(context.contracts, null, 2)}
PAGAMENTOS (últimos 12): ${JSON.stringify(context.payments, null, 2)}
INTERAÇÕES (últimas 10): ${JSON.stringify(context.interactions, null, 2)}
${churnData ? `DADOS DE CHURN: ${JSON.stringify(churnData, null, 2)}` : ""}
FEEDBACK EXISTENTE: ${JSON.stringify(interview.feedback || [], null, 2)}

Gere análise completa: sentimento, categoria de churn, resumo, recomendações, pontos de dor, aspectos positivos, sugestões de melhoria. Inclua feedback_analysis com categorias detalhadas.`;

  const aiResp = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: EXIT_INTERVIEW_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY" } },
  });

  const aiJson = await aiResp.json();
  const fc = aiJson?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  if (!fc?.args) return new Response(JSON.stringify({ error: "IA não retornou análise" }), { status: 502, headers: cors });

  const result = fc.args;

  // Update interview with AI analysis
  await client.from("exit_interviews").update({
    ai_sentiment: result.ai_sentiment,
    ai_churn_category: result.ai_churn_category,
    ai_summary: result.ai_summary,
    ai_recommendations: result.ai_recommendations || [],
    pain_points: result.pain_points || [],
    positive_aspects: result.positive_aspects || [],
    improvement_suggestions: result.improvement_suggestions || [],
    ai_generated: true,
    ai_confidence: result.ai_confidence || 0.7,
    exit_status: interview.exit_status === "scheduled" ? "in_progress" : interview.exit_status,
  }).eq("id", interview_id).eq("tenant_id", tenantId);

  // Insert AI-generated feedback items if provided
  if (result.feedback_analysis && Array.isArray(result.feedback_analysis)) {
    const feedbackRows = result.feedback_analysis.map((f: any) => ({
      tenant_id: tenantId,
      exit_interview_id: interview_id,
      category: f.category || "other",
      rating: Math.min(5, Math.max(1, Math.round(f.rating || 3))),
      importance: Math.min(5, Math.max(1, Math.round(f.importance || 3))),
      feedback_text: f.feedback_text || null,
      ai_sentiment: f.ai_sentiment || null,
      ai_theme: f.ai_theme || null,
    }));
    if (feedbackRows.length > 0) {
      await client.from("exit_feedback").insert(feedbackRows);
    }
  }

  logInteraction({ tenantId, userId, functionKey: "exit_experience_ai", inputSummary: `conduct_interview: ${interview.person_id}`, outputSummary: `sentiment=${result.ai_sentiment}, category=${result.ai_churn_category}`, responseTimeMs: Date.now() - t0 });

  return new Response(JSON.stringify({ data: result }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleAnalyzeWinback(client: any, tenantId: string, userId: string, body: any, cors: any) {
  const { interview_id } = body;
  if (!interview_id) return new Response(JSON.stringify({ error: "interview_id obrigatório" }), { status: 400, headers: cors });
  const t0 = Date.now();

  const interview = await fetchInterviewWithFeedback(client, tenantId, interview_id);
  if (!interview) return new Response(JSON.stringify({ error: "Entrevista não encontrada" }), { status: 404, headers: cors });

  const context = await fetchPersonContext(client, tenantId, interview.person_id);

  const persona = await resolvePersona("exit_experience_ai", tenantId);
  const prompt = `Gere uma oferta personalizada de win-back para este cliente que saiu.

ENTREVISTA: ${JSON.stringify({ exit_type: interview.exit_type, exit_reason_primary: interview.exit_reason_primary, satisfaction_score: interview.satisfaction_score, ai_sentiment: interview.ai_sentiment, ai_churn_category: interview.ai_churn_category, pain_points: interview.pain_points, positive_aspects: interview.positive_aspects }, null, 2)}
CLIENTE: ${JSON.stringify(context.person, null, 2)}
CONTRATOS: ${JSON.stringify(context.contracts, null, 2)}
PAGAMENTOS: ${JSON.stringify(context.payments?.slice(0, 6), null, 2)}

Gere oferta de win-back: tipo, valor, validade, mensagem personalizada para WhatsApp e email, probabilidade de sucesso e justificativa.`;

  const aiResp = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: WINBACK_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY" } },
  });

  const aiJson = await aiResp.json();
  const fc = aiJson?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  if (!fc?.args) return new Response(JSON.stringify({ error: "IA não retornou oferta" }), { status: 502, headers: cors });

  const offer = fc.args;

  // Save win-back offer on the interview
  await client.from("exit_interviews").update({
    win_back_offer: {
      type: offer.offer_type,
      value: offer.offer_value,
      expiry_date: new Date(Date.now() + (offer.expiry_days || 30) * 86400000).toISOString(),
      status: "pending",
      message_whatsapp: offer.message_whatsapp,
      message_email: offer.message_email,
      success_probability: offer.success_probability,
      roi_estimate: offer.roi_estimate,
      reasoning: offer.reasoning,
    },
    win_back_response: "pending",
    exit_status: "win_back_attempt",
  }).eq("id", interview_id).eq("tenant_id", tenantId);

  logInteraction({ tenantId, userId, functionKey: "exit_experience_ai", inputSummary: `analyze_winback: ${interview.person_id}`, outputSummary: `offer=${offer.offer_type}, prob=${offer.success_probability}%`, responseTimeMs: Date.now() - t0 });

  return new Response(JSON.stringify({ data: offer }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleGetStats(client: any, tenantId: string, cors: any) {
  const { data: interviews } = await client.from("exit_interviews")
    .select("id, exit_type, exit_status, satisfaction_score, recommendation_likelihood, ai_sentiment, win_back_response, created_at")
    .eq("tenant_id", tenantId);
  const all = interviews || [];
  const completed = all.filter((i: any) => i.exit_status === "completed");
  const winBackAttempts = all.filter((i: any) => i.exit_status === "win_back_attempt" || i.win_back_response !== "pending");
  const winBackSuccess = all.filter((i: any) => i.win_back_response === "accepted");

  const avgSatisfaction = completed.length > 0
    ? completed.reduce((s: number, i: any) => s + (i.satisfaction_score || 0), 0) / completed.filter((i: any) => i.satisfaction_score != null).length
    : 0;
  const avgNps = completed.length > 0
    ? completed.reduce((s: number, i: any) => s + (i.recommendation_likelihood || 0), 0) / completed.filter((i: any) => i.recommendation_likelihood != null).length
    : 0;

  // By type
  const byType: Record<string, number> = {};
  all.forEach((i: any) => { byType[i.exit_type] = (byType[i.exit_type] || 0) + 1; });

  // By sentiment
  const bySentiment: Record<string, number> = {};
  all.filter((i: any) => i.ai_sentiment).forEach((i: any) => { bySentiment[i.ai_sentiment] = (bySentiment[i.ai_sentiment] || 0) + 1; });

  // By status
  const byStatus: Record<string, number> = {};
  all.forEach((i: any) => { byStatus[i.exit_status] = (byStatus[i.exit_status] || 0) + 1; });

  return new Response(JSON.stringify({
    data: {
      total_interviews: all.length,
      completed_interviews: completed.length,
      avg_satisfaction: Math.round(avgSatisfaction * 10) / 10,
      avg_nps: Math.round(avgNps * 10) / 10,
      win_back_attempts: winBackAttempts.length,
      win_back_successes: winBackSuccess.length,
      win_back_rate: winBackAttempts.length > 0 ? Math.round((winBackSuccess.length / winBackAttempts.length) * 100) : 0,
      by_type: byType,
      by_sentiment: bySentiment,
      by_status: byStatus,
    },
  }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleGetCategoryInsights(client: any, tenantId: string, cors: any) {
  const { data: feedback } = await client.from("exit_feedback")
    .select("category, rating, importance, ai_sentiment, ai_theme")
    .eq("tenant_id", tenantId);
  const all = feedback || [];

  const categories: Record<string, { count: number; totalRating: number; totalImportance: number; sentiments: Record<string, number> }> = {};
  all.forEach((f: any) => {
    if (!categories[f.category]) categories[f.category] = { count: 0, totalRating: 0, totalImportance: 0, sentiments: {} };
    const c = categories[f.category];
    c.count++;
    c.totalRating += f.rating || 0;
    c.totalImportance += f.importance || 0;
    if (f.ai_sentiment) c.sentiments[f.ai_sentiment] = (c.sentiments[f.ai_sentiment] || 0) + 1;
  });

  const insights = Object.entries(categories).map(([cat, data]) => ({
    category: cat,
    count: data.count,
    avg_rating: Math.round((data.totalRating / data.count) * 10) / 10,
    avg_importance: Math.round((data.totalImportance / data.count) * 10) / 10,
    sentiments: data.sentiments,
  })).sort((a, b) => b.count - a.count);

  return new Response(JSON.stringify({ data: insights }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleGetAnalytics(client: any, tenantId: string, body: any, cors: any) {
  const { data, error } = await client.from("exit_analytics")
    .select("*").eq("tenant_id", tenantId)
    .order("period_start", { ascending: false }).limit(body.limit || 12);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data: data || [] }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleGenerateAnalytics(client: any, tenantId: string, userId: string, body: any, cors: any) {
  const { period_start, period_end } = body;
  if (!period_start || !period_end) return new Response(JSON.stringify({ error: "period_start e period_end obrigatórios" }), { status: 400, headers: cors });

  // Fetch interviews in period
  const { data: interviews } = await client.from("exit_interviews")
    .select("*").eq("tenant_id", tenantId)
    .gte("created_at", period_start).lte("created_at", period_end);
  const all = interviews || [];
  if (all.length === 0) return new Response(JSON.stringify({ error: "Sem entrevistas no período" }), { status: 404, headers: cors });

  // Calculate aggregates
  const completed = all.filter((i: any) => i.exit_status === "completed");
  const voluntary = all.filter((i: any) => !["involuntary"].includes(i.exit_type)).length;
  const involuntary = all.filter((i: any) => i.exit_type === "involuntary").length;
  const avgSat = completed.length > 0
    ? completed.reduce((s: number, i: any) => s + (i.satisfaction_score || 0), 0) / completed.filter((i: any) => i.satisfaction_score != null).length
    : null;
  const avgNps = completed.length > 0
    ? completed.reduce((s: number, i: any) => s + (i.recommendation_likelihood || 0), 0) / completed.filter((i: any) => i.recommendation_likelihood != null).length
    : null;

  // Top reasons
  const reasonCounts: Record<string, number> = {};
  all.forEach((i: any) => {
    if (i.exit_reason_primary) reasonCounts[i.exit_reason_primary] = (reasonCounts[i.exit_reason_primary] || 0) + 1;
  });
  const topReasons = Object.entries(reasonCounts).map(([reason, count]) => ({
    reason, count, percentage: Math.round((count / all.length) * 100),
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  // Top pain points
  const painCounts: Record<string, number> = {};
  all.forEach((i: any) => {
    (i.pain_points || []).forEach((p: string) => { painCounts[p] = (painCounts[p] || 0) + 1; });
  });
  const topPains = Object.entries(painCounts).map(([pain_point, count]) => ({
    pain_point, count, percentage: Math.round((count / all.length) * 100),
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  const winBackAttempts = all.filter((i: any) => i.win_back_response && i.win_back_response !== "pending").length;
  const winBackSuccesses = all.filter((i: any) => i.win_back_response === "accepted").length;

  // Fetch category breakdown
  const interviewIds = all.map((i: any) => i.id);
  const { data: feedbackData } = await client.from("exit_feedback")
    .select("category, rating, importance").eq("tenant_id", tenantId).in("exit_interview_id", interviewIds);
  const catBreakdown: Record<string, { count: number; avgRating: number; total: number }> = {};
  (feedbackData || []).forEach((f: any) => {
    if (!catBreakdown[f.category]) catBreakdown[f.category] = { count: 0, avgRating: 0, total: 0 };
    catBreakdown[f.category].count++;
    catBreakdown[f.category].total += f.rating;
  });
  Object.values(catBreakdown).forEach((c: any) => { c.avgRating = Math.round((c.total / c.count) * 10) / 10; });

  // Upsert analytics record
  const { data: analyticsData, error: ae } = await client.from("exit_analytics").upsert({
    tenant_id: tenantId, period_start, period_end,
    total_exits: all.length, voluntary_exits: voluntary, involuntary_exits: involuntary,
    avg_satisfaction: avgSat ? Math.round(avgSat * 10) / 10 : null,
    avg_nps: avgNps ? Math.round(avgNps * 10) / 10 : null,
    top_exit_reasons: topReasons, top_pain_points: topPains,
    win_back_attempts: winBackAttempts, win_back_successes: winBackSuccesses,
    category_breakdown: catBreakdown,
  }, { onConflict: "tenant_id,period_start,period_end" }).select("*").maybeSingle();

  return new Response(JSON.stringify({ data: analyticsData }), { headers: { ...cors, "Content-Type": "application/json" } });
}

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceKey);

    // Auth
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await client.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: cors });

    const { data: profile } = await client.from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
    if (!profile?.tenant_id) return new Response(JSON.stringify({ error: "Tenant not found" }), { status: 403, headers: cors });
    const tenantId = profile.tenant_id;

    const body = await req.json();
    const action = body.action;

    switch (action) {
      case "get_interviews": return handleGetInterviews(client, tenantId, body, cors);
      case "add_interview": return handleAddInterview(client, tenantId, body, cors);
      case "update_interview": return handleUpdateInterview(client, tenantId, body, cors);
      case "get_interview_detail": return handleGetInterviewDetail(client, tenantId, body, cors);
      case "get_feedback": return handleGetFeedback(client, tenantId, body, cors);
      case "add_feedback": return handleAddFeedback(client, tenantId, body, cors);
      case "conduct_interview": return handleConductInterview(client, tenantId, user.id, body, cors);
      case "analyze_winback": return handleAnalyzeWinback(client, tenantId, user.id, body, cors);
      case "get_stats": return handleGetStats(client, tenantId, cors);
      case "get_analytics": return handleGetAnalytics(client, tenantId, body, cors);
      case "generate_analytics": return handleGenerateAnalytics(client, tenantId, user.id, body, cors);
      case "get_category_insights": return handleGetCategoryInsights(client, tenantId, cors);
      default: return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), { status: 400, headers: cors });
    }
  } catch (err: any) {
    console.error("relationship-exit-intelligence error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), { status: 500, headers: cors });
  }
});
