/**
 * commercial-conversation-intelligence v1
 * AI-powered conversation analysis: sentiment, coaching, deal impact.
 *
 * 3 actions:
 *   - analyze_conversations: Batch sentiment + quality + objections + cadence
 *   - get_coaching_insights:  Top vs bottom performer comparison + tips
 *   - get_deal_impact:        Conversation patterns correlated with win/loss
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
    console.error("[conversation-intelligence] AI error:", res.status, await res.text());
    return null;
  }

  const result = await res.json();
  const content = result.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code blocks
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch { /* fall through */ }
    }
    console.error("[conversation-intelligence] Failed to parse AI response");
    return null;
  }
}

// ─── Fetch interactions ──────────────────────────────────────────────────────
async function fetchInteractions(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  days = 90,
) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await admin
    .from("interactions")
    .select("id, person_id, user_id, interaction_type, notes, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data || []) as {
    id: string; person_id: string; user_id: string;
    interaction_type: string; notes: string | null; created_at: string;
  }[];
}

async function fetchProfiles(admin: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await admin
    .from("profiles")
    .select("user_id, name")
    .eq("tenant_id", tenantId)
    .limit(100);
  const map = new Map<string, string>();
  for (const p of (data || [])) map.set(p.user_id, p.name || "Sem nome");
  return map;
}

async function fetchLeads(admin: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await admin
    .from("leads")
    .select("id, name, person_id, status, last_contact_at")
    .eq("tenant_id", tenantId)
    .not("status", "in", '("convertido","perdido")')
    .limit(300);
  return (data || []) as {
    id: string; name: string; person_id: string | null;
    status: string; last_contact_at: string | null;
  }[];
}

async function fetchDeals(admin: ReturnType<typeof createClient>, tenantId: string) {
  const since = new Date(Date.now() - 180 * 86400000).toISOString();
  const { data } = await admin
    .from("deal_requests")
    .select("id, deal_type, status, proposed_value, proposed_monthly_value, assigned_to, created_at, updated_at, lost_reason")
    .eq("tenant_id", tenantId)
    .in("status", ["concluido", "cancelado", "em_andamento", "proposta"])
    .gte("created_at", since)
    .limit(500);
  return (data || []) as any[];
}

// ─── Action: analyze_conversations ───────────────────────────────────────────
async function handleAnalyzeConversations(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const days = Math.min(180, Math.max(7, Number(body.days) || 90));
  const interactions = await fetchInteractions(admin, tenantId, days);
  const profileMap = await fetchProfiles(admin, tenantId);
  const leads = await fetchLeads(admin, tenantId);

  if (interactions.length === 0) {
    return { data: { message: "Nenhuma interação encontrada no período" } };
  }

  // Build lead name map
  const leadByPerson = new Map<string, string>();
  for (const l of leads) {
    if (l.person_id) leadByPerson.set(l.person_id, l.name);
  }

  // Prepare interactions summary for AI (limit to ~100 with notes)
  const withNotes = interactions.filter(i => i.notes && i.notes.trim().length > 10);
  const sample = withNotes.slice(0, 100);

  const interactionsSummary = sample.map((i, idx) => ({
    idx: idx + 1,
    id: i.id,
    broker: profileMap.get(i.user_id) || "Desconhecido",
    lead: leadByPerson.get(i.person_id) || i.person_id?.slice(0, 8) || "N/A",
    channel: i.interaction_type,
    notes: (i.notes || "").slice(0, 300),
    date: i.created_at.slice(0, 10),
  }));

  // Channel stats
  const channelCounts = new Map<string, number>();
  for (const i of interactions) channelCounts.set(i.interaction_type, (channelCounts.get(i.interaction_type) || 0) + 1);

  // Broker stats
  const brokerStats = new Map<string, { total: number; channels: Map<string, number> }>();
  for (const i of interactions) {
    if (!brokerStats.has(i.user_id)) brokerStats.set(i.user_id, { total: 0, channels: new Map() });
    const b = brokerStats.get(i.user_id)!;
    b.total++;
    b.channels.set(i.interaction_type, (b.channels.get(i.interaction_type) || 0) + 1);
  }

  const systemPrompt = `Você é um especialista em Conversation Intelligence para vendas imobiliárias no Brasil.
Analise as interações entre corretores e leads/clientes e retorne JSON com:

1. "sentiments": Array (max 100) com { "interaction_id": "...", "sentiment": "positive"|"neutral"|"negative", "score": -100 a +100, "emotions": [{"name":"...","intensity":0-100}], "key_topics": ["..."], "quality_score": 0-100, "objections_detected": ["..."] }
2. "broker_scores": Array com { "user_id": "...", "name": "...", "quality_score": 0-100, "strengths": ["..."], "improvements": ["..."], "response_speed_rating": "rapido"|"adequado"|"lento" }
3. "objection_patterns": Array com { "objection": "...", "frequency": N, "recommended_response": "...", "success_rate_estimate": 0-100 }
4. "cadence_recommendations": { "ideal_follow_up_days": N, "best_channels_by_stage": {"prospeccao":"...","negociacao":"...","fechamento":"..."}, "optimal_contact_times": ["..."], "avoid_patterns": ["..."] }
5. "channel_effectiveness": Array com { "channel": "...", "effectiveness_score": 0-100, "best_for": ["..."], "avg_conversion_contribution": 0-100 }
6. "next_best_actions": Array (max 10) com { "lead_name": "...", "person_id": "...", "recommended_action": "...", "urgency": "alta"|"media"|"baixa", "reasoning": "...", "suggested_script": "..." }
7. "summary": "Resumo executivo de 3-4 frases"

Considere nuances do mercado imobiliário brasileiro.`;

  const userPrompt = `Analise estas ${sample.length} interações (de ${interactions.length} total nos últimos ${days} dias):

INTERAÇÕES:
${JSON.stringify(interactionsSummary, null, 1)}

ESTATÍSTICAS POR CANAL:
${Array.from(channelCounts.entries()).map(([ch, n]) => `${ch}: ${n}`).join(", ")}

CORRETORES:
${Array.from(brokerStats.entries()).map(([uid, s]) => `${profileMap.get(uid) || uid.slice(0, 8)}: ${s.total} interações`).join(", ")}

LEADS ATIVOS: ${leads.length}`;

  let aiResult = await callGemini(systemPrompt, userPrompt);

  // Fallback rule-based if AI unavailable
  if (!aiResult) {
    aiResult = buildRuleBasedAnalysis(interactions, profileMap, leads, leadByPerson);
  }

  // Persist sentiments to interaction_sentiments table
  if (aiResult.sentiments && Array.isArray(aiResult.sentiments)) {
    const rows = aiResult.sentiments
      .filter((s: any) => s.interaction_id)
      .map((s: any) => ({
        interaction_id: s.interaction_id,
        tenant_id: tenantId,
        sentiment: s.sentiment || "neutral",
        score: Number(s.score) || 0,
        emotions: s.emotions || [],
        key_topics: s.key_topics || [],
        quality_score: Number(s.quality_score) || 50,
        objections_detected: s.objections_detected || [],
      }));

    if (rows.length > 0) {
      // Upsert (delete old + insert new)
      const ids = rows.map((r: any) => r.interaction_id);
      await admin.from("interaction_sentiments").delete().in("interaction_id", ids);
      await admin.from("interaction_sentiments").insert(rows);
    }
  }

  // Save analysis record
  const periodStart = new Date(Date.now() - days * 86400000).toISOString();
  const periodEnd = new Date().toISOString();

  await admin.from("conversation_analyses").insert({
    tenant_id: tenantId,
    analysis_type: "full_analysis",
    data: aiResult,
    period_start: periodStart,
    period_end: periodEnd,
    interactions_analyzed: sample.length,
    created_by: userId,
  });

  return {
    data: {
      ...aiResult,
      meta: {
        interactions_total: interactions.length,
        interactions_analyzed: sample.length,
        period_days: days,
        generated_at: new Date().toISOString(),
      },
    },
  };
}

// ─── Rule-based fallback ─────────────────────────────────────────────────────
function buildRuleBasedAnalysis(
  interactions: any[],
  profileMap: Map<string, string>,
  leads: any[],
  leadByPerson: Map<string, string>,
) {
  // Basic sentiment from keywords
  const positiveWords = ["ótimo", "excelente", "perfeito", "adorei", "fechado", "aprovado", "parabéns", "obrigado", "satisfeito", "interessado"];
  const negativeWords = ["problema", "reclamação", "insatisfeito", "cancelar", "desistir", "ruim", "péssimo", "atraso", "erro", "não gostou"];

  const sentiments = interactions.filter(i => i.notes).slice(0, 100).map((i: any) => {
    const text = (i.notes || "").toLowerCase();
    const posCount = positiveWords.filter(w => text.includes(w)).length;
    const negCount = negativeWords.filter(w => text.includes(w)).length;
    const sentiment = posCount > negCount ? "positive" : negCount > posCount ? "negative" : "neutral";
    const score = (posCount - negCount) * 25;
    return {
      interaction_id: i.id,
      sentiment,
      score: Math.max(-100, Math.min(100, score)),
      emotions: [],
      key_topics: [],
      quality_score: 50,
      objections_detected: [],
    };
  });

  // Broker scores
  const brokerMap = new Map<string, number>();
  for (const i of interactions) brokerMap.set(i.user_id, (brokerMap.get(i.user_id) || 0) + 1);
  const broker_scores = Array.from(brokerMap.entries()).map(([uid, count]) => ({
    user_id: uid,
    name: profileMap.get(uid) || "Desconhecido",
    quality_score: Math.min(100, Math.round(50 + count * 0.5)),
    strengths: ["Volume de atendimento"],
    improvements: ["Análise IA indisponível — configure OPENROUTER_API_KEY"],
    response_speed_rating: "adequado" as const,
  }));

  return {
    sentiments,
    broker_scores,
    objection_patterns: [],
    cadence_recommendations: {
      ideal_follow_up_days: 3,
      best_channels_by_stage: { prospeccao: "whatsapp", negociacao: "visita", fechamento: "reuniao" },
      optimal_contact_times: ["09:00-11:00", "14:00-16:00"],
      avoid_patterns: ["Contato após 20h", "Múltiplos canais no mesmo dia"],
    },
    channel_effectiveness: [],
    next_best_actions: [],
    summary: "Análise baseada em regras (IA indisponível). Configure OPENROUTER_API_KEY para análise completa com Gemini 2.5 Flash.",
  };
}

// ─── Action: get_coaching_insights ───────────────────────────────────────────
async function handleCoachingInsights(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
) {
  const interactions = await fetchInteractions(admin, tenantId, 60);
  const profileMap = await fetchProfiles(admin, tenantId);
  const deals = await fetchDeals(admin, tenantId);

  if (interactions.length === 0) {
    return { data: { message: "Sem interações suficientes para coaching" } };
  }

  // Build broker performance data
  const brokerData = new Map<string, {
    total: number; channels: Map<string, number>;
    wins: number; losses: number; dealValue: number;
  }>();

  for (const i of interactions) {
    if (!brokerData.has(i.user_id)) {
      brokerData.set(i.user_id, { total: 0, channels: new Map(), wins: 0, losses: 0, dealValue: 0 });
    }
    const b = brokerData.get(i.user_id)!;
    b.total++;
    b.channels.set(i.interaction_type, (b.channels.get(i.interaction_type) || 0) + 1);
  }

  // Correlate with deals
  for (const d of deals) {
    if (!d.assigned_to || !brokerData.has(d.assigned_to)) continue;
    const b = brokerData.get(d.assigned_to)!;
    if (d.status === "concluido") {
      b.wins++;
      b.dealValue += Number(d.proposed_value || d.proposed_monthly_value || 0);
    } else if (d.status === "cancelado") {
      b.losses++;
    }
  }

  const brokerSummary = Array.from(brokerData.entries()).map(([uid, s]) => ({
    name: profileMap.get(uid) || uid.slice(0, 8),
    user_id: uid,
    interactions: s.total,
    wins: s.wins,
    losses: s.losses,
    win_rate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
    deal_value: s.dealValue,
    channels: Object.fromEntries(s.channels),
  }));

  // Sort by win_rate to identify top/bottom
  const sorted = [...brokerSummary].sort((a, b) => b.win_rate - a.win_rate);
  const topPerformers = sorted.slice(0, 3);
  const bottomPerformers = sorted.slice(-3).reverse();

  const systemPrompt = `Você é um coach de vendas especializado em mercado imobiliário brasileiro.
Analise a performance dos corretores e gere insights de coaching acionáveis.
Retorne JSON com:
{
  "overall_assessment": "Avaliação geral da equipe em 2-3 frases",
  "top_performer_patterns": ["Padrões que os top performers fazem diferente"],
  "coaching_tips": [{ "broker_name": "...", "user_id": "...", "current_score": 0-100, "tips": [{ "area": "...", "suggestion": "...", "expected_impact": "alto|medio|baixo", "script_example": "..." }], "priority_focus": "..." }],
  "team_recommendations": [{ "recommendation": "...", "rationale": "...", "implementation": "..." }],
  "benchmarks": { "ideal_interactions_per_week": N, "ideal_channel_mix": {...}, "ideal_win_rate": N }
}`;

  const userPrompt = `PERFORMANCE DOS CORRETORES (últimos 60 dias):

TOP PERFORMERS:
${topPerformers.map(b => `${b.name}: ${b.interactions} interações, ${b.wins}W/${b.losses}L (${b.win_rate}%), R$${b.deal_value}, canais: ${JSON.stringify(b.channels)}`).join("\n")}

BOTTOM PERFORMERS:
${bottomPerformers.map(b => `${b.name}: ${b.interactions} interações, ${b.wins}W/${b.losses}L (${b.win_rate}%), R$${b.deal_value}, canais: ${JSON.stringify(b.channels)}`).join("\n")}

TODOS:
${brokerSummary.map(b => `${b.name}: ${b.interactions} int, ${b.win_rate}% WR`).join(", ")}

Total de interações da equipe: ${interactions.length}
Total de deals terminados: ${deals.filter(d => ["concluido", "cancelado"].includes(d.status)).length}`;

  let aiResult = await callGemini(systemPrompt, userPrompt);

  if (!aiResult) {
    aiResult = {
      overall_assessment: "Análise baseada em regras. Configure OPENROUTER_API_KEY para coaching com IA.",
      top_performer_patterns: ["Maior volume de interações", "Diversificação de canais"],
      coaching_tips: brokerSummary.map(b => ({
        broker_name: b.name,
        user_id: b.user_id,
        current_score: b.win_rate,
        tips: [{ area: "Volume", suggestion: "Manter ritmo de atendimento", expected_impact: "medio", script_example: "" }],
        priority_focus: "Aumentar volume de interações",
      })),
      team_recommendations: [{ recommendation: "Configure IA para coaching avançado", rationale: "OPENROUTER_API_KEY não configurada", implementation: "Adicionar chave nas secrets do Supabase" }],
      benchmarks: { ideal_interactions_per_week: 20, ideal_channel_mix: { whatsapp: 40, ligacao: 25, visita: 20, email: 15 }, ideal_win_rate: 30 },
    };
  }

  // Persist
  await admin.from("conversation_analyses").insert({
    tenant_id: tenantId,
    analysis_type: "coaching_insights",
    data: aiResult,
    period_start: new Date(Date.now() - 60 * 86400000).toISOString(),
    period_end: new Date().toISOString(),
    interactions_analyzed: interactions.length,
    created_by: userId,
  });

  return { data: { ...aiResult, brokers: brokerSummary } };
}

// ─── Action: get_deal_impact ─────────────────────────────────────────────────
async function handleDealImpact(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
) {
  const interactions = await fetchInteractions(admin, tenantId, 180);
  const profileMap = await fetchProfiles(admin, tenantId);
  const deals = await fetchDeals(admin, tenantId);

  const terminalDeals = deals.filter(d => d.status === "concluido" || d.status === "cancelado");
  if (terminalDeals.length === 0) {
    return { data: { message: "Sem deals finalizados para análise de impacto" } };
  }

  // Build person_id → interactions map
  const personInteractions = new Map<string, any[]>();
  for (const i of interactions) {
    if (!personInteractions.has(i.person_id)) personInteractions.set(i.person_id, []);
    personInteractions.get(i.person_id)!.push(i);
  }

  // For each deal, find associated person (via lead) and their interactions
  const leads = await fetchLeads(admin, tenantId);
  // Also fetch converted/lost leads
  const { data: allLeads } = await admin
    .from("leads")
    .select("id, name, person_id, deal_request_id")
    .eq("tenant_id", tenantId)
    .limit(500);

  const dealLeadMap = new Map<string, string>(); // deal_id → person_id
  for (const l of (allLeads || [])) {
    if (l.deal_request_id && l.person_id) dealLeadMap.set(l.deal_request_id, l.person_id);
  }

  const dealAnalysis = terminalDeals.slice(0, 50).map(d => {
    const personId = dealLeadMap.get(d.id);
    const ints = personId ? (personInteractions.get(personId) || []) : [];
    const channels = [...new Set(ints.map((i: any) => i.interaction_type))];
    const daySpan = ints.length > 1
      ? Math.round((new Date(ints[0].created_at).getTime() - new Date(ints[ints.length - 1].created_at).getTime()) / 86400000)
      : 0;

    return {
      deal_id: d.id,
      deal_type: d.deal_type,
      outcome: d.status === "concluido" ? "won" : "lost",
      value: Number(d.proposed_value || d.proposed_monthly_value || 0),
      lost_reason: d.lost_reason || null,
      interaction_count: ints.length,
      channels_used: channels,
      channel_count: channels.length,
      engagement_span_days: daySpan,
      broker: profileMap.get(d.assigned_to) || "N/A",
    };
  });

  const wonDeals = dealAnalysis.filter(d => d.outcome === "won");
  const lostDeals = dealAnalysis.filter(d => d.outcome === "lost");

  const avgWonInteractions = wonDeals.length > 0 ? Math.round(wonDeals.reduce((s, d) => s + d.interaction_count, 0) / wonDeals.length) : 0;
  const avgLostInteractions = lostDeals.length > 0 ? Math.round(lostDeals.reduce((s, d) => s + d.interaction_count, 0) / lostDeals.length) : 0;
  const avgWonChannels = wonDeals.length > 0 ? Math.round(wonDeals.reduce((s, d) => s + d.channel_count, 0) / wonDeals.length * 10) / 10 : 0;
  const avgLostChannels = lostDeals.length > 0 ? Math.round(lostDeals.reduce((s, d) => s + d.channel_count, 0) / lostDeals.length * 10) / 10 : 0;

  const systemPrompt = `Você é um analista de vendas imobiliárias especializado em correlação entre padrões de comunicação e resultados de negócios.
Retorne JSON com:
{
  "correlation_insights": [{ "pattern": "...", "impact": "alto|medio|baixo", "correlation": "positiva|negativa", "evidence": "...", "recommendation": "..." }],
  "winning_patterns": { "avg_interactions": N, "key_channels": ["..."], "cadence_pattern": "...", "critical_touchpoints": ["..."] },
  "losing_patterns": { "common_gaps": ["..."], "warning_signs": ["..."], "avg_time_to_loss_days": N },
  "channel_impact": [{ "channel": "...", "win_correlation": 0-100, "optimal_timing": "...", "combined_with": ["..."] }],
  "recommendations": [{ "action": "...", "expected_lift": "...", "priority": "alta|media|baixa" }],
  "summary": "Resumo de 3-4 frases"
}`;

  const userPrompt = `ANÁLISE DE IMPACTO — Conversas vs Resultados de Deals (últimos 6 meses):

NEGÓCIOS GANHOS (${wonDeals.length}):
- Média de interações: ${avgWonInteractions}
- Média de canais utilizados: ${avgWonChannels}
- Detalhes: ${wonDeals.slice(0, 15).map(d => `${d.deal_type}: ${d.interaction_count} int, ${d.channels_used.join("+")} em ${d.engagement_span_days}d, R$${d.value}`).join(" | ")}

NEGÓCIOS PERDIDOS (${lostDeals.length}):
- Média de interações: ${avgLostInteractions}
- Média de canais utilizados: ${avgLostChannels}
- Motivos: ${lostDeals.slice(0, 15).map(d => `${d.deal_type}: ${d.interaction_count} int, ${d.channels_used.join("+")} em ${d.engagement_span_days}d — ${d.lost_reason || "sem motivo"}`).join(" | ")}`;

  let aiResult = await callGemini(systemPrompt, userPrompt);

  if (!aiResult) {
    aiResult = {
      correlation_insights: [{
        pattern: `Deals ganhos têm em média ${avgWonInteractions} interações vs ${avgLostInteractions} dos perdidos`,
        impact: "alto",
        correlation: "positiva",
        evidence: "Dados agregados",
        recommendation: "Manter cadência mínima de interações",
      }],
      winning_patterns: { avg_interactions: avgWonInteractions, key_channels: ["whatsapp", "visita"], cadence_pattern: "Contato a cada 3-5 dias", critical_touchpoints: ["Primeiro contato em 24h", "Visita ao imóvel"] },
      losing_patterns: { common_gaps: ["Falta de follow-up", "Canal único"], warning_signs: ["Sem contato > 7 dias", "Apenas 1 interação"], avg_time_to_loss_days: 30 },
      channel_impact: [],
      recommendations: [{ action: "Configure OPENROUTER_API_KEY para análise completa", expected_lift: "N/A", priority: "alta" }],
      summary: "Análise baseada em regras. Configure OPENROUTER_API_KEY para insights com IA.",
    };
  }

  // Persist
  await admin.from("conversation_analyses").insert({
    tenant_id: tenantId,
    analysis_type: "deal_impact",
    data: { ...aiResult, deal_stats: { won: wonDeals.length, lost: lostDeals.length, avg_won_interactions: avgWonInteractions, avg_lost_interactions: avgLostInteractions } },
    period_start: new Date(Date.now() - 180 * 86400000).toISOString(),
    period_end: new Date().toISOString(),
    interactions_analyzed: interactions.length,
    created_by: userId,
  });

  return {
    data: {
      ...aiResult,
      deal_stats: {
        won: wonDeals.length,
        lost: lostDeals.length,
        avg_won_interactions: avgWonInteractions,
        avg_lost_interactions: avgLostInteractions,
        avg_won_channels: avgWonChannels,
        avg_lost_channels: avgLostChannels,
      },
      deals: dealAnalysis,
    },
  };
}

// ─── Main Handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const { action, ...params } = await req.json();
    const { tenantId, userId, admin } = await resolveAuth(req);

    switch (action) {
      case "analyze_conversations":
        return json(req, await handleAnalyzeConversations(admin, tenantId, userId, params));

      case "get_coaching_insights":
        return json(req, await handleCoachingInsights(admin, tenantId, userId));

      case "get_deal_impact":
        return json(req, await handleDealImpact(admin, tenantId, userId));

      case "get_latest": {
        const type = params.type || "full_analysis";
        const { data } = await admin
          .from("conversation_analyses")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("analysis_type", type)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return json(req, { data });
      }

      default:
        return json(req, { error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[conversation-intelligence] Error:", err);
    return json(req, { error: String(err) }, 500);
  }
});
