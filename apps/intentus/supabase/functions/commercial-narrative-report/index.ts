/**
 * commercial-narrative-report v1
 * Relatórios comerciais com narrativa IA — texto explicativo contextual.
 *
 * 2 actions:
 *   - generate_report: Gera relatório com KPIs + narrativa IA (semanal/mensal/trimestral)
 *   - list_reports:    Lista relatórios gerados (histórico)
 *
 * Self-contained: inline CORS, auth/tenant, Gemini 2.0 Flash via OpenRouter.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── CORS ────────────────────────────────────────────────────────────────────
const PROD_ORIGINS = ["https://intentus-plataform.vercel.app", "https://app.intentusrealestate.com.br"];
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  let a = "";
  if (PROD_ORIGINS.includes(origin)) a = origin;
  else if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) a = origin;
  else if (/^https:\/\/intentus-plataform-.+\.vercel\.app$/.test(origin)) a = origin;
  return { "Access-Control-Allow-Origin": a || PROD_ORIGINS[0], "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
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
  const { data: profile } = await admin.from("profiles").select("tenant_id, name").eq("user_id", user.id).maybeSingle();
  if (!profile?.tenant_id) throw new Error("Sem empresa vinculada");
  return { tenantId: profile.tenant_id, userName: profile.name || "Usuário", admin };
}

function num(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n; }

// ─── Generate Report ─────────────────────────────────────────────────────────
async function handleGenerateReport(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  userName: string,
  body: Record<string, unknown>,
) {
  const period = (body.period as string) || "mensal"; // semanal | mensal | trimestral
  const now = new Date();
  let daysBack = 30;
  if (period === "semanal") daysBack = 7;
  if (period === "trimestral") daysBack = 90;
  const since = new Date(now.getTime() - daysBack * 86400000).toISOString();

  // Fetch data
  const [dealsRes, leadsRes, visitsRes] = await Promise.all([
    admin.from("deal_requests").select("id, status, deal_type, proposed_value, proposed_monthly_value, created_at, updated_at, assigned_to").eq("tenant_id", tenantId).gte("created_at", since).limit(500),
    admin.from("leads").select("id, status, source, created_at").eq("tenant_id", tenantId).gte("created_at", since).limit(500),
    admin.from("commercial_visits").select("id, status, feedback_rating, scheduled_at").eq("tenant_id", tenantId).gte("scheduled_at", since).limit(300),
  ]);

  const deals = (dealsRes.data || []) as any[];
  const leads = (leadsRes.data || []) as any[];
  const visits = (visitsRes.data || []) as any[];

  // Compute KPIs
  const newDeals = deals.length;
  const wonDeals = deals.filter(d => d.status === "concluido").length;
  const lostDeals = deals.filter(d => d.status === "cancelado").length;
  const openDeals = deals.filter(d => !["concluido", "cancelado"].includes(d.status)).length;
  const wonRevenue = deals.filter(d => d.status === "concluido").reduce((s, d) => s + num(d.proposed_value || d.proposed_monthly_value), 0);
  const pipelineValue = deals.filter(d => !["concluido", "cancelado"].includes(d.status)).reduce((s, d) => s + num(d.proposed_value || d.proposed_monthly_value), 0);
  const winRate = newDeals > 0 ? Math.round((wonDeals / (wonDeals + lostDeals || 1)) * 100) : 0;

  const newLeads = leads.length;
  const convertedLeads = leads.filter(l => l.status === "convertido").length;
  const leadConvRate = newLeads > 0 ? Math.round((convertedLeads / newLeads) * 100) : 0;
  const leadsBySource: Record<string, number> = {};
  for (const l of leads) { leadsBySource[l.source] = (leadsBySource[l.source] || 0) + 1; }

  const totalVisits = visits.length;
  const completedVisits = visits.filter(v => v.status === "realizada").length;
  const noShowVisits = visits.filter(v => v.status === "no_show").length;
  const avgRating = (() => {
    const ratings = visits.filter(v => v.feedback_rating > 0).map(v => v.feedback_rating);
    return ratings.length > 0 ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 10) / 10 : 0;
  })();

  const dataContext = `Período: ${period} (últimos ${daysBack} dias)
Negócios: ${newDeals} novos, ${wonDeals} ganhos (R$${wonRevenue.toLocaleString("pt-BR")}), ${lostDeals} perdidos, ${openDeals} em andamento
Pipeline: R$${pipelineValue.toLocaleString("pt-BR")} em aberto, Win Rate: ${winRate}%
Leads: ${newLeads} novos, ${convertedLeads} convertidos (${leadConvRate}%), por fonte: ${Object.entries(leadsBySource).map(([k, v]) => `${k}:${v}`).join(", ")}
Visitas: ${totalVisits} total, ${completedVisits} realizadas, ${noShowVisits} no-show, rating médio: ${avgRating}/5`;

  // AI Narrative
  let narrative = "";
  let modelUsed = "rule_engine_v1";
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");

  if (apiKey) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          temperature: 0.4,
          max_tokens: 1500,
          messages: [
            { role: "system", content: `Você é um analista comercial do mercado imobiliário brasileiro. Gere um relatório narrativo profissional em português BR com 4-6 parágrafos: (1) Resumo executivo, (2) Análise de negócios, (3) Análise de leads, (4) Visitas e atividade, (5) Pontos de atenção, (6) Recomendações. Use tom profissional mas acessível. Cite números específicos.` },
            { role: "user", content: `Gere relatório ${period} para ${userName}:\n${dataContext}` },
          ],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        narrative = data.choices?.[0]?.message?.content || "";
        modelUsed = "gemini-2.0-flash";
      }
    } catch { /* fallback */ }
  }

  if (!narrative) {
    narrative = `## Relatório ${period.charAt(0).toUpperCase() + period.slice(1)} — ${format(now)}\n\n`;
    narrative += `**Resumo:** Nos últimos ${daysBack} dias, a equipe comercial registrou ${newDeals} novos negócios com win rate de ${winRate}%. `;
    narrative += `A receita obtida foi de R$ ${wonRevenue.toLocaleString("pt-BR")} com ${wonDeals} negócios concluídos.\n\n`;
    narrative += `**Leads:** ${newLeads} novos leads captados, com taxa de conversão de ${leadConvRate}%. `;
    narrative += `Principal fonte: ${Object.entries(leadsBySource).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}.\n\n`;
    narrative += `**Visitas:** ${totalVisits} visitas agendadas, ${completedVisits} realizadas. `;
    if (noShowVisits > 0) narrative += `Atenção: ${noShowVisits} no-shows registrados.\n\n`;
    narrative += `**Recomendações:** Revisar pipeline de negócios em aberto (R$ ${pipelineValue.toLocaleString("pt-BR")}) e priorizar follow-up.`;
  }

  function format(d: Date) { return d.toLocaleDateString("pt-BR"); }

  return {
    data: {
      period,
      generated_at: now.toISOString(),
      generated_by: userName,
      kpis: {
        new_deals: newDeals, won_deals: wonDeals, lost_deals: lostDeals, open_deals: openDeals,
        won_revenue: wonRevenue, pipeline_value: pipelineValue, win_rate: winRate,
        new_leads: newLeads, converted_leads: convertedLeads, lead_conversion_rate: leadConvRate,
        total_visits: totalVisits, completed_visits: completedVisits, no_show_visits: noShowVisits, avg_rating: avgRating,
      },
      leads_by_source: leadsBySource,
      narrative,
      model_used: modelUsed,
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────
serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { tenantId, userName, admin } = await resolveAuth(req);
    const body = await req.json().catch(() => ({}));
    const action = (body.action as string) || "generate_report";

    let result: { data?: unknown; error?: string; status?: number };

    switch (action) {
      case "generate_report":
        result = await handleGenerateReport(admin, tenantId, userName, body);
        break;
      default:
        result = { error: `Unknown action: ${action}`, status: 400 };
    }

    if (result.error) return new Response(JSON.stringify({ error: result.error }), { status: result.status || 400, headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify(result.data), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("narrative-report error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
