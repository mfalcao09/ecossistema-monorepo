/**
 * commercial-prospector-ai — Edge Function para Captação Ativa com IA.
 * Actions: analyze_icp, generate_approach, get_dashboard, create_campaign, update_campaign_contact, get_campaigns
 * v1: ICP analysis via Gemini, approach templates, campaign tracking.
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

// ─── Gemini Helper ───────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta do modelo.";
}

// ─── Pulse Helper ────────────────────────────────────────────────────────────

async function emitPulse(
  sb: ReturnType<typeof createClient>, tenantId: string, userId: string,
  eventType: string, title: string, description: string, metadata: Record<string, unknown> = {},
) {
  try {
    await sb.from("pulse_events").insert({
      tenant_id: tenantId, user_id: userId, event_type: eventType,
      title, description, priority: "medium", metadata,
    });
  } catch (_) { /* non-blocking */ }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { supabase, userId, tenantId } = await resolveAuth(req);
    const { action, ...params } = await req.json();
    let result: unknown = null;

    switch (action) {
      // ── Analyze ICP (Ideal Customer Profile) ──────────────────────────
      case "analyze_icp": {
        // Fetch converted leads + their deals
        const { data: convertedLeads, error: leadsErr } = await supabase
          .from("leads")
          .select("id, name, source, interest_type, budget_min, budget_max, preferred_region, created_at, lead_score")
          .eq("tenant_id", tenantId)
          .eq("status", "convertido")
          .order("created_at", { ascending: false })
          .limit(100);
        if (leadsErr) throw leadsErr;

        // Fetch all leads for comparison
        const { data: allLeads, error: allErr } = await supabase
          .from("leads")
          .select("id, source, status, interest_type, budget_min, budget_max, preferred_region, lead_score")
          .eq("tenant_id", tenantId)
          .limit(500);
        if (allErr) throw allErr;

        // Fetch deals for value data
        const { data: deals } = await supabase
          .from("deal_requests")
          .select("id, value, status, lead_id, created_at")
          .eq("tenant_id", tenantId)
          .limit(200);

        // Compute local ICP metrics
        const converted = convertedLeads || [];
        const all = allLeads || [];
        const dealsList = deals || [];

        // Source analysis
        const sourceMap = new Map<string, number>();
        for (const l of converted) { sourceMap.set(l.source, (sourceMap.get(l.source) || 0) + 1); }
        const topSources = Array.from(sourceMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([source, count]) => ({ source, count, pct: Math.round((count / converted.length) * 100) }));

        // Interest type
        const interestMap = new Map<string, number>();
        for (const l of converted) { if (l.interest_type) interestMap.set(l.interest_type, (interestMap.get(l.interest_type) || 0) + 1); }

        // Budget range
        const budgets = converted.filter(l => l.budget_min || l.budget_max);
        const avgBudgetMin = budgets.length > 0 ? Math.round(budgets.reduce((s, l) => s + (l.budget_min || 0), 0) / budgets.length) : 0;
        const avgBudgetMax = budgets.length > 0 ? Math.round(budgets.reduce((s, l) => s + (l.budget_max || 0), 0) / budgets.length) : 0;

        // Region
        const regionMap = new Map<string, number>();
        for (const l of converted) { if (l.preferred_region) regionMap.set(l.preferred_region, (regionMap.get(l.preferred_region) || 0) + 1); }
        const topRegions = Array.from(regionMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

        // Conversion rate by source
        const sourceTotal = new Map<string, number>();
        const sourceConverted = new Map<string, number>();
        for (const l of all) {
          sourceTotal.set(l.source, (sourceTotal.get(l.source) || 0) + 1);
          if (l.status === "convertido") sourceConverted.set(l.source, (sourceConverted.get(l.source) || 0) + 1);
        }
        const conversionBySource = Array.from(sourceTotal.entries()).map(([source, total]) => ({
          source, total, converted: sourceConverted.get(source) || 0,
          rate: total > 0 ? Math.round(((sourceConverted.get(source) || 0) / total) * 100) : 0,
        })).sort((a, b) => b.rate - a.rate);

        // Average deal value
        const dealValues = dealsList.filter(d => d.value).map(d => d.value);
        const avgDealValue = dealValues.length > 0 ? Math.round(dealValues.reduce((s, v) => s + v, 0) / dealValues.length) : 0;

        // Build prompt for IA analysis
        const icpData = {
          total_leads: all.length,
          converted_leads: converted.length,
          conversion_rate: all.length > 0 ? ((converted.length / all.length) * 100).toFixed(1) : "0",
          top_sources: topSources,
          interest_types: Array.from(interestMap.entries()),
          avg_budget: { min: avgBudgetMin, max: avgBudgetMax },
          top_regions: topRegions,
          avg_deal_value: avgDealValue,
          conversion_by_source: conversionBySource.slice(0, 5),
        };

        let aiAnalysis = "";
        try {
          aiAnalysis = await callGemini(`
Você é um especialista em inteligência comercial imobiliária no Brasil.
Analise estes dados de ICP (Ideal Customer Profile) e gere um relatório estruturado em JSON.

Dados:
${JSON.stringify(icpData, null, 2)}

Retorne APENAS um JSON válido (sem markdown) com esta estrutura:
{
  "icp_summary": "Descrição em 2-3 frases do perfil ideal do cliente",
  "key_insights": ["insight 1", "insight 2", "insight 3", "insight 4"],
  "recommended_channels": [{"channel": "nome", "reason": "motivo", "priority": "alta|media|baixa"}],
  "recommended_regions": [{"region": "nome", "reason": "motivo"}],
  "budget_recommendation": "Faixa de preço recomendada para prospecção",
  "best_approach_time": "Melhor momento/dia para abordar",
  "prospecting_strategies": [{"strategy": "nome", "description": "detalhe", "expected_conversion": "X%"}]
}
          `.trim());
        } catch (e) {
          aiAnalysis = JSON.stringify({
            icp_summary: "Análise IA indisponível — dados locais fornecidos.",
            key_insights: [`${converted.length} leads convertidos de ${all.length} total`],
            recommended_channels: topSources.map(s => ({ channel: s.source, reason: `${s.pct}% das conversões`, priority: "alta" })),
            recommended_regions: topRegions.map(([r]) => ({ region: r, reason: "Alta concentração de conversões" })),
            budget_recommendation: `R$ ${avgBudgetMin.toLocaleString()} - R$ ${avgBudgetMax.toLocaleString()}`,
            best_approach_time: "Terça a Quinta, 10h-12h e 14h-17h",
            prospecting_strategies: [],
          });
        }

        let parsedAi;
        try { parsedAi = JSON.parse(aiAnalysis.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()); }
        catch { parsedAi = { icp_summary: aiAnalysis, key_insights: [], recommended_channels: [], recommended_regions: [], budget_recommendation: "", best_approach_time: "", prospecting_strategies: [] }; }

        result = {
          icp: parsedAi,
          metrics: icpData,
          analyzed_at: new Date().toISOString(),
        };
        break;
      }

      // ── Generate Approach Templates ───────────────────────────────────
      case "generate_approach": {
        const { channel, context, tone } = params;
        // channel: "whatsapp" | "email" | "telefone" | "instagram"
        // context: optional description of the property/empreendimento
        // tone: "formal" | "casual" | "consultivo"

        const prompt = `
Você é um copywriter especialista em mercado imobiliário brasileiro.
Gere 3 templates de mensagem de prospecção ativa para o canal "${channel || "whatsapp"}".

${context ? `Contexto do empreendimento/imóvel: ${context}` : "Imóvel de médio-alto padrão em região metropolitana."}
Tom: ${tone || "consultivo"}

Retorne APENAS um JSON válido (sem markdown) com esta estrutura:
{
  "templates": [
    {
      "title": "Nome do template",
      "message": "Texto completo da mensagem com {nome} como placeholder",
      "follow_up": "Mensagem de follow-up caso não responda",
      "best_for": "Perfil ideal para este template",
      "expected_response_rate": "X%"
    }
  ],
  "tips": ["dica 1", "dica 2"]
}
        `.trim();

        let aiResponse = "";
        try {
          aiResponse = await callGemini(prompt);
        } catch {
          aiResponse = JSON.stringify({
            templates: [{
              title: "Abordagem Consultiva",
              message: `Olá {nome}, tudo bem? Sou corretor(a) e tenho uma oportunidade que pode ser do seu interesse. Posso te contar mais?`,
              follow_up: "Olá {nome}, vi que não conseguimos conversar. Posso agendar um horário melhor?",
              best_for: "Leads qualificados",
              expected_response_rate: "15-25%",
            }],
            tips: ["Personalize com o nome", "Envie em horário comercial"],
          });
        }

        let parsed;
        try { parsed = JSON.parse(aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()); }
        catch { parsed = { templates: [], tips: [aiResponse] }; }

        result = parsed;
        break;
      }

      // ── Create Prospecting Campaign ───────────────────────────────────
      case "create_campaign": {
        const { name, channel, target_source, target_region, target_status, template_message, goal_contacts } = params;
        if (!name) throw new Error("Nome da campanha é obrigatório");

        // Save campaign in automation_logs as a "campaign" record
        const { data: campaign, error } = await supabase.from("commercial_automation_logs").insert({
          tenant_id: tenantId,
          automation_name: "prospector_campaign",
          trigger_event: "manual_create",
          action_type: "create_campaign",
          action_details: {
            name,
            channel: channel || "whatsapp",
            target_source: target_source || null,
            target_region: target_region || null,
            target_status: target_status || "novo",
            template_message: template_message || "",
            goal_contacts: goal_contacts || 50,
            contacts_made: 0,
            responses_received: 0,
            meetings_booked: 0,
            conversions: 0,
            campaign_status: "active",
          },
          status: "active",
          entity_type: "campaign",
          entity_id: crypto.randomUUID(),
        }).select("id, action_details, created_at").maybeSingle();
        if (error) throw error;

        await emitPulse(supabase, tenantId, userId, "campaign_created",
          "Campanha de prospecção criada",
          `Nova campanha: ${name} (${channel || "whatsapp"})`,
          { campaign_id: campaign?.id },
        );

        result = { success: true, campaign };
        break;
      }

      // ── Update Campaign Contact Metrics ───────────────────────────────
      case "update_campaign_contact": {
        const { campaign_id, metric } = params;
        // metric: "contact" | "response" | "meeting" | "conversion"
        if (!campaign_id || !metric) throw new Error("campaign_id e metric obrigatórios");

        // Fetch current campaign
        const { data: log, error: fetchErr } = await supabase.from("commercial_automation_logs")
          .select("id, action_details")
          .eq("id", campaign_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!log) throw new Error("Campanha não encontrada");

        const details = log.action_details as Record<string, unknown>;
        const fieldMap: Record<string, string> = {
          contact: "contacts_made",
          response: "responses_received",
          meeting: "meetings_booked",
          conversion: "conversions",
        };
        const field = fieldMap[metric];
        if (!field) throw new Error("Métrica inválida: " + metric);

        details[field] = ((details[field] as number) || 0) + 1;

        await supabase.from("commercial_automation_logs")
          .update({ action_details: details })
          .eq("id", campaign_id)
          .eq("tenant_id", tenantId);

        result = { success: true, updated: { [field]: details[field] } };
        break;
      }

      // ── Get Campaigns ─────────────────────────────────────────────────
      case "get_campaigns": {
        const { status: campaignStatus } = params;
        let query = supabase.from("commercial_automation_logs")
          .select("id, action_details, status, created_at")
          .eq("tenant_id", tenantId)
          .eq("automation_name", "prospector_campaign")
          .order("created_at", { ascending: false })
          .limit(50);

        if (campaignStatus) {
          query = query.eq("status", campaignStatus);
        }

        const { data: campaigns, error } = await query;
        if (error) throw error;

        result = { campaigns: campaigns || [] };
        break;
      }

      // ── Get Dashboard ─────────────────────────────────────────────────
      case "get_dashboard": {
        // Lead funnel stats
        const { data: leads } = await supabase
          .from("leads")
          .select("id, status, source, created_at, lead_score")
          .eq("tenant_id", tenantId)
          .limit(1000);

        const all = leads || [];
        const statusCounts: Record<string, number> = {};
        const sourceCounts: Record<string, number> = {};
        const last30Days = new Date(); last30Days.setDate(last30Days.getDate() - 30);
        let newLast30 = 0;

        for (const l of all) {
          statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
          sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1;
          if (new Date(l.created_at) >= last30Days) newLast30++;
        }

        // Campaign metrics
        const { data: campaigns } = await supabase.from("commercial_automation_logs")
          .select("id, action_details, status, created_at")
          .eq("tenant_id", tenantId)
          .eq("automation_name", "prospector_campaign")
          .order("created_at", { ascending: false })
          .limit(20);

        let totalContacts = 0, totalResponses = 0, totalMeetings = 0, totalConversions = 0;
        const activeCampaigns = (campaigns || []).filter(c => c.status === "active");

        for (const c of campaigns || []) {
          const d = c.action_details as Record<string, number>;
          totalContacts += d.contacts_made || 0;
          totalResponses += d.responses_received || 0;
          totalMeetings += d.meetings_booked || 0;
          totalConversions += d.conversions || 0;
        }

        const conversionRate = all.length > 0 ? Math.round(((statusCounts["convertido"] || 0) / all.length) * 100) : 0;
        const responseRate = totalContacts > 0 ? Math.round((totalResponses / totalContacts) * 100) : 0;

        result = {
          funnel: {
            total: all.length,
            novo: statusCounts["novo"] || 0,
            contatado: statusCounts["contatado"] || 0,
            qualificado: statusCounts["qualificado"] || 0,
            visita_agendada: statusCounts["visita_agendada"] || 0,
            proposta: statusCounts["proposta"] || 0,
            convertido: statusCounts["convertido"] || 0,
            perdido: statusCounts["perdido"] || 0,
          },
          by_source: Object.entries(sourceCounts).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
          new_leads_30d: newLast30,
          conversion_rate: conversionRate,
          campaigns: {
            total: (campaigns || []).length,
            active: activeCampaigns.length,
            total_contacts: totalContacts,
            total_responses: totalResponses,
            total_meetings: totalMeetings,
            total_conversions: totalConversions,
            response_rate: responseRate,
          },
        };
        break;
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[commercial-prospector-ai]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
