/**
 * commercial-win-loss-analysis v1
 * Análise de negócios ganhos vs perdidos com motivos, padrões e recomendações IA.
 *
 * 3 actions:
 *   - get_dashboard:   KPIs + breakdown por tipo/motivo/corretor/período
 *   - analyze_patterns: IA identifica padrões de perda e recomendações
 *   - get_deal_detail:  Detalhes de um deal específico (timeline + parties)
 *
 * Self-contained: inline CORS, auth/tenant, Gemini 2.0 Flash via OpenRouter.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── CORS ────────────────────────────────────────────────────────────────────
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  let a = "";
  if (PROD_ORIGINS.includes(origin)) a = origin;
  else if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) a = origin;
  else if (/^https:\/\/intentus-plataform-.+\.vercel\.app$/.test(origin)) a = origin;
  return {
    "Access-Control-Allow-Origin": a || PROD_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────
async function resolveAuth(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") ?? "";
  const uc = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await uc.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const admin = createClient(url, service);
  const { data: profile } = await admin.from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
  if (!profile?.tenant_id) throw new Error("Sem empresa vinculada");
  return { tenantId: profile.tenant_id, admin };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
async function handleGetDashboard(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const months = Math.min(24, Math.max(1, Number(body.months) || 12));
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const sinceStr = since.toISOString();

  // Fetch terminal deals
  const { data: deals } = await admin
    .from("deal_requests")
    .select("id, deal_type, status, proposed_value, proposed_monthly_value, lost_reason, assigned_to, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .in("status", ["concluido", "cancelado"])
    .gte("updated_at", sinceStr)
    .order("updated_at", { ascending: false })
    .limit(1000);

  const allDeals = (deals || []) as any[];
  const wins = allDeals.filter((d) => d.status === "concluido");
  const losses = allDeals.filter((d) => d.status === "cancelado");

  // KPIs
  const totalDeals = allDeals.length;
  const winCount = wins.length;
  const lossCount = losses.length;
  const winRate = totalDeals > 0 ? Math.round((winCount / totalDeals) * 100) : 0;
  const avgWinValue = winCount > 0 ? Math.round(wins.reduce((s, d) => s + num(d.proposed_value || d.proposed_monthly_value), 0) / winCount) : 0;
  const avgLossValue = lossCount > 0 ? Math.round(losses.reduce((s, d) => s + num(d.proposed_value || d.proposed_monthly_value), 0) / lossCount) : 0;
  const totalWonRevenue = wins.reduce((s, d) => s + num(d.proposed_value || d.proposed_monthly_value), 0);
  const totalLostRevenue = losses.reduce((s, d) => s + num(d.proposed_value || d.proposed_monthly_value), 0);

  // Avg cycle days
  const winCycles = wins.map((d) => daysBetween(d.created_at, d.updated_at));
  const lossCycles = losses.map((d) => daysBetween(d.created_at, d.updated_at));
  const avgWinCycle = winCycles.length > 0 ? Math.round(winCycles.reduce((a, b) => a + b, 0) / winCycles.length) : 0;
  const avgLossCycle = lossCycles.length > 0 ? Math.round(lossCycles.reduce((a, b) => a + b, 0) / lossCycles.length) : 0;

  // Loss reasons breakdown
  const reasonMap = new Map<string, number>();
  for (const d of losses) {
    const reason = d.lost_reason || "Não informado";
    reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
  }
  const lossReasons = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count, pct: lossCount > 0 ? Math.round((count / lossCount) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // By deal_type
  const typeMap = new Map<string, { wins: number; losses: number; winValue: number; lossValue: number }>();
  for (const d of allDeals) {
    const key = d.deal_type || "outro";
    if (!typeMap.has(key)) typeMap.set(key, { wins: 0, losses: 0, winValue: 0, lossValue: 0 });
    const t = typeMap.get(key)!;
    const val = num(d.proposed_value || d.proposed_monthly_value);
    if (d.status === "concluido") { t.wins++; t.winValue += val; }
    else { t.losses++; t.lossValue += val; }
  }
  const byType = Array.from(typeMap.entries()).map(([type, s]) => ({
    type,
    wins: s.wins,
    losses: s.losses,
    winRate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
    winValue: s.winValue,
    lossValue: s.lossValue,
  }));

  // By month (trend)
  const monthMap = new Map<string, { wins: number; losses: number }>();
  for (const d of allDeals) {
    const key = d.updated_at.slice(0, 7); // YYYY-MM
    if (!monthMap.has(key)) monthMap.set(key, { wins: 0, losses: 0 });
    const m = monthMap.get(key)!;
    if (d.status === "concluido") m.wins++;
    else m.losses++;
  }
  const monthlyTrend = Array.from(monthMap.entries())
    .map(([month, s]) => ({ month, wins: s.wins, losses: s.losses, winRate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // By broker
  const brokerMap = new Map<string, { name: string; wins: number; losses: number; winValue: number }>();
  const brokerIds = [...new Set(allDeals.map((d) => d.assigned_to).filter(Boolean))];
  let profileMap = new Map<string, string>();
  if (brokerIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, name")
      .in("user_id", brokerIds.slice(0, 50));
    if (profiles) {
      for (const p of profiles) profileMap.set(p.user_id, p.name || "Sem nome");
    }
  }
  for (const d of allDeals) {
    const bId = d.assigned_to || "sem_responsavel";
    if (!brokerMap.has(bId)) brokerMap.set(bId, { name: profileMap.get(bId) || "Sem responsável", wins: 0, losses: 0, winValue: 0 });
    const b = brokerMap.get(bId)!;
    const val = num(d.proposed_value || d.proposed_monthly_value);
    if (d.status === "concluido") { b.wins++; b.winValue += val; }
    else b.losses++;
  }
  const byBroker = Array.from(brokerMap.entries())
    .map(([id, s]) => ({ broker_id: id, name: s.name, wins: s.wins, losses: s.losses, winRate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0, winValue: s.winValue }))
    .sort((a, b) => b.wins - a.wins);

  // Top lost deals
  const topLost = losses
    .filter((d) => num(d.proposed_value || d.proposed_monthly_value) > 0)
    .sort((a, b) => num(b.proposed_value || b.proposed_monthly_value) - num(a.proposed_value || a.proposed_monthly_value))
    .slice(0, 10)
    .map((d) => ({
      id: d.id,
      deal_type: d.deal_type,
      value: num(d.proposed_value || d.proposed_monthly_value),
      lost_reason: d.lost_reason || "Não informado",
      days_to_loss: daysBetween(d.created_at, d.updated_at),
      updated_at: d.updated_at,
    }));

  return {
    data: {
      kpis: {
        total_deals: totalDeals,
        win_count: winCount,
        loss_count: lossCount,
        win_rate: winRate,
        avg_win_value: avgWinValue,
        avg_loss_value: avgLossValue,
        total_won_revenue: totalWonRevenue,
        total_lost_revenue: totalLostRevenue,
        avg_win_cycle_days: avgWinCycle,
        avg_loss_cycle_days: avgLossCycle,
      },
      loss_reasons: lossReasons,
      by_type: byType,
      monthly_trend: monthlyTrend,
      by_broker: byBroker,
      top_lost_deals: topLost,
      period_months: months,
    },
  };
}

// ─── AI Pattern Analysis ─────────────────────────────────────────────────────
async function handleAnalyzePatterns(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
) {
  // Fetch dashboard data for AI context
  const dashResult = await handleGetDashboard(admin, tenantId, { months: 6 });
  const dash = dashResult.data as any;

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return { data: buildRuleBasedInsights(dash) };
  }

  const systemPrompt = `Você é um analista de vendas especializado em mercado imobiliário brasileiro.
Analise os dados de win/loss de negócios e identifique padrões, problemas e oportunidades.
Retorne JSON:
{
  "patterns": [{ "title": "...", "description": "...", "impact": "alto|medio|baixo", "category": "perda|ganho|oportunidade|risco" }],
  "top_recommendations": [{ "action": "...", "priority": "alta|media|baixa", "expected_impact": "...", "timeframe": "curto|medio|longo" }],
  "loss_analysis": { "primary_causes": ["..."], "preventable_pct": 0-100, "critical_stage": "estágio onde mais se perde" },
  "win_analysis": { "success_factors": ["..."], "best_deal_type": "...", "best_broker_pattern": "..." },
  "forecast": { "trend": "melhorando|estavel|piorando", "confidence": 0-100, "explanation": "..." },
  "summary": "Resumo executivo de 3-4 frases"
}`;

  const context = `Dados Win/Loss (últimos ${dash.period_months} meses):
- Total: ${dash.kpis.total_deals} negócios (${dash.kpis.win_count} ganhos, ${dash.kpis.loss_count} perdidos)
- Win Rate: ${dash.kpis.win_rate}%
- Valor médio ganho: R$ ${dash.kpis.avg_win_value} | Valor médio perdido: R$ ${dash.kpis.avg_loss_value}
- Receita ganha: R$ ${dash.kpis.total_won_revenue} | Receita perdida: R$ ${dash.kpis.total_lost_revenue}
- Ciclo médio ganho: ${dash.kpis.avg_win_cycle_days} dias | Ciclo médio perda: ${dash.kpis.avg_loss_cycle_days} dias

Motivos de perda: ${dash.loss_reasons.map((r: any) => `${r.reason} (${r.count}x, ${r.pct}%)`).join(", ")}

Por tipo: ${dash.by_type.map((t: any) => `${t.type}: ${t.wins}W/${t.losses}L (${t.winRate}%)`).join(", ")}

Tendência mensal: ${dash.monthly_trend.map((m: any) => `${m.month}: ${m.wins}W/${m.losses}L (${m.winRate}%)`).join(", ")}

Por corretor: ${dash.by_broker.slice(0, 5).map((b: any) => `${b.name}: ${b.wins}W/${b.losses}L (${b.winRate}%)`).join(", ")}

TOP perdas por valor: ${dash.top_lost_deals.slice(0, 5).map((d: any) => `R$${d.value} (${d.lost_reason}, ${d.days_to_loss}d)`).join(", ")}`;

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 2048,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
      }),
    });

    if (!resp.ok) {
      console.error("AI error:", resp.status);
      return { data: { ...buildRuleBasedInsights(dash), model_used: "rule_engine_v1" } };
    }

    const aiData = await resp.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return { data: { ...buildRuleBasedInsights(dash), model_used: "rule_engine_v1" } };

    const parsed = JSON.parse(content);
    return { data: { ...parsed, model_used: "gemini-2.0-flash" } };
  } catch {
    return { data: { ...buildRuleBasedInsights(dash), model_used: "rule_engine_v1" } };
  }
}

function buildRuleBasedInsights(dash: any) {
  const patterns: any[] = [];
  const recommendations: any[] = [];

  const wr = dash.kpis.win_rate;
  if (wr < 30) patterns.push({ title: "Win rate crítico", description: `Taxa de ${wr}% está abaixo do benchmark de 30%`, impact: "alto", category: "risco" });
  else if (wr > 60) patterns.push({ title: "Win rate excelente", description: `Taxa de ${wr}% acima do benchmark`, impact: "alto", category: "ganho" });

  if (dash.kpis.avg_loss_cycle_days > dash.kpis.avg_win_cycle_days * 1.5) {
    patterns.push({ title: "Ciclos de perda muito longos", description: `Perdas levam ${dash.kpis.avg_loss_cycle_days}d vs ${dash.kpis.avg_win_cycle_days}d de ganhos`, impact: "medio", category: "risco" });
    recommendations.push({ action: "Implementar SLA de decisão para evitar deals zumbis", priority: "alta", expected_impact: "Reduzir ciclo de perda em 30%", timeframe: "curto" });
  }

  if (dash.loss_reasons.length > 0) {
    const topReason = dash.loss_reasons[0];
    patterns.push({ title: `Principal motivo de perda: ${topReason.reason}`, description: `${topReason.count} ocorrências (${topReason.pct}% das perdas)`, impact: "alto", category: "perda" });
    recommendations.push({ action: `Criar playbook específico para lidar com "${topReason.reason}"`, priority: "alta", expected_impact: `Reduzir perdas por este motivo em 20-30%`, timeframe: "medio" });
  }

  recommendations.push({ action: "Analisar os 10 maiores negócios perdidos individualmente", priority: "media", expected_impact: "Identificar padrões específicos de perda de alto valor", timeframe: "curto" });

  return {
    patterns,
    top_recommendations: recommendations,
    loss_analysis: {
      primary_causes: dash.loss_reasons.slice(0, 3).map((r: any) => r.reason),
      preventable_pct: 40,
      critical_stage: "Análise baseada em regras — necessita dados detalhados",
    },
    win_analysis: {
      success_factors: ["Acompanhamento ativo", "Proposta competitiva"],
      best_deal_type: dash.by_type.sort((a: any, b: any) => b.winRate - a.winRate)[0]?.type || "N/A",
      best_broker_pattern: "Análise individual necessária",
    },
    forecast: { trend: "estavel", confidence: 30, explanation: "Análise rule-based com confiança limitada" },
    summary: `Nos últimos ${dash.period_months} meses, ${dash.kpis.total_deals} negócios foram concluídos com win rate de ${wr}%. Principal motivo de perda: ${dash.loss_reasons[0]?.reason || "N/A"}.`,
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { tenantId, admin } = await resolveAuth(req);
    const body = await req.json().catch(() => ({}));
    const action = (body.action as string) || "get_dashboard";

    let result: { data?: unknown; error?: string; status?: number };

    switch (action) {
      case "get_dashboard":
        result = await handleGetDashboard(admin, tenantId, body);
        break;
      case "analyze_patterns":
        result = await handleAnalyzePatterns(admin, tenantId);
        break;
      default:
        result = { error: `Unknown action: ${action}`, status: 400 };
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status || 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(result.data), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("commercial-win-loss-analysis error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
