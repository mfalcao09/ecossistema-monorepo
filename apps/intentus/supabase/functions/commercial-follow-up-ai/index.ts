import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const PROD_ORIGINS = [
  "https://app.intentusrealestate.com.br",
  "https://intentus-plataform.vercel.app",
];

const DEV_ORIGIN_REGEX =
  /^https?:\/\/(localhost|127\.0\.0\.1|intentus-plataform-.+\.vercel\.app)/;

function corsHeaders(origin?: string) {
  const allowedOrigin = origin && (PROD_ORIGINS.includes(origin) || DEV_ORIGIN_REGEX.test(origin)) ? origin : PROD_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

interface FollowUpRecommendation {
  optimal_timing: string;
  recommended_channel: "whatsapp" | "email" | "phone" | "visit";
  message_template: string;
  talking_points: string[];
  risk_assessment: string;
  confidence_score: number;
}

interface DealWithFollowUp {
  id: string;
  deal_name: string;
  person_id: string;
  person_name: string;
  assigned_to: string;
  status: string;
  proposed_value: number;
  last_contact_at: string | null;
  interaction_count: number;
  days_in_stage: number;
}

interface FollowUpDashboardData {
  deals_no_contact_3d: number;
  deals_no_contact_7d: number;
  deals_no_contact_14d_plus: number;
  followups_executed_today: number;
  success_rate: number;
  overdue_followups: number;
}

interface FollowUpPlan {
  delay_days: number;
  channel: "whatsapp" | "email" | "phone" | "visit";
  message: string;
  priority: "critical" | "high" | "normal" | "low";
}

interface FollowUpLogInsert {
  tenant_id: string;
  lead_id?: string | null;
  person_id?: string | null;
  trigger_event: string;
  action_type: string;
  action_taken: string;
  status: "agendado" | "executado" | "falha" | "cancelado" | "pendente";
  scheduled_for?: string;
  notes?: string;
}

async function resolveAuth(req: Request, supabase: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(authHeader.slice(7));
  if (userError || !user) {
    throw new Error("Invalid authentication token");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, user_id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile?.tenant_id) throw new Error("User has no tenant");

  return { user, tenantId: profile.tenant_id };
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return ""; // Return empty to trigger fallback
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://app.intentusrealestate.com.br",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        response_format: { type: "json_object" },
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`AI API error: ${response.status}`);
      return "";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.error("AI call failed:", err);
    return "";
  }
}

function getFollowUpUrgencyScore(deal: DealWithFollowUp): number {
  let score = 50;

  // Days since last contact (0-40 points)
  const daysSinceContact = deal.last_contact_at
    ? Math.floor(
        (Date.now() - new Date(deal.last_contact_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 30;

  if (daysSinceContact <= 1) score += 5;
  else if (daysSinceContact <= 3) score += 15;
  else if (daysSinceContact <= 7) score += 25;
  else if (daysSinceContact <= 14) score += 35;
  else score += 40;

  // Deal value (0-30 points)
  const normalizedValue = Math.min(deal.proposed_value / 100000, 1);
  score += normalizedValue * 30;

  // Interaction count (0-20 points)
  if (deal.interaction_count >= 5) score += 20;
  else if (deal.interaction_count >= 3) score += 15;
  else if (deal.interaction_count >= 1) score += 10;

  // Days in stage (0-10 points)
  if (deal.days_in_stage >= 14) score += 10;
  else if (deal.days_in_stage >= 7) score += 5;

  return Math.min(score, 100);
}

function getFollowUpChannel(daysInStage: number, interactionCount: number): "whatsapp" | "email" | "phone" | "visit" {
  if (interactionCount === 0) return "whatsapp";
  if (daysInStage >= 7) return "phone";
  if (interactionCount >= 3) return "visit";
  return "email";
}

function generateFollowUpRecommendation(deal: DealWithFollowUp): FollowUpRecommendation {
  const urgencyScore = getFollowUpUrgencyScore(deal);
  const channel = getFollowUpChannel(deal.days_in_stage, deal.interaction_count);

  const urgencyLevel = urgencyScore >= 75 ? "crítica" : urgencyScore >= 50 ? "alta" : "normal";

  const messages = {
    whatsapp: `Oi ${deal.person_name}! 👋 Tudo bem? Queria acompanhar sobre a oportunidade que conversamos. Qual melhor horário para uma ligação rápida?`,
    email: `Olá ${deal.person_name},\n\nGostaria de compartilhar algumas atualizações sobre o imóvel que analisamos. Podemos agendar uma chamada?`,
    phone: `Contato direto via telefone para acompanhar proposta e esclarecimentos finais sobre ${deal.deal_name}.`,
    visit: `Agendar visita presencial para discutir detalhes e próximos passos.`,
  };

  const talkingPoints = [
    `Acompanhar interesse em ${deal.deal_name}`,
    `Esclarecer dúvidas sobre a proposta`,
    "Discutir próximos passos",
    `Reiterar disponibilidade de suporte`,
  ];

  const riskMessage =
    urgencyScore >= 75
      ? "CRÍTICO: Alto risco de perder o negócio sem ação imediata"
      : urgencyScore >= 50
        ? "ALTO: Sem contato recente, recomenda-se acompanhamento"
        : "NORMAL: Acompanhamento recomendado";

  return {
    optimal_timing:
      channel === "phone" ? "terça-feira 10:00" : channel === "visit" ? "quinta-feira 14:00" : "quarta-feira 09:00",
    recommended_channel: channel,
    message_template: messages[channel],
    talking_points: talkingPoints,
    risk_assessment: riskMessage,
    confidence_score: Math.floor(urgencyScore),
  };
}

async function handleAnalyzeDeal(supabase: any, dealId: string, tenantId: string) {
  // Fetch deal
  const { data: deal, error: dealError } = await supabase
    .from("deal_requests")
    .select("id, title, person_id, assigned_to, status, proposed_value, updated_at")
    .eq("id", dealId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (dealError || !deal) {
    return { error: "Deal not found" };
  }

  // Fetch person
  const { data: person } = await supabase
    .from("people")
    .select("id, name")
    .eq("id", deal.person_id)
    .maybeSingle();

  // Fetch interactions count and last contact
  const { data: interactions = [] } = await supabase
    .from("interactions")
    .select("id, interaction_date")
    .eq("person_id", deal.person_id)
    .eq("tenant_id", tenantId)
    .order("interaction_date", { ascending: false })
    .limit(10);

  const lastContactAt =
    interactions.length > 0 ? interactions[0].interaction_date : deal.updated_at;
  const daysInStage = Math.floor(
    (Date.now() - new Date(lastContactAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const dealForAnalysis: DealWithFollowUp = {
    id: deal.id,
    deal_name: deal.title,
    person_id: deal.person_id,
    person_name: person?.name || "Cliente",
    assigned_to: deal.assigned_to,
    status: deal.status,
    proposed_value: deal.proposed_value || 0,
    last_contact_at: lastContactAt,
    interaction_count: interactions.length,
    days_in_stage: daysInStage,
  };

  // Try AI first, fallback to rule-based
  let recommendation = generateFollowUpRecommendation(dealForAnalysis);

  const systemPrompt = `Você é um especialista em vendas imobiliárias e CRM. Analise o seguinte contexto de negócio e forneça recomendações de follow-up em JSON.`;
  const userPrompt = `
Negócio: ${dealForAnalysis.deal_name}
Cliente: ${dealForAnalysis.person_name}
Valor: R$ ${dealForAnalysis.proposed_value.toLocaleString("pt-BR")}
Estágio: ${dealForAnalysis.status}
Dias sem contato: ${dealForAnalysis.days_in_stage}
Interações: ${dealForAnalysis.interaction_count}

Forneça uma resposta JSON com: optimal_timing (melhor dia/hora), recommended_channel (whatsapp|email|phone|visit), message_template (rascunho personalizad), talking_points (lista de tópicos), risk_assessment (avaliação de risco), confidence_score (0-100).
  `;

  const aiResponse = await callAI(systemPrompt, userPrompt);
  if (aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse);
      recommendation = {
        optimal_timing: parsed.optimal_timing || recommendation.optimal_timing,
        recommended_channel: parsed.recommended_channel || recommendation.recommended_channel,
        message_template: parsed.message_template || recommendation.message_template,
        talking_points: parsed.talking_points || recommendation.talking_points,
        risk_assessment: parsed.risk_assessment || recommendation.risk_assessment,
        confidence_score: parsed.confidence_score || recommendation.confidence_score,
      };
    } catch {
      // Keep fallback recommendation
    }
  }

  return {
    deal_id: dealId,
    recommendation,
    deal_info: dealForAnalysis,
  };
}

async function handleScheduleFollowUps(
  supabase: any,
  dealId: string,
  tenantId: string,
  followUps: FollowUpPlan[]
) {
  const { data: deal } = await supabase
    .from("deal_requests")
    .select("id, person_id, assigned_to")
    .eq("id", dealId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!deal) return { error: "Deal not found" };

  const logs: FollowUpLogInsert[] = followUps.map((fu) => ({
    tenant_id: tenantId,
    person_id: deal.person_id,
    trigger_event: "follow_up_scheduled",
    action_type: `followup_${fu.channel}`,
    action_taken: fu.message,
    status: "agendado" as const,
    scheduled_for: new Date(Date.now() + fu.delay_days * 24 * 60 * 60 * 1000).toISOString(),
    notes: `Priority: ${fu.priority}`,
  }));

  const { data: inserted, error } = await supabase
    .from("commercial_automation_logs")
    .insert(logs)
    .select();

  if (error) return { error: error.message };

  return {
    scheduled: inserted?.length || 0,
    logs: inserted,
  };
}

async function handleGetDashboard(supabase: any, tenantId: string) {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Deals without contact in different timeframes
  const { data: all_deals = [] } = await supabase
    .from("deal_requests")
    .select(
      "id, updated_at, proposed_value",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId)
    .in("status", ["rascunho", "enviado_juridico", "em_analise", "elaboracao_validacao", "aprovado"])
    .limit(500);

  const dealsNoContact3d = all_deals.filter(
    (d: any) => new Date(d.updated_at) < threeDaysAgo
  ).length;
  const dealsNoContact7d = all_deals.filter(
    (d: any) => new Date(d.updated_at) < sevenDaysAgo
  ).length;
  const dealsNoContact14dPlus = all_deals.filter(
    (d: any) => new Date(d.updated_at) < fourteenDaysAgo
  ).length;

  // Follow-ups executed today
  const { data: logsToday = [], error: logsError } = await supabase
    .from("commercial_automation_logs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "executado")
    .gte("created_at", now.toISOString().split("T")[0]);

  // Overdue follow-ups
  const { data: overdueFollowUps = [] } = await supabase
    .from("commercial_automation_logs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "agendado")
    .lt("scheduled_for", now.toISOString());

  const dashboard: FollowUpDashboardData = {
    deals_no_contact_3d: dealsNoContact3d,
    deals_no_contact_7d: dealsNoContact7d,
    deals_no_contact_14d_plus: dealsNoContact14dPlus,
    followups_executed_today: logsToday.length,
    success_rate: 0.75, // Placeholder: would calculate from actual conversion data
    overdue_followups: overdueFollowUps.length,
  };

  return dashboard;
}

async function handleBatchAnalyze(supabase: any, tenantId: string, limit: number = 20) {
  const { data: deals = [] } = await supabase
    .from("deal_requests")
    .select(
      "id, title, person_id, assigned_to, status, proposed_value, updated_at"
    )
    .eq("tenant_id", tenantId)
    .in("status", [
      "rascunho",
      "enviado_juridico",
      "em_analise",
      "elaboracao_validacao",
      "aprovado",
    ])
    .limit(500);

  // Fetch interactions for each deal
  const dealsWithScore = await Promise.all(
    deals.map(async (deal: any) => {
      const { data: interactions = [] } = await supabase
        .from("interactions")
        .select("id, interaction_date")
        .eq("person_id", deal.person_id)
        .eq("tenant_id", tenantId)
        .order("interaction_date", { ascending: false })
        .limit(10);

      const lastContactAt =
        interactions.length > 0 ? interactions[0].interaction_date : deal.updated_at;
      const daysInStage = Math.floor(
        (Date.now() - new Date(lastContactAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      const dealData: DealWithFollowUp = {
        id: deal.id,
        deal_name: deal.title,
        person_id: deal.person_id,
        person_name: "", // Will be fetched separately if needed
        assigned_to: deal.assigned_to,
        status: deal.status,
        proposed_value: deal.proposed_value || 0,
        last_contact_at: lastContactAt,
        interaction_count: interactions.length,
        days_in_stage: daysInStage,
      };

      const urgencyScore = getFollowUpUrgencyScore(dealData);
      return {
        ...dealData,
        urgency_score: urgencyScore,
        recommended_channel: getFollowUpChannel(daysInStage, interactions.length),
      };
    })
  );

  // Sort by urgency and return top N
  const sorted = dealsWithScore.sort((a, b) => b.urgency_score - a.urgency_score);

  return {
    total_analyzed: sorted.length,
    top_deals: sorted.slice(0, limit),
    summary: {
      critical: sorted.filter((d) => d.urgency_score >= 75).length,
      high: sorted.filter((d) => d.urgency_score >= 50 && d.urgency_score < 75).length,
      normal: sorted.filter((d) => d.urgency_score < 50).length,
    },
  };
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin") || "";
    return new Response(null, { headers: corsHeaders(origin) });
  }

  try {
    const origin = req.headers.get("origin") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || ""
    );

    const { user, tenantId } = await resolveAuth(req, supabase);

    let body = {};
    if (req.method === "POST") {
      body = await req.json();
    }

    const { action, ...params } = body as any;

    let result: any = {};

    switch (action) {
      case "analyze_deal":
        result = await handleAnalyzeDeal(supabase, params.deal_id, tenantId);
        break;

      case "schedule_followups":
        result = await handleScheduleFollowUps(
          supabase,
          params.deal_id,
          tenantId,
          params.follow_ups || []
        );
        break;

      case "get_dashboard":
        result = await handleGetDashboard(supabase, tenantId);
        break;

      case "batch_analyze":
        result = await handleBatchAnalyze(supabase, tenantId, params.limit || 20);
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Function error:", error);
    const origin = new URL(Deno.env.get("SUPABASE_URL") || "").hostname;
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      }
    );
  }
});
