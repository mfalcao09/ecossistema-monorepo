/**
 * commercial-gamification-engine — Edge Function para Gamificação e Ranking de Corretores.
 * Actions: get_dashboard, get_broker_detail, get_challenges, record_achievement, analyze_performance, get_leaderboard_history
 * v1: Backend-powered ranking, badges, streaks, challenges, AI coaching via Gemini 2.0 Flash.
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

// ─── Constants ───────────────────────────────────────────────────────────────

const POINTS = {
  deal_won: 100,
  lead_converted: 50,
  visit_completed: 20,
  interaction: 5,
  revenue_per_10k: 10,
};

interface BadgeDef {
  label: string;
  icon: string;
  condition: (b: Breakdown) => boolean;
  progress: (b: Breakdown) => { current: number; target: number };
}

interface Breakdown {
  dealsWon: number;
  leadsConverted: number;
  visitsCompleted: number;
  interactions: number;
  revenue: number;
}

const BADGES: Record<string, BadgeDef> = {
  closer:       { label: "Closer",       icon: "🏆", condition: (b) => b.dealsWon >= 5,        progress: (b) => ({ current: b.dealsWon, target: 5 }) },
  prospector:   { label: "Prospector",   icon: "🎯", condition: (b) => b.leadsConverted >= 10,  progress: (b) => ({ current: b.leadsConverted, target: 10 }) },
  hustler:      { label: "Hustler",      icon: "⚡", condition: (b) => b.interactions >= 50,    progress: (b) => ({ current: b.interactions, target: 50 }) },
  visitor:      { label: "Visitador",    icon: "🏠", condition: (b) => b.visitsCompleted >= 15, progress: (b) => ({ current: b.visitsCompleted, target: 15 }) },
  revenue_king: { label: "Rei da Receita", icon: "💰", condition: (b) => b.revenue >= 100000,   progress: (b) => ({ current: b.revenue, target: 100000 }) },
};

const CHALLENGE_TEMPLATES = [
  { id: "convert_5_leads", title: "Converter 5 leads", description: "Converta 5 leads em clientes", metric: "leadsConverted", target: 5, points: 200, type: "weekly" as const },
  { id: "complete_10_visits", title: "Completar 10 visitas", description: "Realize 10 visitas esta semana", metric: "visitsCompleted", target: 10, points: 150, type: "weekly" as const },
  { id: "close_3_deals", title: "Fechar 3 negócios", description: "Feche 3 negócios este mês", metric: "dealsWon", target: 3, points: 300, type: "monthly" as const },
  { id: "50_interactions", title: "50 interações", description: "Registre 50 interações", metric: "interactions", target: 50, points: 100, type: "weekly" as const },
  { id: "revenue_50k", title: "R$50k em receita", description: "Gere R$50k em receita este mês", metric: "revenue", target: 50000, points: 250, type: "monthly" as const },
  { id: "visit_streak_5", title: "Streak de 5 dias", description: "Faça visitas por 5 dias consecutivos", metric: "visitStreak", target: 5, points: 175, type: "weekly" as const },
];

function num(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n; }

// ─── Data fetchers ───────────────────────────────────────────────────────────

async function fetchRankingData(supabase: ReturnType<typeof createClient>, tenantId: string, daysBack: number) {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  const [dealsRes, leadsRes, visitsRes, interactionsRes, profilesRes] = await Promise.all([
    supabase.from("deal_requests")
      .select("id, status, proposed_value, proposed_monthly_value, assigned_to, updated_at")
      .eq("tenant_id", tenantId).eq("status", "concluido").gte("updated_at", since).limit(1000),
    supabase.from("leads")
      .select("id, status, assigned_to, converted_at")
      .eq("tenant_id", tenantId).eq("status", "convertido").gte("converted_at", since).limit(1000),
    supabase.from("commercial_visits")
      .select("id, status, assigned_to, scheduled_at")
      .eq("tenant_id", tenantId).eq("status", "realizada").gte("scheduled_at", since).limit(1000),
    supabase.from("interactions")
      .select("id, user_id, created_at")
      .eq("tenant_id", tenantId).gte("created_at", since).limit(2000),
    supabase.from("profiles")
      .select("user_id, name, avatar_url")
      .eq("tenant_id", tenantId).limit(100),
  ]);

  return {
    deals: (dealsRes.data || []) as any[],
    leads: (leadsRes.data || []) as any[],
    visits: (visitsRes.data || []) as any[],
    interactions: (interactionsRes.data || []) as any[],
    profiles: (profilesRes.data || []) as { user_id: string; name: string; avatar_url?: string }[],
  };
}

function computeRanking(data: Awaited<ReturnType<typeof fetchRankingData>>) {
  const { deals, leads, visits, interactions, profiles } = data;
  const profileMap = new Map<string, { name: string; avatar_url?: string }>();
  for (const p of profiles) profileMap.set(p.user_id, { name: p.name, avatar_url: p.avatar_url });

  const brokerMap = new Map<string, Breakdown & { totalPoints: number }>();

  function ensure(uid: string) {
    if (!brokerMap.has(uid)) brokerMap.set(uid, { dealsWon: 0, leadsConverted: 0, visitsCompleted: 0, interactions: 0, revenue: 0, totalPoints: 0 });
    return brokerMap.get(uid)!;
  }

  for (const d of deals) {
    const uid = d.assigned_to; if (!uid) continue;
    const b = ensure(uid);
    b.dealsWon++;
    const val = num(d.proposed_value || d.proposed_monthly_value);
    b.revenue += val;
  }

  for (const l of leads) {
    const uid = l.assigned_to; if (!uid) continue;
    ensure(uid).leadsConverted++;
  }

  for (const v of visits) {
    const uid = v.assigned_to; if (!uid) continue;
    ensure(uid).visitsCompleted++;
  }

  for (const i of interactions) {
    const uid = i.user_id; if (!uid) continue;
    ensure(uid).interactions++;
  }

  // Compute points and badges
  const ranking = Array.from(brokerMap.entries()).map(([userId, b]) => {
    const totalPoints =
      b.dealsWon * POINTS.deal_won +
      b.leadsConverted * POINTS.lead_converted +
      b.visitsCompleted * POINTS.visit_completed +
      b.interactions * POINTS.interaction +
      Math.floor(b.revenue / 10000) * POINTS.revenue_per_10k;

    const badges: { key: string; label: string; icon: string }[] = [];
    const badgeProgress: Record<string, { current: number; target: number; earned: boolean }> = {};
    for (const [key, def] of Object.entries(BADGES)) {
      const earned = def.condition(b);
      if (earned) badges.push({ key, label: def.label, icon: def.icon });
      badgeProgress[key] = { ...def.progress(b), earned };
    }

    const prof = profileMap.get(userId);
    return {
      userId,
      name: prof?.name || "Corretor",
      avatarUrl: prof?.avatar_url || null,
      totalPoints,
      rank: 0,
      badges,
      badgeProgress,
      breakdown: {
        dealsWon: b.dealsWon,
        dealsWonPoints: b.dealsWon * POINTS.deal_won,
        leadsConverted: b.leadsConverted,
        leadsConvertedPoints: b.leadsConverted * POINTS.lead_converted,
        visitsCompleted: b.visitsCompleted,
        visitsPoints: b.visitsCompleted * POINTS.visit_completed,
        interactions: b.interactions,
        interactionsPoints: b.interactions * POINTS.interaction,
        revenue: b.revenue,
        revenuePoints: Math.floor(b.revenue / 10000) * POINTS.revenue_per_10k,
      },
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  ranking.forEach((r, i) => { r.rank = i + 1; });
  return ranking;
}

// ─── Streak computation ──────────────────────────────────────────────────────

function computeStreak(visits: any[], userId: string): number {
  const userVisits = visits
    .filter((v: any) => v.assigned_to === userId)
    .map((v: any) => new Date(v.scheduled_at).toISOString().slice(0, 10));

  const uniqueDays = [...new Set(userVisits)].sort().reverse();
  if (uniqueDays.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const curr = new Date(uniqueDays[i - 1]);
    const prev = new Date(uniqueDays[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff <= 1) streak++;
    else break;
  }
  return streak;
}

// ─── Weekly history (from automation_logs snapshots) ─────────────────────────

async function getLeaderboardHistory(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000).toISOString();
  const { data } = await supabase
    .from("commercial_automation_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("entity_type", "gamification_snapshot")
    .gte("created_at", fourWeeksAgo)
    .order("created_at", { ascending: true })
    .limit(100);

  return (data || []).map((d: any) => ({
    week: d.automation_name,
    createdAt: d.created_at,
    rankings: d.metadata?.rankings || [],
  }));
}

async function saveLeaderboardSnapshot(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  ranking: any[],
) {
  const weekLabel = `week_${new Date().toISOString().slice(0, 10)}`;

  // Check if snapshot for today already exists
  const { data: existing } = await supabase
    .from("commercial_automation_logs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("entity_type", "gamification_snapshot")
    .eq("automation_name", weekLabel)
    .maybeSingle();

  const top10 = ranking.slice(0, 10).map((r: any) => ({
    userId: r.userId,
    name: r.name,
    rank: r.rank,
    totalPoints: r.totalPoints,
    badges: r.badges.length,
  }));

  if (existing) {
    await supabase.from("commercial_automation_logs")
      .update({ metadata: { rankings: top10 }, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("commercial_automation_logs").insert({
      tenant_id: tenantId,
      entity_type: "gamification_snapshot",
      entity_id: crypto.randomUUID(),
      automation_name: weekLabel,
      action_type: "snapshot",
      status: "completed",
      metadata: { rankings: top10 },
    });
  }
}

// ─── Challenges ──────────────────────────────────────────────────────────────

async function getChallenges(supabase: ReturnType<typeof createClient>, tenantId: string, userId: string, breakdown: any) {
  // Get active challenges from automation_logs
  const { data: activeChallenges } = await supabase
    .from("commercial_automation_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("entity_type", "gamification_challenge")
    .in("status", ["pending", "active"])
    .limit(50);

  // If no challenges, generate default ones
  const challenges = (activeChallenges || []).map((c: any) => {
    const meta = c.metadata || {};
    const template = CHALLENGE_TEMPLATES.find((t) => t.id === meta.template_id);
    const progress = breakdown ? num(breakdown[meta.metric]) : 0;
    const target = num(meta.target);
    return {
      id: c.id,
      title: meta.title || template?.title || "Desafio",
      description: meta.description || template?.description || "",
      metric: meta.metric,
      target,
      current: Math.min(progress, target),
      points: num(meta.points),
      type: meta.type || "weekly",
      completed: progress >= target,
      expiresAt: meta.expires_at,
    };
  });

  return { challenges, templates: CHALLENGE_TEMPLATES };
}

async function createChallenge(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  templateId: string,
  brokerIds: string[],
) {
  const template = CHALLENGE_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error("Template não encontrado");

  const now = new Date();
  const expiresAt = template.type === "weekly"
    ? new Date(now.getTime() + 7 * 86400000).toISOString()
    : new Date(now.getTime() + 30 * 86400000).toISOString();

  const inserts = brokerIds.map((brokerId) => ({
    tenant_id: tenantId,
    entity_type: "gamification_challenge",
    entity_id: brokerId,
    automation_name: `challenge_${templateId}`,
    action_type: "challenge_created",
    status: "active",
    metadata: {
      template_id: templateId,
      title: template.title,
      description: template.description,
      metric: template.metric,
      target: template.target,
      points: template.points,
      type: template.type,
      expires_at: expiresAt,
      broker_id: brokerId,
    },
  }));

  const { error } = await supabase.from("commercial_automation_logs").insert(inserts);
  if (error) throw error;

  return { created: inserts.length, expiresAt };
}

// ─── Record achievement ──────────────────────────────────────────────────────

async function recordAchievement(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  type: "badge_earned" | "challenge_completed" | "rank_up",
  details: Record<string, unknown>,
) {
  await supabase.from("pulse_events").insert({
    tenant_id: tenantId,
    user_id: userId,
    event_type: `gamification_${type}`,
    entity_type: "gamification",
    entity_id: userId,
    title: details.title || `Conquista: ${type}`,
    description: details.description || "",
    priority: type === "badge_earned" ? "high" : "medium",
    metadata: details,
  });

  return { recorded: true };
}

// ─── AI Performance Analysis ─────────────────────────────────────────────────

async function analyzePerformance(brokerName: string, breakdown: any, rank: number, totalBrokers: number, badges: any[]) {
  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
  if (!GEMINI_KEY) return { analysis: "Chave Gemini não configurada. Configure GEMINI_API_KEY.", tips: [], strengths: [], improvements: [] };

  const prompt = `Você é um coach de vendas imobiliárias. Analise o desempenho deste corretor e dê feedback construtivo em português brasileiro.

CORRETOR: ${brokerName}
POSIÇÃO NO RANKING: #${rank} de ${totalBrokers}
MÉTRICAS DO PERÍODO:
- Negócios fechados: ${breakdown.dealsWon} (${breakdown.dealsWonPoints} pts)
- Leads convertidos: ${breakdown.leadsConverted} (${breakdown.leadsConvertedPoints} pts)
- Visitas realizadas: ${breakdown.visitsCompleted} (${breakdown.visitsPoints} pts)
- Interações: ${breakdown.interactions} (${breakdown.interactionsPoints} pts)
- Receita: R$${num(breakdown.revenue).toLocaleString("pt-BR")} (${breakdown.revenuePoints} pts)
- Total de pontos: ${breakdown.dealsWonPoints + breakdown.leadsConvertedPoints + breakdown.visitsPoints + breakdown.interactionsPoints + breakdown.revenuePoints}
- Badges conquistados: ${badges.map((b: any) => b.label).join(", ") || "Nenhum"}

Responda EXCLUSIVAMENTE em JSON válido:
{
  "analysis": "Análise geral de 2-3 frases",
  "strengths": ["Ponto forte 1", "Ponto forte 2"],
  "improvements": ["Área de melhoria 1", "Área de melhoria 2"],
  "tips": ["Dica acionável 1", "Dica acionável 2", "Dica acionável 3"],
  "nextActions": ["Ação sugerida 1", "Ação sugerida 2"]
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
  } catch (e) {
    return {
      analysis: "Não foi possível gerar análise IA neste momento.",
      tips: ["Foque em aumentar o número de visitas", "Mantenha o follow-up em dia"],
      strengths: [],
      improvements: [],
      nextActions: [],
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

    // ── get_dashboard ──────────────────────────────────────────────────────
    if (action === "get_dashboard") {
      const period = params.period || "mensal";
      const daysBack = period === "trimestral" ? 90 : 30;
      const data = await fetchRankingData(supabase, tenantId, daysBack);
      const ranking = computeRanking(data);

      // Save snapshot
      await saveLeaderboardSnapshot(supabase, tenantId, ranking);

      // Compute streaks
      const rankingWithStreaks = ranking.map((r) => ({
        ...r,
        streak: computeStreak(data.visits, r.userId),
      }));

      const totalPointsDistributed = ranking.reduce((s, r) => s + r.totalPoints, 0);
      const avgPoints = ranking.length > 0 ? Math.round(totalPointsDistributed / ranking.length) : 0;
      const totalBadges = ranking.reduce((s, r) => s + r.badges.length, 0);

      return new Response(JSON.stringify({
        ranking: rankingWithStreaks,
        topPerformer: ranking[0]?.name || "N/A",
        totalPointsDistributed,
        avgPoints,
        totalBadges,
        participantCount: ranking.length,
        periodLabel: period === "mensal" ? "Últimos 30 dias" : "Últimos 90 dias",
        period,
      }), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── get_broker_detail ──────────────────────────────────────────────────
    if (action === "get_broker_detail") {
      const brokerId = params.broker_id || userId;
      const period = params.period || "mensal";
      const daysBack = period === "trimestral" ? 90 : 30;
      const data = await fetchRankingData(supabase, tenantId, daysBack);
      const ranking = computeRanking(data);
      const broker = ranking.find((r) => r.userId === brokerId);

      if (!broker) return new Response(JSON.stringify({ error: "Corretor não encontrado no ranking" }), { status: 404, headers: { ...hdrs, "Content-Type": "application/json" } });

      // Weekly point history (last 4 weeks)
      const weeklyHistory = [];
      for (let w = 3; w >= 0; w--) {
        const weekStart = new Date(Date.now() - (w + 1) * 7 * 86400000);
        const weekEnd = new Date(Date.now() - w * 7 * 86400000);
        const weekLabel = `Sem ${4 - w}`;

        const weekDeals = data.deals.filter((d: any) => d.assigned_to === brokerId && new Date(d.updated_at) >= weekStart && new Date(d.updated_at) < weekEnd).length;
        const weekLeads = data.leads.filter((l: any) => l.assigned_to === brokerId && new Date(l.converted_at) >= weekStart && new Date(l.converted_at) < weekEnd).length;
        const weekVisits = data.visits.filter((v: any) => v.assigned_to === brokerId && new Date(v.scheduled_at) >= weekStart && new Date(v.scheduled_at) < weekEnd).length;
        const weekInteractions = data.interactions.filter((i: any) => i.user_id === brokerId && new Date(i.created_at) >= weekStart && new Date(i.created_at) < weekEnd).length;

        const weekPoints = weekDeals * POINTS.deal_won + weekLeads * POINTS.lead_converted + weekVisits * POINTS.visit_completed + weekInteractions * POINTS.interaction;

        weeklyHistory.push({ week: weekLabel, points: weekPoints, deals: weekDeals, leads: weekLeads, visits: weekVisits, interactions: weekInteractions });
      }

      const streak = computeStreak(data.visits, brokerId);

      return new Response(JSON.stringify({
        broker: { ...broker, streak },
        weeklyHistory,
        totalBrokers: ranking.length,
      }), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── get_challenges ─────────────────────────────────────────────────────
    if (action === "get_challenges") {
      const period = params.period || "mensal";
      const daysBack = period === "trimestral" ? 90 : 30;
      const data = await fetchRankingData(supabase, tenantId, daysBack);
      const ranking = computeRanking(data);
      const broker = ranking.find((r) => r.userId === (params.broker_id || userId));
      const breakdown = broker?.breakdown || null;

      const result = await getChallenges(supabase, tenantId, params.broker_id || userId, breakdown);
      return new Response(JSON.stringify(result), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── create_challenge ───────────────────────────────────────────────────
    if (action === "create_challenge") {
      const { template_id, broker_ids } = params;
      if (!template_id || !broker_ids?.length) throw new Error("template_id e broker_ids são obrigatórios");
      const result = await createChallenge(supabase, tenantId, template_id, broker_ids);
      return new Response(JSON.stringify(result), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── record_achievement ─────────────────────────────────────────────────
    if (action === "record_achievement") {
      const { type, details } = params;
      if (!type) throw new Error("type é obrigatório");
      const result = await recordAchievement(supabase, tenantId, params.broker_id || userId, type, details || {});
      return new Response(JSON.stringify(result), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── analyze_performance ────────────────────────────────────────────────
    if (action === "analyze_performance") {
      const period = params.period || "mensal";
      const daysBack = period === "trimestral" ? 90 : 30;
      const data = await fetchRankingData(supabase, tenantId, daysBack);
      const ranking = computeRanking(data);
      const brokerId = params.broker_id || userId;
      const broker = ranking.find((r) => r.userId === brokerId);

      if (!broker) return new Response(JSON.stringify({ error: "Corretor não encontrado" }), { status: 404, headers: { ...hdrs, "Content-Type": "application/json" } });

      const analysis = await analyzePerformance(broker.name, broker.breakdown, broker.rank, ranking.length, broker.badges);
      return new Response(JSON.stringify(analysis), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── get_leaderboard_history ────────────────────────────────────────────
    if (action === "get_leaderboard_history") {
      const history = await getLeaderboardHistory(supabase, tenantId);
      return new Response(JSON.stringify({ history }), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), { status: 400, headers: { ...hdrs, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), { status: 500, headers: { ...hdrs, "Content-Type": "application/json" } });
  }
});
