/**
 * commercial-deal-forecast — Edge Function para Previsão IA de Fechamento de Deals.
 * Actions: forecast_deal, forecast_pipeline, get_dashboard, get_accuracy, analyze_bottlenecks
 * v1: Probability scoring, time-to-close estimation, pipeline forecast, AI bottleneck analysis via Gemini 2.0 Flash.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ─── CORS ────────────────────────────────────────────────────────────────────

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
  if (extra) for (const o of extra.split(",")) if (o.trim() === origin) return true;
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

// ─── Auth ────────────────────────────────────────────────────────────────────

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
    { global: { headers: { Authorization: authHeader } } },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n; }

function daysBetween(d1: string | Date, d2: string | Date): number {
  return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / 86400000;
}

// Stage weights for probability scoring
const STAGE_WEIGHTS: Record<string, number> = {
  prospeccao: 10,
  qualificacao: 20,
  apresentacao: 35,
  proposta: 50,
  negociacao: 70,
  fechamento: 85,
  concluido: 100,
  perdido: 0,
};

// ─── Fetch deal data ─────────────────────────────────────────────────────────

async function fetchDeals(supabase: ReturnType<typeof createClient>, tenantId: string, activeOnly = false) {
  let query = supabase
    .from("deal_requests")
    .select("id, title, status, stage, proposed_value, proposed_monthly_value, assigned_to, created_at, updated_at, property_id, lead_id, metadata")
    .eq("tenant_id", tenantId)
    .limit(500);

  if (activeOnly) {
    query = query.not("status", "in", "(concluido,perdido,cancelado)");
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as any[];
}

async function fetchHistoricalDeals(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();
  const { data } = await supabase
    .from("deal_requests")
    .select("id, status, stage, proposed_value, proposed_monthly_value, assigned_to, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .in("status", ["concluido", "perdido"])
    .gte("updated_at", sixMonthsAgo)
    .limit(500);
  return (data || []) as any[];
}

async function fetchInteractions(supabase: ReturnType<typeof createClient>, tenantId: string, dealIds: string[]) {
  if (dealIds.length === 0) return [];
  const { data } = await supabase
    .from("interactions")
    .select("id, deal_id, type, created_at")
    .eq("tenant_id", tenantId)
    .in("deal_id", dealIds.slice(0, 100))
    .limit(1000);
  return (data || []) as any[];
}

async function fetchVisits(supabase: ReturnType<typeof createClient>, tenantId: string, dealIds: string[]) {
  if (dealIds.length === 0) return [];
  const { data } = await supabase
    .from("commercial_visits")
    .select("id, deal_id, status, scheduled_at")
    .eq("tenant_id", tenantId)
    .in("deal_id", dealIds.slice(0, 100))
    .limit(500);
  return (data || []) as any[];
}

async function fetchProfiles(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await supabase.from("profiles").select("user_id, name").eq("tenant_id", tenantId).limit(100);
  return (data || []) as { user_id: string; name: string }[];
}

// ─── Forecast scoring ────────────────────────────────────────────────────────

interface DealForecast {
  dealId: string;
  title: string;
  stage: string;
  value: number;
  assignedTo: string;
  brokerName: string;
  probability: number;
  weightedValue: number;
  daysInPipeline: number;
  daysSinceActivity: number;
  estimatedCloseDate: string;
  estimatedDaysToClose: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskFactors: string[];
  signals: { type: "positive" | "negative" | "neutral"; text: string }[];
}

function computeDealForecast(
  deal: any,
  interactions: any[],
  visits: any[],
  historicalStats: { avgDaysToClose: number; winRate: number; avgInteractions: number },
  profileMap: Map<string, string>,
): DealForecast {
  const dealInteractions = interactions.filter((i: any) => i.deal_id === deal.id);
  const dealVisits = visits.filter((v: any) => v.deal_id === deal.id);
  const completedVisits = dealVisits.filter((v: any) => v.status === "realizada");

  const stage = deal.stage || deal.status || "prospeccao";
  const stageWeight = STAGE_WEIGHTS[stage] ?? 20;
  const value = num(deal.proposed_value || deal.proposed_monthly_value);
  const daysInPipeline = daysBetween(deal.created_at, new Date());

  // Activity recency
  const allDates = [
    ...dealInteractions.map((i: any) => new Date(i.created_at).getTime()),
    ...dealVisits.map((v: any) => new Date(v.scheduled_at).getTime()),
    new Date(deal.updated_at).getTime(),
  ];
  const lastActivity = Math.max(...allDates);
  const daysSinceActivity = (Date.now() - lastActivity) / 86400000;

  // ── Probability computation ──
  let probability = stageWeight;

  // Activity factor: more interactions = higher probability
  const interactionBonus = Math.min(dealInteractions.length * 3, 15);
  probability += interactionBonus;

  // Visit factor: completed visits are strong signals
  const visitBonus = Math.min(completedVisits.length * 5, 15);
  probability += visitBonus;

  // Recency penalty: stale deals are less likely to close
  if (daysSinceActivity > 14) probability -= 15;
  else if (daysSinceActivity > 7) probability -= 8;
  else if (daysSinceActivity > 3) probability -= 3;

  // Pipeline age penalty: very old deals are less likely
  if (daysInPipeline > 120) probability -= 15;
  else if (daysInPipeline > 90) probability -= 10;
  else if (daysInPipeline > 60) probability -= 5;

  // Value factor: above-average values slightly lower probability (harder to close)
  if (value > 500000) probability -= 5;

  // Clamp
  probability = Math.max(5, Math.min(95, Math.round(probability)));

  // ── Estimated days to close ──
  const stageProgress = stageWeight / 100;
  const remainingProgress = 1 - stageProgress;
  const estimatedDaysToClose = Math.round(
    historicalStats.avgDaysToClose * remainingProgress * (daysSinceActivity > 7 ? 1.3 : 1)
  );
  const estimatedCloseDate = new Date(Date.now() + estimatedDaysToClose * 86400000).toISOString().slice(0, 10);

  // ── Risk level ──
  const riskFactors: string[] = [];
  if (daysSinceActivity > 14) riskFactors.push("Sem atividade há mais de 14 dias");
  if (daysSinceActivity > 7) riskFactors.push("Atividade recente baixa (>7 dias)");
  if (daysInPipeline > 90) riskFactors.push("Deal no pipeline há mais de 90 dias");
  if (dealInteractions.length === 0) riskFactors.push("Nenhuma interação registrada");
  if (completedVisits.length === 0 && stageWeight >= 35) riskFactors.push("Nenhuma visita realizada em estágio avançado");

  let riskLevel: "low" | "medium" | "high" | "critical" = "low";
  if (riskFactors.length >= 3) riskLevel = "critical";
  else if (riskFactors.length >= 2) riskLevel = "high";
  else if (riskFactors.length >= 1) riskLevel = "medium";

  // ── Signals ──
  const signals: { type: "positive" | "negative" | "neutral"; text: string }[] = [];
  if (completedVisits.length > 0) signals.push({ type: "positive", text: `${completedVisits.length} visita(s) realizada(s)` });
  if (dealInteractions.length >= 5) signals.push({ type: "positive", text: `${dealInteractions.length} interações (engajamento alto)` });
  if (stageWeight >= 70) signals.push({ type: "positive", text: "Estágio avançado no funil" });
  if (daysSinceActivity > 14) signals.push({ type: "negative", text: "Inativo há mais de 2 semanas" });
  if (daysInPipeline > 90) signals.push({ type: "negative", text: "Pipeline envelhecido (>90 dias)" });
  if (dealInteractions.length === 0) signals.push({ type: "negative", text: "Sem interações registradas" });
  if (daysSinceActivity <= 3) signals.push({ type: "positive", text: "Atividade recente (últimos 3 dias)" });

  const weightedValue = Math.round(value * (probability / 100));

  return {
    dealId: deal.id,
    title: deal.title || "Deal sem título",
    stage,
    value,
    assignedTo: deal.assigned_to || "",
    brokerName: profileMap.get(deal.assigned_to) || "Não atribuído",
    probability,
    weightedValue,
    daysInPipeline: Math.round(daysInPipeline),
    daysSinceActivity: Math.round(daysSinceActivity),
    estimatedCloseDate,
    estimatedDaysToClose,
    riskLevel,
    riskFactors,
    signals,
  };
}

// ─── AI Bottleneck Analysis ──────────────────────────────────────────────────

async function analyzeBottlenecks(forecasts: DealForecast[], historicalStats: any) {
  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
  if (!GEMINI_KEY) return { analysis: "Chave Gemini não configurada.", recommendations: [], bottlenecks: [] };

  const stageDistribution: Record<string, number> = {};
  const riskDistribution: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  let totalValue = 0;
  let totalWeighted = 0;

  for (const f of forecasts) {
    stageDistribution[f.stage] = (stageDistribution[f.stage] || 0) + 1;
    riskDistribution[f.riskLevel]++;
    totalValue += f.value;
    totalWeighted += f.weightedValue;
  }

  const prompt = `Você é um consultor de vendas imobiliárias. Analise o pipeline e identifique gargalos e recomendações em português brasileiro.

PIPELINE:
- Total de deals ativos: ${forecasts.length}
- VGV total: R$${totalValue.toLocaleString("pt-BR")}
- VGV ponderado: R$${totalWeighted.toLocaleString("pt-BR")}
- Distribuição por estágio: ${JSON.stringify(stageDistribution)}
- Distribuição por risco: ${JSON.stringify(riskDistribution)}
- Média dias para fechar (histórico): ${historicalStats.avgDaysToClose}
- Win rate (histórico): ${(historicalStats.winRate * 100).toFixed(1)}%
- Deals em risco crítico: ${riskDistribution.critical}
- Deals inativos (>14 dias): ${forecasts.filter(f => f.daysSinceActivity > 14).length}

Responda EXCLUSIVAMENTE em JSON válido:
{
  "analysis": "Análise geral do pipeline em 2-3 frases",
  "bottlenecks": [
    {"stage": "estágio", "issue": "descrição do gargalo", "impact": "alto/médio/baixo", "suggestion": "sugestão"}
  ],
  "recommendations": ["Recomendação acionável 1", "Recomendação acionável 2", "Recomendação acionável 3"],
  "forecast": {
    "optimistic": "cenário otimista em 1 frase",
    "realistic": "cenário realista em 1 frase",
    "pessimistic": "cenário pessimista em 1 frase"
  }
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      },
    );
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      analysis: "Não foi possível gerar análise IA neste momento.",
      bottlenecks: [],
      recommendations: ["Foque nos deals em estágio avançado", "Reative deals inativos", "Acompanhe métricas semanalmente"],
      forecast: { optimistic: "N/A", realistic: "N/A", pessimistic: "N/A" },
    };
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const hdrs = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: hdrs });

  try {
    const { action, ...params } = await req.json();
    const auth = await resolveAuth(req);
    const { supabase, userId, tenantId } = auth;

    // ── Historical stats (used by multiple actions) ──
    async function getHistoricalStats() {
      const historical = await fetchHistoricalDeals(supabase, tenantId);
      const won = historical.filter((d: any) => d.status === "concluido");
      const lost = historical.filter((d: any) => d.status === "perdido");
      const totalClosed = won.length + lost.length;
      const winRate = totalClosed > 0 ? won.length / totalClosed : 0.3;

      const avgDaysToClose = won.length > 0
        ? Math.round(won.reduce((s: number, d: any) => s + daysBetween(d.created_at, d.updated_at), 0) / won.length)
        : 45;

      const avgInteractions = 5; // default
      return { avgDaysToClose, winRate, avgInteractions, wonCount: won.length, lostCount: lost.length, totalClosed };
    }

    // ── forecast_deal ──────────────────────────────────────────────────────
    if (action === "forecast_deal") {
      const dealId = params.deal_id;
      if (!dealId) throw new Error("deal_id é obrigatório");

      const { data: deal } = await supabase
        .from("deal_requests")
        .select("*")
        .eq("id", dealId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!deal) throw new Error("Deal não encontrado");

      const [interactions, visits, profiles, historicalStats] = await Promise.all([
        fetchInteractions(supabase, tenantId, [dealId]),
        fetchVisits(supabase, tenantId, [dealId]),
        fetchProfiles(supabase, tenantId),
        getHistoricalStats(),
      ]);

      const profileMap = new Map<string, string>();
      for (const p of profiles) profileMap.set(p.user_id, p.name);

      const forecast = computeDealForecast(deal, interactions, visits, historicalStats, profileMap);
      return new Response(JSON.stringify({ forecast, historicalStats }), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── forecast_pipeline ──────────────────────────────────────────────────
    if (action === "forecast_pipeline") {
      const [deals, profiles, historicalStats] = await Promise.all([
        fetchDeals(supabase, tenantId, true),
        fetchProfiles(supabase, tenantId),
        getHistoricalStats(),
      ]);

      const dealIds = deals.map((d: any) => d.id);
      const [interactions, visits] = await Promise.all([
        fetchInteractions(supabase, tenantId, dealIds),
        fetchVisits(supabase, tenantId, dealIds),
      ]);

      const profileMap = new Map<string, string>();
      for (const p of profiles) profileMap.set(p.user_id, p.name);

      const forecasts = deals.map((deal: any) =>
        computeDealForecast(deal, interactions, visits, historicalStats, profileMap)
      ).sort((a, b) => b.probability - a.probability);

      return new Response(JSON.stringify({ forecasts, historicalStats }), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── get_dashboard ──────────────────────────────────────────────────────
    if (action === "get_dashboard") {
      const [deals, profiles, historicalStats] = await Promise.all([
        fetchDeals(supabase, tenantId, true),
        fetchProfiles(supabase, tenantId),
        getHistoricalStats(),
      ]);

      const dealIds = deals.map((d: any) => d.id);
      const [interactions, visits] = await Promise.all([
        fetchInteractions(supabase, tenantId, dealIds),
        fetchVisits(supabase, tenantId, dealIds),
      ]);

      const profileMap = new Map<string, string>();
      for (const p of profiles) profileMap.set(p.user_id, p.name);

      const forecasts = deals.map((deal: any) =>
        computeDealForecast(deal, interactions, visits, historicalStats, profileMap)
      ).sort((a, b) => b.probability - a.probability);

      // Aggregate KPIs
      const totalVGV = forecasts.reduce((s, f) => s + f.value, 0);
      const weightedVGV = forecasts.reduce((s, f) => s + f.weightedValue, 0);
      const avgProbability = forecasts.length > 0 ? Math.round(forecasts.reduce((s, f) => s + f.probability, 0) / forecasts.length) : 0;
      const highProbDeals = forecasts.filter((f) => f.probability >= 70).length;
      const atRiskDeals = forecasts.filter((f) => f.riskLevel === "high" || f.riskLevel === "critical").length;
      const avgDaysToClose = forecasts.length > 0 ? Math.round(forecasts.reduce((s, f) => s + f.estimatedDaysToClose, 0) / forecasts.length) : 0;

      // Stage distribution
      const byStage: Record<string, { count: number; value: number; weighted: number }> = {};
      for (const f of forecasts) {
        if (!byStage[f.stage]) byStage[f.stage] = { count: 0, value: 0, weighted: 0 };
        byStage[f.stage].count++;
        byStage[f.stage].value += f.value;
        byStage[f.stage].weighted += f.weightedValue;
      }

      // Risk distribution
      const byRisk: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
      for (const f of forecasts) byRisk[f.riskLevel]++;

      // By broker
      const byBroker: Record<string, { name: string; count: number; value: number; weighted: number; avgProb: number }> = {};
      for (const f of forecasts) {
        if (!byBroker[f.assignedTo]) byBroker[f.assignedTo] = { name: f.brokerName, count: 0, value: 0, weighted: 0, avgProb: 0 };
        const b = byBroker[f.assignedTo];
        b.count++;
        b.value += f.value;
        b.weighted += f.weightedValue;
      }
      for (const key of Object.keys(byBroker)) {
        const brokerForecasts = forecasts.filter((f) => f.assignedTo === key);
        byBroker[key].avgProb = brokerForecasts.length > 0
          ? Math.round(brokerForecasts.reduce((s, f) => s + f.probability, 0) / brokerForecasts.length)
          : 0;
      }

      return new Response(JSON.stringify({
        kpis: { totalDeals: forecasts.length, totalVGV, weightedVGV, avgProbability, highProbDeals, atRiskDeals, avgDaysToClose },
        historicalStats,
        byStage,
        byRisk,
        byBroker,
        topDeals: forecasts.slice(0, 10),
        atRiskList: forecasts.filter((f) => f.riskLevel === "high" || f.riskLevel === "critical").slice(0, 10),
      }), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── get_accuracy ───────────────────────────────────────────────────────
    if (action === "get_accuracy") {
      const historicalStats = await getHistoricalStats();
      return new Response(JSON.stringify({
        winRate: historicalStats.winRate,
        avgDaysToClose: historicalStats.avgDaysToClose,
        wonCount: historicalStats.wonCount,
        lostCount: historicalStats.lostCount,
        totalClosed: historicalStats.totalClosed,
      }), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── analyze_bottlenecks ────────────────────────────────────────────────
    if (action === "analyze_bottlenecks") {
      const [deals, profiles, historicalStats] = await Promise.all([
        fetchDeals(supabase, tenantId, true),
        fetchProfiles(supabase, tenantId),
        getHistoricalStats(),
      ]);

      const dealIds = deals.map((d: any) => d.id);
      const [interactions, visits] = await Promise.all([
        fetchInteractions(supabase, tenantId, dealIds),
        fetchVisits(supabase, tenantId, dealIds),
      ]);

      const profileMap = new Map<string, string>();
      for (const p of profiles) profileMap.set(p.user_id, p.name);

      const forecasts = deals.map((deal: any) =>
        computeDealForecast(deal, interactions, visits, historicalStats, profileMap)
      );

      const analysis = await analyzeBottlenecks(forecasts, historicalStats);
      return new Response(JSON.stringify(analysis), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), { status: 400, headers: { ...hdrs, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), { status: 500, headers: { ...hdrs, "Content-Type": "application/json" } });
  }
});
