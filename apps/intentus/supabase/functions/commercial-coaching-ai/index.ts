/**
 * commercial-coaching-ai v1
 * Coaching IA dedicado para corretores — planos de desenvolvimento,
 * sessões 1:1 com prep automático, skill assessments, action items.
 *
 * 7 actions:
 *   - assess_broker_skills:     Avaliação IA de skills do corretor
 *   - generate_coaching_plan:   Plano de desenvolvimento personalizado
 *   - prep_session:             Preparação IA para sessão 1:1
 *   - save_session:             Salvar sessão completa + action items
 *   - get_broker_development:   Histórico de evolução do corretor
 *   - get_team_overview:        Visão geral de coaching do time
 *   - update_action_item:       Atualizar status de action item
 *
 * Self-contained: inline CORS, auth/tenant, Gemini 2.5 Flash via OpenRouter.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Sem empresa vinculada");
  return { tenantId: profile.tenant_id, userId: user.id, admin };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<any> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return null;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://app.intentusrealestate.com.br",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    console.error("[coaching-ai] AI error:", res.status, await res.text());
    return null;
  }

  const result = await res.json();
  const content = result.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch { /* fall through */ }
    }
    console.error("[coaching-ai] Failed to parse AI response");
    return null;
  }
}

// ─── Data fetchers ───────────────────────────────────────────────────────────
type Admin = ReturnType<typeof createClient>;

async function fetchBrokerData(admin: Admin, tenantId: string, brokerId: string) {
  const since90d = new Date(Date.now() - 90 * 86400000).toISOString();

  const [interactionsRes, dealsRes, profileRes, sentimentsRes, leadsRes] = await Promise.all([
    admin.from("interactions")
      .select("id, person_id, user_id, interaction_type, notes, created_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", brokerId)
      .gte("created_at", since90d)
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("deal_requests")
      .select("id, deal_type, status, proposed_value, proposed_monthly_value, assigned_to, created_at, updated_at, lost_reason")
      .eq("tenant_id", tenantId)
      .eq("assigned_to", brokerId)
      .gte("created_at", since90d),
    admin.from("profiles")
      .select("user_id, name, avatar_url, role")
      .eq("user_id", brokerId)
      .maybeSingle(),
    admin.from("interaction_sentiments")
      .select("interaction_id, sentiment, score, quality_score, objections_detected, key_topics")
      .eq("tenant_id", tenantId)
      .gte("created_at", since90d)
      .limit(200),
    admin.from("leads")
      .select("id, name, status, person_id, last_contact_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since90d)
      .limit(100),
  ]);

  const interactions = interactionsRes.data || [];
  const deals = dealsRes.data || [];
  const profile = profileRes.data;
  const sentiments = sentimentsRes.data || [];
  const leads = leadsRes.data || [];

  // Map sentiments to broker's interactions
  const sentimentMap = new Map(sentiments.map((s: any) => [s.interaction_id, s]));
  const brokerSentiments = interactions
    .filter((i: any) => sentimentMap.has(i.id))
    .map((i: any) => ({ ...i, sentiment: sentimentMap.get(i.id) }));

  // Compute metrics
  const totalInteractions = interactions.length;
  const dealsWon = deals.filter((d: any) => d.status === "fechado" || d.status === "won").length;
  const dealsLost = deals.filter((d: any) => d.status === "perdido" || d.status === "lost").length;
  const totalDeals = dealsWon + dealsLost;
  const winRate = totalDeals > 0 ? Math.round((dealsWon / totalDeals) * 100) : 0;
  const totalRevenue = deals
    .filter((d: any) => d.status === "fechado" || d.status === "won")
    .reduce((sum: number, d: any) => sum + (d.proposed_value || 0), 0);
  const avgSentiment = brokerSentiments.length > 0
    ? Math.round(brokerSentiments.reduce((s: number, i: any) => s + (i.sentiment?.score || 0), 0) / brokerSentiments.length)
    : 0;
  const avgQuality = brokerSentiments.length > 0
    ? Math.round(brokerSentiments.reduce((s: number, i: any) => s + (i.sentiment?.quality_score || 50), 0) / brokerSentiments.length)
    : 50;

  // Channel breakdown
  const channels: Record<string, number> = {};
  for (const i of interactions) {
    channels[(i as any).interaction_type] = (channels[(i as any).interaction_type] || 0) + 1;
  }

  // Objections
  const allObjections: string[] = [];
  for (const s of brokerSentiments) {
    if (s.sentiment?.objections_detected) {
      allObjections.push(...s.sentiment.objections_detected);
    }
  }

  // Weekly activity (last 4 weeks)
  const weeklyActivity: number[] = [0, 0, 0, 0];
  const now = Date.now();
  for (const i of interactions) {
    const age = Math.floor((now - new Date((i as any).created_at).getTime()) / (7 * 86400000));
    if (age < 4) weeklyActivity[age]++;
  }

  return {
    profile,
    metrics: {
      totalInteractions,
      dealsWon,
      dealsLost,
      winRate,
      totalRevenue,
      avgSentiment,
      avgQuality,
      channels,
      weeklyActivity: weeklyActivity.reverse(),
      objectionsFrequent: [...new Set(allObjections)].slice(0, 10),
      activeleads: leads.filter((l: any) => l.status === "ativo" || l.status === "novo").length,
      coldLeads: leads.filter((l: any) => {
        if (!l.last_contact_at) return true;
        return (now - new Date(l.last_contact_at).getTime()) > 14 * 86400000;
      }).length,
    },
    recentInteractions: interactions.slice(0, 20).map((i: any) => ({
      type: i.interaction_type,
      notes: (i.notes || "").slice(0, 200),
      date: i.created_at,
      sentiment: sentimentMap.get(i.id),
    })),
    recentDeals: deals.slice(0, 15).map((d: any) => ({
      status: d.status,
      value: d.proposed_value,
      lostReason: d.lost_reason,
      date: d.created_at,
    })),
  };
}

async function fetchAllBrokersMetrics(admin: Admin, tenantId: string) {
  const { data: brokers } = await admin
    .from("profiles")
    .select("user_id, name, avatar_url, role")
    .eq("tenant_id", tenantId)
    .in("role", ["corretor", "broker", "agent"]);

  if (!brokers || brokers.length === 0) {
    // Fallback: get all non-admin users
    const { data: allProfiles } = await admin
      .from("profiles")
      .select("user_id, name, avatar_url, role")
      .eq("tenant_id", tenantId)
      .not("role", "in", '("admin","superadmin")');
    return allProfiles || [];
  }
  return brokers;
}

// ─── AI System Prompts ───────────────────────────────────────────────────────
const SKILL_ASSESSMENT_PROMPT = `Você é um coach de vendas imobiliárias brasileiro especialista.
Analise os dados de performance do corretor e avalie suas habilidades em 8 dimensões:

1. communication (Comunicação) — qualidade das interações, tom, clareza
2. negotiation (Negociação) — taxa de fechamento, gestão de objeções
3. prospecting (Prospecção) — volume e qualidade de novos leads
4. closing (Fechamento) — conversão, velocidade de ciclo
5. follow_up (Follow-up) — consistência, cadência, leads frios
6. product_knowledge (Conhecimento do Produto) — profundidade técnica
7. time_management (Gestão do Tempo) — distribuição de atividades
8. relationship (Relacionamento) — sentimento dos clientes, fidelização

Para cada skill retorne: score (0-100), level (beginner/intermediate/advanced/expert), evidence (string com justificativa baseada nos dados).

Retorne JSON:
{
  "skills": {
    "communication": { "score": N, "level": "...", "evidence": "..." },
    ...
  },
  "overall_score": N,
  "strengths": ["skill1", "skill2"],
  "improvement_areas": ["skill3", "skill4"],
  "personality_profile": "string com perfil comportamental",
  "development_priority": "string com recomendação principal"
}`;

const COACHING_PLAN_PROMPT = `Você é um diretor de vendas imobiliárias brasileiro criando plano de coaching.
Com base na avaliação de skills e dados históricos, crie um plano de desenvolvimento personalizado.

Retorne JSON:
{
  "title": "string — título do plano",
  "duration_weeks": N,
  "focus_areas": ["area1", "area2"],
  "objectives": [
    {
      "objective": "string",
      "metric": "string — KPI mensurável",
      "target_value": "string",
      "current_value": "string",
      "deadline_weeks": N
    }
  ],
  "weekly_actions": [
    {
      "week": N,
      "theme": "string",
      "actions": [
        { "description": "string", "category": "string", "priority": "high|medium|low" }
      ]
    }
  ],
  "recommended_resources": ["string"],
  "success_criteria": "string",
  "risk_factors": ["string"]
}`;

const SESSION_PREP_PROMPT = `Você é um gestor de vendas imobiliárias preparando uma sessão de coaching 1:1.
Com base nos dados do corretor, plano de coaching e sessões anteriores, prepare um roteiro.

Retorne JSON:
{
  "agenda": [
    { "topic": "string", "duration_minutes": N, "talking_points": ["string"], "questions_to_ask": ["string"] }
  ],
  "metrics_review": {
    "highlights": ["string — o que melhorou"],
    "concerns": ["string — o que precisa atenção"],
    "comparison_to_last": "string"
  },
  "action_items_review": [
    { "description": "string", "status": "string", "follow_up": "string" }
  ],
  "coaching_moments": [
    { "situation": "string — situação real do corretor", "technique": "string — técnica de coaching", "script": "string — exemplo de como abordar" }
  ],
  "recognition_points": ["string — conquistas para reconhecer"],
  "development_focus": "string — tema principal da sessão",
  "estimated_duration_minutes": N
}`;

// ─── Actions ─────────────────────────────────────────────────────────────────

async function assessBrokerSkills(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  brokerId: string,
) {
  const data = await fetchBrokerData(admin, tenantId, brokerId);
  if (!data.profile) return json(req, { error: "Corretor não encontrado" }, 404);

  const userPrompt = `Dados do corretor ${data.profile.name}:

MÉTRICAS (últimos 90 dias):
- Interações: ${data.metrics.totalInteractions}
- Deals ganhos: ${data.metrics.dealsWon}, perdidos: ${data.metrics.dealsLost}
- Win rate: ${data.metrics.winRate}%
- Receita total: R$ ${data.metrics.totalRevenue.toLocaleString("pt-BR")}
- Sentimento médio: ${data.metrics.avgSentiment}/100
- Qualidade média: ${data.metrics.avgQuality}/100
- Leads ativos: ${data.metrics.activeleads}, frios: ${data.metrics.coldLeads}
- Canais: ${JSON.stringify(data.metrics.channels)}
- Atividade semanal (últimas 4 semanas): ${data.metrics.weeklyActivity.join(", ")}
- Objeções frequentes: ${data.metrics.objectionsFrequent.join(", ") || "nenhuma registrada"}

INTERAÇÕES RECENTES:
${data.recentInteractions.map((i: any) => `[${i.type}] ${i.date} — ${i.notes} ${i.sentiment ? `(sentimento: ${i.sentiment.sentiment}, score: ${i.sentiment.score})` : ""}`).join("\n")}

DEALS RECENTES:
${data.recentDeals.map((d: any) => `[${d.status}] R$ ${(d.value || 0).toLocaleString("pt-BR")} ${d.lostReason ? `— Motivo perda: ${d.lostReason}` : ""}`).join("\n")}`;

  let assessment = await callGemini(SKILL_ASSESSMENT_PROMPT, userPrompt);

  if (!assessment) {
    // Fallback rule-based
    const wR = data.metrics.winRate;
    const q = data.metrics.avgQuality;
    const s = data.metrics.avgSentiment;
    const vol = Math.min(data.metrics.totalInteractions, 100);
    assessment = {
      skills: {
        communication: { score: Math.min(q, 100), level: q > 70 ? "advanced" : q > 40 ? "intermediate" : "beginner", evidence: "Baseado na qualidade média das interações" },
        negotiation: { score: wR, level: wR > 60 ? "advanced" : wR > 30 ? "intermediate" : "beginner", evidence: "Baseado na taxa de conversão" },
        prospecting: { score: Math.min(vol, 100), level: vol > 60 ? "advanced" : vol > 30 ? "intermediate" : "beginner", evidence: "Baseado no volume de interações" },
        closing: { score: wR, level: wR > 60 ? "advanced" : wR > 30 ? "intermediate" : "beginner", evidence: "Baseado em deals fechados vs perdidos" },
        follow_up: { score: data.metrics.coldLeads > 5 ? 30 : 70, level: data.metrics.coldLeads > 5 ? "beginner" : "intermediate", evidence: "Baseado em leads frios" },
        product_knowledge: { score: 50, level: "intermediate", evidence: "Sem dados suficientes para avaliação precisa" },
        time_management: { score: Math.min(vol * 1.5, 100), level: vol > 40 ? "intermediate" : "beginner", evidence: "Baseado na distribuição de atividades" },
        relationship: { score: Math.max(s + 50, 0), level: s > 20 ? "advanced" : s > -10 ? "intermediate" : "beginner", evidence: "Baseado no sentimento médio dos clientes" },
      },
      overall_score: Math.round((wR + q + Math.max(s + 50, 0) + Math.min(vol, 100)) / 4),
      strengths: wR > 50 ? ["negotiation", "closing"] : ["prospecting"],
      improvement_areas: data.metrics.coldLeads > 5 ? ["follow_up", "time_management"] : ["closing", "negotiation"],
      personality_profile: "Perfil baseado em dados limitados — recomenda-se avaliação presencial",
      development_priority: wR < 30 ? "Foco em técnicas de fechamento e gestão de objeções" : "Manter consistência e expandir prospecção",
    };
  }

  // Persist assessment
  await admin.from("broker_skill_assessments").insert({
    tenant_id: tenantId,
    broker_id: brokerId,
    assessed_by: userId,
    assessment_type: "ai",
    skills: assessment.skills,
    overall_score: assessment.overall_score,
    strengths: assessment.strengths,
    improvement_areas: assessment.improvement_areas,
    ai_analysis: {
      personality_profile: assessment.personality_profile,
      development_priority: assessment.development_priority,
    },
    period_start: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
  });

  return json(req, {
    broker: { name: data.profile.name, avatar_url: data.profile.avatar_url },
    assessment,
    metrics: data.metrics,
  });
}

async function generateCoachingPlan(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  brokerId: string,
) {
  // Get latest assessment
  const { data: latestAssessment } = await admin
    .from("broker_skill_assessments")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("broker_id", brokerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const brokerData = await fetchBrokerData(admin, tenantId, brokerId);
  if (!brokerData.profile) return json(req, { error: "Corretor não encontrado" }, 404);

  const userPrompt = `Corretor: ${brokerData.profile.name}

AVALIAÇÃO DE SKILLS:
${latestAssessment ? JSON.stringify(latestAssessment.skills, null, 2) : "Nenhuma avaliação disponível"}
Overall score: ${latestAssessment?.overall_score || "N/A"}
Pontos fortes: ${latestAssessment?.strengths?.join(", ") || "N/A"}
Áreas de melhoria: ${latestAssessment?.improvement_areas?.join(", ") || "N/A"}

MÉTRICAS ATUAIS:
- Win rate: ${brokerData.metrics.winRate}%
- Interações/90d: ${brokerData.metrics.totalInteractions}
- Receita: R$ ${brokerData.metrics.totalRevenue.toLocaleString("pt-BR")}
- Sentimento médio: ${brokerData.metrics.avgSentiment}
- Leads frios: ${brokerData.metrics.coldLeads}

DEALS RECENTES:
${brokerData.recentDeals.map((d: any) => `[${d.status}] R$ ${(d.value || 0).toLocaleString("pt-BR")} ${d.lostReason ? `— ${d.lostReason}` : ""}`).join("\n")}`;

  let plan = await callGemini(COACHING_PLAN_PROMPT, userPrompt);

  if (!plan) {
    // Fallback
    const weakAreas = latestAssessment?.improvement_areas || ["closing", "follow_up"];
    plan = {
      title: `Plano de Desenvolvimento — ${brokerData.profile.name}`,
      duration_weeks: 8,
      focus_areas: weakAreas,
      objectives: weakAreas.map((area: string) => ({
        objective: `Melhorar ${area}`,
        metric: area === "closing" ? "Win rate" : "Leads frios",
        target_value: area === "closing" ? "50%" : "< 3",
        current_value: area === "closing" ? `${brokerData.metrics.winRate}%` : `${brokerData.metrics.coldLeads}`,
        deadline_weeks: 8,
      })),
      weekly_actions: [
        { week: 1, theme: "Diagnóstico", actions: [{ description: "Revisão de todos os deals perdidos", category: "general", priority: "high" }] },
        { week: 2, theme: "Fundamentos", actions: [{ description: "Treinar técnicas de rapport", category: "communication", priority: "high" }] },
      ],
      recommended_resources: ["Treinamento interno de objeções", "Shadowing com top performer"],
      success_criteria: "Atingir objetivos dentro do prazo com melhoria mensurável",
      risk_factors: ["Baixo engajamento", "Carga de trabalho excessiva"],
    };
  }

  // Persist plan
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + (plan.duration_weeks || 8) * 7);

  const { data: savedPlan } = await admin.from("coaching_plans").insert({
    tenant_id: tenantId,
    broker_id: brokerId,
    created_by: userId,
    title: plan.title,
    status: "active",
    focus_areas: plan.focus_areas,
    objectives: plan.objectives,
    ai_recommendations: {
      weekly_actions: plan.weekly_actions,
      recommended_resources: plan.recommended_resources,
      success_criteria: plan.success_criteria,
      risk_factors: plan.risk_factors,
    },
    target_metrics: plan.objectives?.reduce((acc: any, obj: any) => {
      acc[obj.metric] = { target: obj.target_value, current: obj.current_value };
      return acc;
    }, {}),
    target_completion: targetDate.toISOString().slice(0, 10),
  }).select().maybeSingle();

  // Create initial action items from week 1
  if (savedPlan && plan.weekly_actions?.[0]?.actions) {
    const items = plan.weekly_actions[0].actions.map((a: any) => ({
      tenant_id: tenantId,
      plan_id: savedPlan.id,
      broker_id: brokerId,
      description: a.description,
      category: a.category || "general",
      priority: a.priority || "medium",
      status: "pending",
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    }));
    await admin.from("coaching_action_items").insert(items);
  }

  return json(req, { plan: { ...plan, id: savedPlan?.id }, broker: brokerData.profile.name });
}

async function prepSession(
  req: Request,
  admin: Admin,
  tenantId: string,
  brokerId: string,
  sessionId?: string,
) {
  const brokerData = await fetchBrokerData(admin, tenantId, brokerId);
  if (!brokerData.profile) return json(req, { error: "Corretor não encontrado" }, 404);

  // Get active plan
  const { data: activePlan } = await admin
    .from("coaching_plans")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("broker_id", brokerId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get pending action items
  const { data: pendingItems } = await admin
    .from("coaching_action_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("broker_id", brokerId)
    .in("status", ["pending", "in_progress"])
    .order("due_date", { ascending: true })
    .limit(10);

  // Get last session
  const { data: lastSession } = await admin
    .from("coaching_sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("broker_id", brokerId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get latest assessment
  const { data: latestAssessment } = await admin
    .from("broker_skill_assessments")
    .select("skills, overall_score, strengths, improvement_areas")
    .eq("tenant_id", tenantId)
    .eq("broker_id", brokerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const userPrompt = `Preparação para sessão de coaching 1:1 com ${brokerData.profile.name}:

MÉTRICAS ATUAIS:
- Interações (90d): ${brokerData.metrics.totalInteractions}
- Win rate: ${brokerData.metrics.winRate}%
- Receita: R$ ${brokerData.metrics.totalRevenue.toLocaleString("pt-BR")}
- Sentimento médio: ${brokerData.metrics.avgSentiment}
- Qualidade média: ${brokerData.metrics.avgQuality}
- Leads ativos: ${brokerData.metrics.activeleads}, frios: ${brokerData.metrics.coldLeads}
- Atividade semanal: ${brokerData.metrics.weeklyActivity.join(", ")}

PLANO ATIVO:
${activePlan ? `"${activePlan.title}" — Foco: ${activePlan.focus_areas?.join(", ")}
Objetivos: ${JSON.stringify(activePlan.objectives)}` : "Nenhum plano ativo"}

ACTION ITEMS PENDENTES:
${(pendingItems || []).map((i: any) => `- [${i.priority}] ${i.description} (prazo: ${i.due_date || "sem prazo"}, status: ${i.status})`).join("\n") || "Nenhum"}

ÚLTIMA SESSÃO:
${lastSession ? `Data: ${lastSession.completed_at}
Tópicos: ${lastSession.topics_discussed?.join(", ")}
Takeaways: ${lastSession.key_takeaways?.join(", ")}
Nota coach: ${lastSession.coach_rating}/5` : "Primeira sessão"}

AVALIAÇÃO DE SKILLS:
${latestAssessment ? `Score: ${latestAssessment.overall_score}
Fortes: ${latestAssessment.strengths?.join(", ")}
Melhorar: ${latestAssessment.improvement_areas?.join(", ")}` : "Sem avaliação"}

INTERAÇÕES RECENTES:
${brokerData.recentInteractions.slice(0, 10).map((i: any) => `[${i.type}] ${i.notes}`).join("\n")}`;

  let prep = await callGemini(SESSION_PREP_PROMPT, userPrompt);

  if (!prep) {
    prep = {
      agenda: [
        { topic: "Check-in e rapport", duration_minutes: 5, talking_points: ["Como você está?", "Como foi a semana?"], questions_to_ask: ["O que foi mais desafiador?"] },
        { topic: "Revisão de métricas", duration_minutes: 10, talking_points: [`Win rate atual: ${brokerData.metrics.winRate}%`, `Interações: ${brokerData.metrics.totalInteractions}`], questions_to_ask: ["O que você acha desses números?"] },
        { topic: "Action items pendentes", duration_minutes: 10, talking_points: (pendingItems || []).map((i: any) => i.description), questions_to_ask: ["Quais desafios você encontrou?"] },
        { topic: "Desenvolvimento", duration_minutes: 15, talking_points: ["Foco em áreas de melhoria"], questions_to_ask: ["Como posso te ajudar mais?"] },
        { topic: "Próximos passos", duration_minutes: 5, talking_points: ["Definir ações para próxima semana"], questions_to_ask: [] },
      ],
      metrics_review: {
        highlights: brokerData.metrics.winRate > 40 ? ["Win rate acima da média"] : ["Volume de interações consistente"],
        concerns: brokerData.metrics.coldLeads > 3 ? [`${brokerData.metrics.coldLeads} leads frios`] : [],
        comparison_to_last: lastSession ? "Comparação com dados da última sessão" : "Primeira sessão — sem comparação",
      },
      action_items_review: (pendingItems || []).map((i: any) => ({
        description: i.description,
        status: i.status,
        follow_up: i.status === "pending" ? "Verificar progresso" : "Revisar evidências",
      })),
      coaching_moments: [
        { situation: "Gestão de leads frios", technique: "Role-play de reativação", script: "Vamos simular uma ligação de reativação para um lead que não responde há 2 semanas..." },
      ],
      recognition_points: brokerData.metrics.dealsWon > 0 ? [`${brokerData.metrics.dealsWon} deals fechados nos últimos 90 dias`] : ["Consistência nas atividades"],
      development_focus: activePlan?.focus_areas?.[0] || "Melhoria geral",
      estimated_duration_minutes: 45,
    };
  }

  // If session exists, save prep
  if (sessionId) {
    await admin.from("coaching_sessions")
      .update({ ai_prep: prep, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  return json(req, {
    prep,
    broker: { name: brokerData.profile.name, avatar_url: brokerData.profile.avatar_url },
    metrics: brokerData.metrics,
    activePlan: activePlan ? { id: activePlan.id, title: activePlan.title, focus_areas: activePlan.focus_areas } : null,
    pendingItems: pendingItems || [],
  });
}

async function saveSession(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  body: any,
) {
  const {
    session_id,
    broker_id,
    plan_id,
    scheduled_at,
    topics_discussed,
    notes,
    key_takeaways,
    broker_feedback,
    coach_rating,
    duration_minutes,
    action_items,
  } = body;

  const brokerData = await fetchBrokerData(admin, tenantId, broker_id);

  let sessionData: any;

  if (session_id) {
    // Update existing session
    const { data } = await admin.from("coaching_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        topics_discussed: topics_discussed || [],
        notes,
        key_takeaways: key_takeaways || [],
        broker_feedback,
        coach_rating,
        duration_minutes,
        metrics_snapshot: brokerData.metrics,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session_id)
      .select()
      .maybeSingle();
    sessionData = data;
  } else {
    // Create new completed session
    const { data } = await admin.from("coaching_sessions").insert({
      tenant_id: tenantId,
      plan_id: plan_id || null,
      broker_id: broker_id,
      coach_id: userId,
      status: "completed",
      scheduled_at: scheduled_at || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      topics_discussed: topics_discussed || [],
      notes,
      key_takeaways: key_takeaways || [],
      broker_feedback,
      coach_rating,
      duration_minutes,
      metrics_snapshot: brokerData.metrics,
    }).select().maybeSingle();
    sessionData = data;
  }

  // Create action items
  if (sessionData && action_items?.length) {
    const items = action_items.map((a: any) => ({
      tenant_id: tenantId,
      session_id: sessionData.id,
      plan_id: plan_id || null,
      broker_id: broker_id,
      description: a.description,
      category: a.category || "general",
      priority: a.priority || "medium",
      status: "pending",
      due_date: a.due_date || null,
    }));
    await admin.from("coaching_action_items").insert(items);
  }

  return json(req, { session: sessionData, action_items_created: action_items?.length || 0 });
}

async function getBrokerDevelopment(
  req: Request,
  admin: Admin,
  tenantId: string,
  brokerId: string,
) {
  const [sessionsRes, plansRes, assessmentsRes, actionItemsRes, profileRes] = await Promise.all([
    admin.from("coaching_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("broker_id", brokerId)
      .order("scheduled_at", { ascending: false })
      .limit(20),
    admin.from("coaching_plans")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("broker_id", brokerId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin.from("broker_skill_assessments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("broker_id", brokerId)
      .order("created_at", { ascending: false })
      .limit(10),
    admin.from("coaching_action_items")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("broker_id", brokerId)
      .order("created_at", { ascending: false })
      .limit(30),
    admin.from("profiles")
      .select("user_id, name, avatar_url, role")
      .eq("user_id", brokerId)
      .maybeSingle(),
  ]);

  const sessions = sessionsRes.data || [];
  const plans = plansRes.data || [];
  const assessments = assessmentsRes.data || [];
  const actionItems = actionItemsRes.data || [];

  // Compute action item stats
  const totalItems = actionItems.length;
  const completedItems = actionItems.filter((i: any) => i.status === "completed").length;
  const overdueItems = actionItems.filter((i: any) => i.status === "overdue" || (i.status === "pending" && i.due_date && new Date(i.due_date) < new Date())).length;

  // Skill evolution (from assessments over time)
  const skillEvolution = assessments.map((a: any) => ({
    date: a.created_at,
    overall_score: a.overall_score,
    skills: a.skills,
  }));

  return json(req, {
    broker: profileRes.data,
    sessions,
    plans,
    assessments,
    actionItems,
    stats: {
      totalSessions: sessions.length,
      completedSessions: sessions.filter((s: any) => s.status === "completed").length,
      avgRating: sessions.filter((s: any) => s.coach_rating).reduce((sum: number, s: any) => sum + s.coach_rating, 0) / (sessions.filter((s: any) => s.coach_rating).length || 1),
      totalActionItems: totalItems,
      completedActionItems: completedItems,
      overdueActionItems: overdueItems,
      completionRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      activePlans: plans.filter((p: any) => p.status === "active").length,
    },
    skillEvolution,
  });
}

async function getTeamOverview(
  req: Request,
  admin: Admin,
  tenantId: string,
) {
  const brokers = await fetchAllBrokersMetrics(admin, tenantId);

  // Get latest assessments for all brokers
  const brokerIds = brokers.map((b: any) => b.user_id);
  const [assessmentsRes, sessionsRes, actionItemsRes, plansRes] = await Promise.all([
    admin.from("broker_skill_assessments")
      .select("broker_id, overall_score, strengths, improvement_areas, created_at")
      .eq("tenant_id", tenantId)
      .in("broker_id", brokerIds.length > 0 ? brokerIds : ["__none__"])
      .order("created_at", { ascending: false }),
    admin.from("coaching_sessions")
      .select("broker_id, status, coach_rating, completed_at")
      .eq("tenant_id", tenantId)
      .in("broker_id", brokerIds.length > 0 ? brokerIds : ["__none__"]),
    admin.from("coaching_action_items")
      .select("broker_id, status")
      .eq("tenant_id", tenantId)
      .in("broker_id", brokerIds.length > 0 ? brokerIds : ["__none__"]),
    admin.from("coaching_plans")
      .select("broker_id, status, title")
      .eq("tenant_id", tenantId)
      .in("broker_id", brokerIds.length > 0 ? brokerIds : ["__none__"]),
  ]);

  const assessments = assessmentsRes.data || [];
  const sessions = sessionsRes.data || [];
  const actionItems = actionItemsRes.data || [];
  const plans = plansRes.data || [];

  // Build per-broker summary
  const brokerSummaries = brokers.map((b: any) => {
    const bId = b.user_id;
    const latestAssessment = assessments.find((a: any) => a.broker_id === bId);
    const bSessions = sessions.filter((s: any) => s.broker_id === bId);
    const bItems = actionItems.filter((i: any) => i.broker_id === bId);
    const bPlans = plans.filter((p: any) => p.broker_id === bId);

    return {
      broker: { user_id: bId, name: b.name, avatar_url: b.avatar_url },
      overall_score: latestAssessment?.overall_score || null,
      strengths: latestAssessment?.strengths || [],
      improvement_areas: latestAssessment?.improvement_areas || [],
      sessions_completed: bSessions.filter((s: any) => s.status === "completed").length,
      sessions_scheduled: bSessions.filter((s: any) => s.status === "scheduled").length,
      avg_rating: bSessions.filter((s: any) => s.coach_rating).length > 0
        ? (bSessions.filter((s: any) => s.coach_rating).reduce((sum: number, s: any) => sum + s.coach_rating, 0) / bSessions.filter((s: any) => s.coach_rating).length).toFixed(1)
        : null,
      action_items_total: bItems.length,
      action_items_completed: bItems.filter((i: any) => i.status === "completed").length,
      action_items_overdue: bItems.filter((i: any) => i.status === "overdue").length,
      active_plan: bPlans.find((p: any) => p.status === "active")?.title || null,
      last_session: bSessions
        .filter((s: any) => s.status === "completed")
        .sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]?.completed_at || null,
      needs_attention: !latestAssessment || (latestAssessment.overall_score && latestAssessment.overall_score < 50),
    };
  });

  // Team stats
  const totalSessions = sessions.filter((s: any) => s.status === "completed").length;
  const totalItems = actionItems.length;
  const completedItems = actionItems.filter((i: any) => i.status === "completed").length;
  const avgScore = brokerSummaries.filter((b: any) => b.overall_score).length > 0
    ? Math.round(brokerSummaries.filter((b: any) => b.overall_score).reduce((sum: number, b: any) => sum + b.overall_score, 0) / brokerSummaries.filter((b: any) => b.overall_score).length)
    : null;

  return json(req, {
    brokers: brokerSummaries,
    teamStats: {
      totalBrokers: brokers.length,
      assessedBrokers: brokerSummaries.filter((b: any) => b.overall_score).length,
      avgTeamScore: avgScore,
      totalSessions,
      totalActionItems: totalItems,
      completedActionItems: completedItems,
      completionRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      brokersNeedingAttention: brokerSummaries.filter((b: any) => b.needs_attention).length,
      activePlans: plans.filter((p: any) => p.status === "active").length,
    },
  });
}

async function updateActionItem(
  req: Request,
  admin: Admin,
  tenantId: string,
  body: any,
) {
  const { item_id, status, evidence } = body;
  if (!item_id) return json(req, { error: "item_id obrigatório" }, 400);

  const updateData: any = { status, updated_at: new Date().toISOString() };
  if (status === "completed") updateData.completed_at = new Date().toISOString();
  if (evidence) updateData.evidence = evidence;

  const { data } = await admin
    .from("coaching_action_items")
    .update(updateData)
    .eq("id", item_id)
    .eq("tenant_id", tenantId)
    .select()
    .maybeSingle();

  return json(req, { item: data });
}

// ─── Main ────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const { tenantId, userId, admin } = await resolveAuth(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    switch (action) {
      case "assess_broker_skills":
        return assessBrokerSkills(req, admin, tenantId, userId, body.broker_id);

      case "generate_coaching_plan":
        return generateCoachingPlan(req, admin, tenantId, userId, body.broker_id);

      case "prep_session":
        return prepSession(req, admin, tenantId, body.broker_id, body.session_id);

      case "save_session":
        return saveSession(req, admin, tenantId, userId, body);

      case "get_broker_development":
        return getBrokerDevelopment(req, admin, tenantId, body.broker_id);

      case "get_team_overview":
        return getTeamOverview(req, admin, tenantId);

      case "update_action_item":
        return updateActionItem(req, admin, tenantId, body);

      default:
        return json(req, { error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("[coaching-ai]", err);
    return json(req, { error: err.message || "Erro interno" }, err.message?.includes("autenticado") ? 401 : 500);
  }
});
