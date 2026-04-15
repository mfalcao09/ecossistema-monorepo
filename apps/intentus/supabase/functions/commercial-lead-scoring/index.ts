// commercial-lead-scoring v1 — Lead Scoring IA Engine
// Self-contained Edge Function (inline CORS, auth/tenant, scoring engine + IA recommendations)
// Actions: score_lead, score_portfolio, get_dashboard, batch_rescore
// 8 scoring factors, OpenRouter Gemini 2.0 Flash for AI boost, audit trail in lead_score_history
// Sessão 77 — Pair programming Claudinho + Buchecha

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ──
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];
const DEV_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PREVIEW_REGEX = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (DEV_REGEX.test(origin)) return true;
  if (PREVIEW_REGEX.test(origin)) return true;
  const extra = Deno.env.get("ALLOWED_ORIGINS");
  if (extra) {
    for (const o of extra.split(",")) {
      if (o.trim() === origin) return true;
    }
  }
  return false;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isAllowedOrigin(origin) ? origin : PROD_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// ── Auth / Tenant ──
interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  tenantId: string;
}

async function resolveAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

  return { supabase, userId: user.id, tenantId: profile.tenant_id };
}

// ── Scoring Constants ──
const SCORING_WEIGHTS = {
  data_completeness: 0.15,   // 15% — nome, email, telefone, interesse, região, orçamento
  source_quality: 0.12,      // 12% — site, portal, indicação > walk_in > whatsapp > telefone > outro
  budget_presence: 0.15,     // 15% — budget_min e/ou budget_max preenchidos
  engagement_recency: 0.20,  // 20% — último contato < 24h, < 3d, < 7d, < 30d, > 30d
  interest_match: 0.10,      // 10% — tipo de interesse preenchido (venda, locacao, ambos)
  region_demand: 0.10,       // 10% — região preenchida (indica buyer intent)
  interaction_count: 0.10,   // 10% — nº de interações registradas
  ai_boost: 0.08,            // 8%  — ajuste IA baseado em contexto (Gemini 2.0 Flash)
};

const SOURCE_SCORES: Record<string, number> = {
  indicacao: 95,   // referral = highest intent
  portal: 90,      // portal imobiliário = active search
  site: 85,        // site próprio = interest
  walk_in: 75,     // presencial = moderate intent
  whatsapp: 65,    // whatsapp = casual
  telefone: 60,    // telefone = cold
  outro: 40,       // unknown
};

const SCORE_THRESHOLDS = {
  hot: 70,   // ≥ 70 = quente
  warm: 40,  // ≥ 40 = morno
  // < 40 = frio
};

type ScoreLevel = "hot" | "warm" | "cold";

function classifyScore(score: number): ScoreLevel {
  if (score >= SCORE_THRESHOLDS.hot) return "hot";
  if (score >= SCORE_THRESHOLDS.warm) return "warm";
  return "cold";
}

// ── Factor Calculators ──
interface LeadData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  interest_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_region: string | null;
  notes: string | null;
  last_contact_at: string | null;
  created_at: string;
  assigned_to: string | null;
  person_id: string | null;
}

interface ScoringFactor {
  name: string;
  weight: number;
  raw_score: number;    // 0-100 before weight
  weighted_score: number; // raw × weight
  detail: string;
}

function calcDataCompleteness(lead: LeadData): ScoringFactor {
  const fields = [
    { name: "name", filled: !!lead.name },
    { name: "email", filled: !!lead.email },
    { name: "phone", filled: !!lead.phone },
    { name: "interest_type", filled: !!lead.interest_type },
    { name: "preferred_region", filled: !!lead.preferred_region },
    { name: "budget", filled: !!(lead.budget_min || lead.budget_max) },
    { name: "notes", filled: !!lead.notes },
  ];
  const filled = fields.filter(f => f.filled).length;
  const raw = Math.round((filled / fields.length) * 100);
  const missing = fields.filter(f => !f.filled).map(f => f.name);
  return {
    name: "data_completeness",
    weight: SCORING_WEIGHTS.data_completeness,
    raw_score: raw,
    weighted_score: Math.round(raw * SCORING_WEIGHTS.data_completeness),
    detail: missing.length > 0 ? `Faltam: ${missing.join(", ")}` : "Completo",
  };
}

function calcSourceQuality(lead: LeadData): ScoringFactor {
  const raw = SOURCE_SCORES[lead.source] ?? 40;
  return {
    name: "source_quality",
    weight: SCORING_WEIGHTS.source_quality,
    raw_score: raw,
    weighted_score: Math.round(raw * SCORING_WEIGHTS.source_quality),
    detail: `Origem: ${lead.source}`,
  };
}

function calcBudgetPresence(lead: LeadData): ScoringFactor {
  let raw = 0;
  let detail = "Sem orçamento";
  if (lead.budget_min && lead.budget_max) {
    raw = 100;
    detail = `R$ ${Number(lead.budget_min).toLocaleString("pt-BR")} – R$ ${Number(lead.budget_max).toLocaleString("pt-BR")}`;
  } else if (lead.budget_min || lead.budget_max) {
    raw = 60;
    detail = `Parcial: ${lead.budget_min ? "mín" : "máx"} informado`;
  }
  return {
    name: "budget_presence",
    weight: SCORING_WEIGHTS.budget_presence,
    raw_score: raw,
    weighted_score: Math.round(raw * SCORING_WEIGHTS.budget_presence),
    detail,
  };
}

function calcEngagementRecency(lead: LeadData): ScoringFactor {
  const ref = lead.last_contact_at ?? lead.created_at;
  const daysSince = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
  let raw = 0;
  let detail = "";
  if (daysSince <= 1) { raw = 100; detail = "Contato hoje"; }
  else if (daysSince <= 3) { raw = 85; detail = `${daysSince}d atrás`; }
  else if (daysSince <= 7) { raw = 65; detail = `${daysSince}d atrás`; }
  else if (daysSince <= 14) { raw = 45; detail = `${daysSince}d atrás`; }
  else if (daysSince <= 30) { raw = 25; detail = `${daysSince}d atrás`; }
  else { raw = 10; detail = `${daysSince}d atrás (inativo)`; }
  return {
    name: "engagement_recency",
    weight: SCORING_WEIGHTS.engagement_recency,
    raw_score: raw,
    weighted_score: Math.round(raw * SCORING_WEIGHTS.engagement_recency),
    detail,
  };
}

function calcInterestMatch(lead: LeadData): ScoringFactor {
  let raw = 0;
  let detail = "Sem interesse definido";
  if (lead.interest_type === "ambos") { raw = 90; detail = "Interesse: Compra + Locação"; }
  else if (lead.interest_type === "venda") { raw = 100; detail = "Interesse: Compra"; }
  else if (lead.interest_type === "locacao") { raw = 80; detail = "Interesse: Locação"; }
  return {
    name: "interest_match",
    weight: SCORING_WEIGHTS.interest_match,
    raw_score: raw,
    weighted_score: Math.round(raw * SCORING_WEIGHTS.interest_match),
    detail,
  };
}

function calcRegionDemand(lead: LeadData): ScoringFactor {
  const raw = lead.preferred_region ? 80 : 0;
  return {
    name: "region_demand",
    weight: SCORING_WEIGHTS.region_demand,
    raw_score: raw,
    weighted_score: Math.round(raw * SCORING_WEIGHTS.region_demand),
    detail: lead.preferred_region ? `Região: ${lead.preferred_region}` : "Sem região",
  };
}

function calcInteractionCount(interactionCount: number): ScoringFactor {
  let raw = 0;
  if (interactionCount >= 5) raw = 100;
  else if (interactionCount >= 3) raw = 80;
  else if (interactionCount >= 2) raw = 60;
  else if (interactionCount >= 1) raw = 40;
  else raw = 0;
  return {
    name: "interaction_count",
    weight: SCORING_WEIGHTS.interaction_count,
    raw_score: raw,
    weighted_score: Math.round(raw * SCORING_WEIGHTS.interaction_count),
    detail: `${interactionCount} interação(ões)`,
  };
}

// ── AI Boost (OpenRouter → Gemini 2.0 Flash) ──
async function calcAIBoost(lead: LeadData, factors: ScoringFactor[], baseScore: number): Promise<ScoringFactor> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return {
      name: "ai_boost",
      weight: SCORING_WEIGHTS.ai_boost,
      raw_score: 50,
      weighted_score: Math.round(50 * SCORING_WEIGHTS.ai_boost),
      detail: "IA indisponível — score neutro",
    };
  }

  try {
    const prompt = `Você é um analista de CRM imobiliário. Avalie este lead e retorne um JSON com:
- "ai_score": número 0-100 (ajuste baseado no contexto geral do lead)
- "reason": string curta (1 frase) explicando o ajuste

Lead:
- Nome: ${lead.name}
- Origem: ${lead.source}
- Status: ${lead.status}
- Interesse: ${lead.interest_type || "não informado"}
- Orçamento: ${lead.budget_min ? `R$${lead.budget_min}` : "?"} – ${lead.budget_max ? `R$${lead.budget_max}` : "?"}
- Região: ${lead.preferred_region || "não informada"}
- Último contato: ${lead.last_contact_at || "nunca"}
- Notas: ${(lead.notes || "").slice(0, 200)}

Score base (sem IA): ${baseScore}/100
Fatores: ${factors.map(f => `${f.name}=${f.raw_score}`).join(", ")}

Responda APENAS com JSON válido, sem markdown.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://app.intentusrealestate.com.br",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    const aiScore = Math.min(100, Math.max(0, Number(parsed.ai_score) || 50));
    const reason = String(parsed.reason || "Ajuste IA").slice(0, 150);

    return {
      name: "ai_boost",
      weight: SCORING_WEIGHTS.ai_boost,
      raw_score: aiScore,
      weighted_score: Math.round(aiScore * SCORING_WEIGHTS.ai_boost),
      detail: reason,
    };
  } catch (e) {
    console.error("AI boost error:", e);
    return {
      name: "ai_boost",
      weight: SCORING_WEIGHTS.ai_boost,
      raw_score: 50,
      weighted_score: Math.round(50 * SCORING_WEIGHTS.ai_boost),
      detail: "Fallback — erro na IA",
    };
  }
}

// ── Score a single lead ──
async function scoreLead(
  ctx: AuthContext,
  leadId: string,
  triggerEvent?: string,
  skipAI = false
): Promise<{
  lead_id: string;
  score: number;
  previous_score: number | null;
  level: ScoreLevel;
  factors: ScoringFactor[];
  model_version: string;
}> {
  // Fetch lead
  const { data: lead, error: leadErr } = await ctx.supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (leadErr || !lead) throw new Error("Lead não encontrado");

  const previousScore = lead.lead_score ?? null;

  // Fetch interaction count
  let interactionCount = 0;
  if (lead.person_id) {
    const { count } = await ctx.supabase
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("person_id", lead.person_id);
    interactionCount = count ?? 0;
  }

  // Calculate rule-based factors
  const factors: ScoringFactor[] = [
    calcDataCompleteness(lead),
    calcSourceQuality(lead),
    calcBudgetPresence(lead),
    calcEngagementRecency(lead),
    calcInterestMatch(lead),
    calcRegionDemand(lead),
    calcInteractionCount(interactionCount),
  ];

  // Base score without AI
  const baseScore = factors.reduce((s, f) => s + f.weighted_score, 0);

  // AI boost (optional)
  const aiFactor = skipAI
    ? { name: "ai_boost", weight: SCORING_WEIGHTS.ai_boost, raw_score: 50, weighted_score: Math.round(50 * SCORING_WEIGHTS.ai_boost), detail: "IA desativada (batch)" }
    : await calcAIBoost(lead, factors, baseScore);
  factors.push(aiFactor);

  // Final score (clamped 0-100)
  const finalScore = Math.min(100, Math.max(0, factors.reduce((s, f) => s + f.weighted_score, 0)));
  const level = classifyScore(finalScore);
  const modelVersion = skipAI ? "rule_engine_v1" : "hybrid_gemini_v1";

  // Persist score on lead
  await ctx.supabase
    .from("leads")
    .update({
      lead_score: finalScore,
      score_evaluated_at: new Date().toISOString(),
      scoring_model_used: modelVersion,
    })
    .eq("id", leadId)
    .eq("tenant_id", ctx.tenantId);

  // Write audit trail
  await ctx.supabase.from("lead_score_history").insert({
    tenant_id: ctx.tenantId,
    lead_id: leadId,
    score: finalScore,
    previous_score: previousScore,
    factors: factors.map(f => ({
      name: f.name,
      weight: f.weight,
      raw_score: f.raw_score,
      weighted_score: f.weighted_score,
      detail: f.detail,
    })),
    model_version: modelVersion,
    trigger_event: triggerEvent ?? null,
  });

  return { lead_id: leadId, score: finalScore, previous_score: previousScore, level, factors, model_version: modelVersion };
}

// ── Action: score_portfolio ──
async function handleScorePortfolio(ctx: AuthContext, body: Record<string, unknown>) {
  const limit = Math.min(Number(body.limit) || 50, 200);
  const onlyUnscored = body.only_unscored === true;

  let query = ctx.supabase
    .from("leads")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .not("status", "in", '("convertido","perdido")')
    .order("created_at", { ascending: false })
    .limit(limit);

  if (onlyUnscored) {
    query = query.is("lead_score", null);
  }

  const { data: leads, error } = await query;
  if (error) throw error;
  if (!leads || leads.length === 0) {
    return { scored: 0, results: [], summary: null };
  }

  // Batch score — skip AI for batch (latency), use rule_engine only
  const results: Array<{ lead_id: string; score: number; level: ScoreLevel }> = [];
  for (const l of leads) {
    try {
      const result = await scoreLead(ctx, l.id, "batch_rescore", true);
      results.push({ lead_id: result.lead_id, score: result.score, level: result.level });
    } catch (e) {
      console.error(`Score failed for lead ${l.id}:`, e);
    }
  }

  // Summary
  const scores = results.map(r => r.score);
  const hot = results.filter(r => r.level === "hot").length;
  const warm = results.filter(r => r.level === "warm").length;
  const cold = results.filter(r => r.level === "cold").length;
  const avg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

  return {
    scored: results.length,
    results,
    summary: { average_score: avg, hot, warm, cold, total: results.length },
  };
}

// ── Action: get_dashboard ──
async function handleGetDashboard(ctx: AuthContext) {
  // All active leads with scores
  const { data: leads } = await ctx.supabase
    .from("leads")
    .select("id, name, lead_score, score_evaluated_at, scoring_model_used, source, status, created_at, last_contact_at, interest_type, budget_min, budget_max, preferred_region, assigned_to")
    .eq("tenant_id", ctx.tenantId)
    .not("status", "in", '("convertido","perdido")')
    .order("lead_score", { ascending: false, nullsFirst: false })
    .limit(200);

  const allLeads = leads ?? [];
  const scored = allLeads.filter(l => l.lead_score !== null);
  const unscored = allLeads.filter(l => l.lead_score === null);

  const scores = scored.map(l => l.lead_score as number);
  const avg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
  const hot = scored.filter(l => (l.lead_score as number) >= SCORE_THRESHOLDS.hot);
  const warm = scored.filter(l => (l.lead_score as number) >= SCORE_THRESHOLDS.warm && (l.lead_score as number) < SCORE_THRESHOLDS.hot);
  const cold = scored.filter(l => (l.lead_score as number) < SCORE_THRESHOLDS.warm);

  // Recent score changes (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recentChanges } = await ctx.supabase
    .from("lead_score_history")
    .select("lead_id, score, previous_score, trigger_event, created_at")
    .eq("tenant_id", ctx.tenantId)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  // Distribution by source
  const bySource: Record<string, { count: number; avg_score: number }> = {};
  for (const l of scored) {
    if (!bySource[l.source]) bySource[l.source] = { count: 0, avg_score: 0 };
    bySource[l.source].count++;
    bySource[l.source].avg_score += l.lead_score as number;
  }
  for (const k of Object.keys(bySource)) {
    bySource[k].avg_score = Math.round(bySource[k].avg_score / bySource[k].count);
  }

  return {
    kpis: {
      total_active: allLeads.length,
      scored_count: scored.length,
      unscored_count: unscored.length,
      average_score: avg,
      hot_count: hot.length,
      warm_count: warm.length,
      cold_count: cold.length,
    },
    top_leads: hot.slice(0, 10).map(l => ({
      id: l.id,
      name: l.name,
      score: l.lead_score,
      source: l.source,
      status: l.status,
      interest_type: l.interest_type,
      last_contact_at: l.last_contact_at,
      assigned_to: l.assigned_to,
    })),
    score_by_source: bySource,
    recent_changes: recentChanges ?? [],
    unscored_leads: unscored.slice(0, 20).map(l => ({ id: l.id, name: l.name, source: l.source, created_at: l.created_at })),
  };
}

// ── Action: batch_rescore ──
async function handleBatchRescore(ctx: AuthContext, body: Record<string, unknown>) {
  const leadIds = body.lead_ids as string[] | undefined;
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    throw new Error("lead_ids é obrigatório (array de UUIDs)");
  }
  if (leadIds.length > 50) {
    throw new Error("Máximo 50 leads por batch");
  }

  const results: Array<{ lead_id: string; score: number; level: ScoreLevel; error?: string }> = [];
  for (const id of leadIds) {
    try {
      const result = await scoreLead(ctx, id, "manual_rescore", true);
      results.push({ lead_id: result.lead_id, score: result.score, level: result.level });
    } catch (e) {
      results.push({ lead_id: id, score: 0, level: "cold", error: String(e) });
    }
  }

  return {
    total: leadIds.length,
    succeeded: results.filter(r => !r.error).length,
    failed: results.filter(r => !!r.error).length,
    results,
  };
}

// ── Main Handler ──
Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const ctx = await resolveAuth(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "score_lead");

    let result: unknown;

    switch (action) {
      case "score_lead": {
        const leadId = String(body.lead_id || "");
        if (!leadId) throw new Error("lead_id é obrigatório");
        const triggerEvent = body.trigger_event ? String(body.trigger_event) : undefined;
        const skipAI = body.skip_ai === true;
        result = await scoreLead(ctx, leadId, triggerEvent, skipAI);
        break;
      }
      case "score_portfolio":
        result = await handleScorePortfolio(ctx, body);
        break;
      case "get_dashboard":
        result = await handleGetDashboard(ctx);
        break;
      case "batch_rescore":
        result = await handleBatchRescore(ctx, body);
        break;
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    console.error("commercial-lead-scoring error:", e);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: message.includes("autenticado") || message.includes("Tenant") ? 401 : 400,
    });
  }
});
