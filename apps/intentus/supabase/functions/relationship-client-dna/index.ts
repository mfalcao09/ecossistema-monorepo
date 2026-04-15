/**
 * relationship-client-dna — v1
 * Perfil Comportamental Dinâmico (DNA do Cliente) — F1
 *
 * Two modes:
 *   1. "quiz" — receives quiz responses, generates behavioral profile via AI
 *   2. "infer" — analyzes interaction history to infer profile without quiz
 *
 * Output: Full behavioral profile (communication, decision, engagement, values, personality)
 *         + composite scores + AI summary + approach guide
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

// ── Quiz Questions Definition ───────────────────────────────
const QUIZ_QUESTIONS = [
  {
    id: "comm_channel",
    category: "communication_style",
    question: "Como você prefere ser contactado?",
    options: [
      { value: "whatsapp", label: "WhatsApp", score_map: { digital_comfort: 80, formality: 30 } },
      { value: "phone", label: "Ligação telefônica", score_map: { digital_comfort: 40, formality: 50 } },
      { value: "email", label: "E-mail", score_map: { digital_comfort: 70, formality: 80 } },
      { value: "in_person", label: "Presencialmente", score_map: { digital_comfort: 20, formality: 60 } },
    ],
  },
  {
    id: "comm_frequency",
    category: "engagement_pattern",
    question: "Com que frequência gostaria de receber atualizações sobre seu imóvel?",
    options: [
      { value: "daily", label: "Diariamente", score_map: { proactivity: 90, engagement: 95 } },
      { value: "weekly", label: "Semanalmente", score_map: { proactivity: 70, engagement: 75 } },
      { value: "biweekly", label: "Quinzenalmente", score_map: { proactivity: 50, engagement: 55 } },
      { value: "monthly", label: "Mensalmente", score_map: { proactivity: 30, engagement: 35 } },
      { value: "only_needed", label: "Apenas quando necessário", score_map: { proactivity: 10, engagement: 20 } },
    ],
  },
  {
    id: "comm_time",
    category: "engagement_pattern",
    question: "Qual o melhor horário para entrarmos em contato?",
    options: [
      { value: "morning", label: "Manhã (8h-12h)", score_map: { morning_person: 90 } },
      { value: "afternoon", label: "Tarde (12h-18h)", score_map: { morning_person: 50 } },
      { value: "evening", label: "Noite (18h-21h)", score_map: { morning_person: 20 } },
      { value: "flexible", label: "Qualquer horário", score_map: { flexibility: 90 } },
    ],
  },
  {
    id: "decision_style",
    category: "decision_profile",
    question: "Quando precisa tomar uma decisão sobre seu imóvel, como age?",
    options: [
      { value: "quick", label: "Decido rápido, confio no instinto", score_map: { speed: 90, risk_tolerance: 80 } },
      { value: "research", label: "Pesquiso bastante antes de decidir", score_map: { speed: 30, data_driven: 90 } },
      { value: "consult", label: "Consulto família/amigos/advogado", score_map: { speed: 40, influencers: 90 } },
      { value: "delegate", label: "Prefiro que a administradora decida", score_map: { speed: 70, delegation: 90 } },
    ],
  },
  {
    id: "problem_reaction",
    category: "personality_traits",
    question: "Quando surge um problema no imóvel, como você reage?",
    options: [
      { value: "proactive", label: "Resolvo eu mesmo e aviso depois", score_map: { autonomy: 90, extraversion: 70 } },
      { value: "contact_immediately", label: "Entro em contato imediatamente", score_map: { urgency: 90, dependence: 70 } },
      { value: "wait_escalate", label: "Espero um pouco, se não resolver, escalo", score_map: { patience: 70, conscientiousness: 80 } },
      { value: "ignore", label: "Só ligo se for muito grave", score_map: { patience: 90, low_engagement: 80 } },
    ],
  },
  {
    id: "value_priority",
    category: "value_priorities",
    question: "O que mais valoriza no relacionamento com a administradora?",
    options: [
      { value: "speed", label: "Rapidez nas respostas", score_map: { speed_value: 90 } },
      { value: "transparency", label: "Transparência total", score_map: { transparency_value: 90 } },
      { value: "personal_touch", label: "Atendimento personalizado", score_map: { personalization_value: 90 } },
      { value: "tech_innovation", label: "Tecnologia e inovação", score_map: { innovation_value: 90 } },
      { value: "cost_efficiency", label: "Custo-benefício", score_map: { cost_value: 90 } },
    ],
  },
  {
    id: "deal_breaker",
    category: "value_priorities",
    question: "O que faria você considerar trocar de administradora?",
    options: [
      { value: "slow_response", label: "Demora nas respostas", score_map: { speed_critical: 90 } },
      { value: "hidden_fees", label: "Cobranças surpresa", score_map: { transparency_critical: 90 } },
      { value: "poor_maintenance", label: "Manutenção mal feita", score_map: { quality_critical: 90 } },
      { value: "bad_communication", label: "Falta de comunicação", score_map: { communication_critical: 90 } },
      { value: "outdated_tech", label: "Sistema antiquado", score_map: { tech_critical: 90 } },
    ],
  },
  {
    id: "digital_comfort",
    category: "engagement_pattern",
    question: "Como se sente usando plataformas digitais para gerenciar seu imóvel?",
    options: [
      { value: "love_it", label: "Adoro! Uso tudo pelo app", score_map: { digital_comfort: 95, tech_savvy: 90 } },
      { value: "comfortable", label: "Uso tranquilamente", score_map: { digital_comfort: 75, tech_savvy: 70 } },
      { value: "some_difficulty", label: "Tenho alguma dificuldade", score_map: { digital_comfort: 40, tech_savvy: 35 } },
      { value: "prefer_person", label: "Prefiro atendimento pessoal", score_map: { digital_comfort: 15, tech_savvy: 15 } },
    ],
  },
  {
    id: "feedback_style",
    category: "personality_traits",
    question: "Como costuma dar feedback sobre os serviços?",
    options: [
      { value: "spontaneous", label: "Dou feedback espontaneamente", score_map: { extraversion: 85, openness: 80 } },
      { value: "when_asked", label: "Apenas quando perguntam", score_map: { extraversion: 40, agreeableness: 70 } },
      { value: "detailed_written", label: "Prefiro escrever com detalhes", score_map: { conscientiousness: 85, detail_oriented: 90 } },
      { value: "rarely", label: "Raramente dou feedback", score_map: { extraversion: 20, low_engagement: 60 } },
    ],
  },
  {
    id: "loyalty_driver",
    category: "value_priorities",
    question: "O que mais te motivaria a indicar a administradora para amigos?",
    options: [
      { value: "excellent_service", label: "Serviço excelente", score_map: { quality_driver: 90 } },
      { value: "good_price", label: "Bom preço", score_map: { cost_driver: 90 } },
      { value: "personal_relationship", label: "Bom relacionamento pessoal", score_map: { relationship_driver: 90 } },
      { value: "innovation", label: "Inovação e tecnologia", score_map: { innovation_driver: 90 } },
      { value: "trust", label: "Confiança e credibilidade", score_map: { trust_driver: 90 } },
    ],
  },
];

// ── Interaction History Collector (for "infer" mode) ────────
async function collectInteractionData(
  supabase: any,
  tenantId: string,
  personId: string,
): Promise<any> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Parallel queries
  const [ticketsRes, satisfactionRes, communicationsRes, maintenanceRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, category, priority, status, created_at, description, channel")
      .eq("tenant_id", tenantId)
      .eq("person_id", personId)
      .gte("created_at", ninetyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("satisfaction_responses")
      .select("score, comments, responded_at, channel")
      .eq("tenant_id", tenantId)
      .eq("person_id", personId)
      .order("responded_at", { ascending: false })
      .limit(10),
    supabase
      .from("communication_logs")
      .select("channel, direction, status, sent_at, opened_at")
      .eq("tenant_id", tenantId)
      .eq("person_id", personId)
      .gte("sent_at", ninetyDaysAgo)
      .order("sent_at", { ascending: false })
      .limit(50),
    supabase
      .from("maintenance_requests")
      .select("id, status, priority, created_at, description")
      .eq("tenant_id", tenantId)
      .eq("person_id", personId)
      .gte("created_at", ninetyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    tickets: ticketsRes.data || [],
    satisfaction: satisfactionRes.data || [],
    communications: communicationsRes.data || [],
    maintenance: maintenanceRes.data || [],
    summary: {
      total_tickets: (ticketsRes.data || []).length,
      avg_satisfaction: (satisfactionRes.data || []).length > 0
        ? (satisfactionRes.data || []).reduce((s: number, r: any) => s + (r.score || 0), 0) / satisfactionRes.data.length
        : null,
      preferred_channel: inferPreferredChannel(communicationsRes.data || []),
      response_rate: calculateResponseRate(satisfactionRes.data || []),
      ticket_categories: groupBy(ticketsRes.data || [], "category"),
    },
  };
}

function inferPreferredChannel(communications: any[]): string {
  if (communications.length === 0) return "unknown";
  const channels: Record<string, number> = {};
  for (const c of communications) {
    channels[c.channel] = (channels[c.channel] || 0) + 1;
  }
  return Object.entries(channels).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
}

function calculateResponseRate(satisfaction: any[]): number {
  if (satisfaction.length === 0) return 0;
  const responded = satisfaction.filter(s => s.score !== null).length;
  return Math.round((responded / satisfaction.length) * 100);
}

function groupBy(arr: any[], key: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of arr) {
    const k = item[key] || "other";
    result[k] = (result[k] || 0) + 1;
  }
  return result;
}

// ── AI Analysis via Gemini ──────────────────────────────────
const DNA_TOOL = {
  functionDeclarations: [
    {
      name: "client_behavioral_profile",
      description: "Generates a comprehensive behavioral profile (DNA) for a real estate client",
      parameters: {
        type: "OBJECT",
        properties: {
          communication_style: {
            type: "OBJECT",
            description: "Communication preferences and patterns",
            properties: {
              preferred_channel: { type: "STRING", description: "whatsapp | phone | email | in_person" },
              response_speed: { type: "STRING", description: "instant | fast | moderate | slow" },
              formality: { type: "STRING", description: "formal | balanced | informal" },
              detail_level: { type: "STRING", description: "minimal | moderate | detailed | exhaustive" },
              score: { type: "NUMBER", description: "Overall communication compatibility score 0-100" },
            },
            required: ["preferred_channel", "response_speed", "formality", "detail_level", "score"],
          },
          decision_profile: {
            type: "OBJECT",
            description: "How the client makes decisions",
            properties: {
              speed: { type: "STRING", description: "impulsive | quick | deliberate | slow" },
              influencers: { type: "ARRAY", items: { type: "STRING" }, description: "Who influences decisions" },
              risk_tolerance: { type: "STRING", description: "risk_averse | conservative | moderate | adventurous" },
              data_driven: { type: "BOOLEAN", description: "Whether client prefers data-backed decisions" },
              score: { type: "NUMBER", description: "Decision autonomy score 0-100" },
            },
            required: ["speed", "risk_tolerance", "data_driven", "score"],
          },
          engagement_pattern: {
            type: "OBJECT",
            description: "How the client engages with the service",
            properties: {
              best_time: { type: "STRING", description: "morning | afternoon | evening | flexible" },
              frequency_preference: { type: "STRING", description: "daily | weekly | biweekly | monthly | on_demand" },
              proactivity: { type: "STRING", description: "proactive | reactive | passive" },
              digital_comfort: { type: "NUMBER", description: "Digital comfort score 0-100" },
              score: { type: "NUMBER", description: "Overall engagement propensity score 0-100" },
            },
            required: ["best_time", "frequency_preference", "proactivity", "digital_comfort", "score"],
          },
          value_priorities: {
            type: "OBJECT",
            description: "What the client values most",
            properties: {
              top_values: { type: "ARRAY", items: { type: "STRING" }, description: "Top 3 values" },
              deal_breakers: { type: "ARRAY", items: { type: "STRING" }, description: "Deal breakers" },
              loyalty_drivers: { type: "ARRAY", items: { type: "STRING" }, description: "What drives loyalty" },
              score: { type: "NUMBER", description: "Alignment score with service 0-100" },
            },
            required: ["top_values", "deal_breakers", "loyalty_drivers", "score"],
          },
          personality_traits: {
            type: "OBJECT",
            description: "Personality assessment",
            properties: {
              disc_profile: { type: "STRING", description: "D | I | S | C" },
              openness: { type: "NUMBER", description: "Openness score 0-100" },
              conscientiousness: { type: "NUMBER", description: "Conscientiousness score 0-100" },
              extraversion: { type: "NUMBER", description: "Extraversion score 0-100" },
              agreeableness: { type: "NUMBER", description: "Agreeableness score 0-100" },
              neuroticism: { type: "NUMBER", description: "Neuroticism score 0-100 (lower = more stable)" },
            },
            required: ["disc_profile", "openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"],
          },
          overall_dna_score: { type: "NUMBER", description: "Overall DNA compatibility score 0-100" },
          adaptability_index: { type: "NUMBER", description: "How easy it is to adapt service to this client 0-100" },
          satisfaction_predictor: { type: "NUMBER", description: "Predicted satisfaction score 0-100" },
          ai_summary: { type: "STRING", description: "Executive summary of the client profile in Portuguese (2-3 paragraphs)" },
          ai_approach_guide: { type: "STRING", description: "Practical guide for CS team on how to approach this client, in Portuguese" },
          risk_factors: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                factor: { type: "STRING" },
                severity: { type: "STRING", description: "low | medium | high" },
                mitigation: { type: "STRING" },
              },
            },
            description: "Risk factors identified in the profile",
          },
          opportunity_areas: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                area: { type: "STRING" },
                potential: { type: "STRING", description: "low | medium | high" },
                action: { type: "STRING" },
              },
            },
            description: "Opportunity areas for upsell/engagement",
          },
        },
        required: [
          "communication_style", "decision_profile", "engagement_pattern",
          "value_priorities", "personality_traits", "overall_dna_score",
          "adaptability_index", "satisfaction_predictor", "ai_summary",
          "ai_approach_guide", "risk_factors", "opportunity_areas",
        ],
      },
    },
  ],
};

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceSupabase = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await userSupabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    // Get tenant
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.tenant_id) return new Response(JSON.stringify({ error: "No tenant" }), { status: 400, headers: cors });

    const tenantId = profile.tenant_id;

    // Parse body
    const body = await req.json();
    const { person_id, mode = "quiz", quiz_responses } = body;
    // mode: "quiz" | "infer" | "hybrid"

    if (!person_id) {
      return new Response(JSON.stringify({ error: "person_id is required" }), { status: 400, headers: cors });
    }

    // Verify person belongs to tenant
    const { data: person } = await serviceSupabase
      .from("people")
      .select("id, name, email, phone, type")
      .eq("id", person_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!person) {
      return new Response(JSON.stringify({ error: "Person not found" }), { status: 404, headers: cors });
    }

    const startTime = Date.now();

    // Build context for AI
    let userPrompt = `Analise o seguinte cliente e gere seu perfil comportamental (DNA):\n\n`;
    userPrompt += `**Cliente:** ${person.name || "N/A"}\n`;
    userPrompt += `**Tipo:** ${person.type || "N/A"}\n\n`;

    let source = mode;

    if (mode === "quiz" || mode === "hybrid") {
      if (quiz_responses && quiz_responses.length > 0) {
        userPrompt += `## Respostas do Quiz Comportamental\n\n`;
        for (const resp of quiz_responses) {
          const question = QUIZ_QUESTIONS.find(q => q.id === resp.question_id);
          if (question) {
            const option = question.options.find((o: any) => o.value === resp.answer);
            userPrompt += `**${question.question}**\nResposta: ${option?.label || resp.answer}\n\n`;
          }
        }
      }
    }

    if (mode === "infer" || mode === "hybrid") {
      const interactionData = await collectInteractionData(serviceSupabase, tenantId, person_id);
      userPrompt += `## Dados de Interação (últimos 90 dias)\n\n`;
      userPrompt += `- Total de tickets: ${interactionData.summary.total_tickets}\n`;
      userPrompt += `- Satisfação média: ${interactionData.summary.avg_satisfaction ?? "N/A"}\n`;
      userPrompt += `- Canal preferido (inferido): ${interactionData.summary.preferred_channel}\n`;
      userPrompt += `- Taxa de resposta a pesquisas: ${interactionData.summary.response_rate}%\n`;

      if (interactionData.tickets.length > 0) {
        userPrompt += `\n### Tickets recentes:\n`;
        for (const t of interactionData.tickets.slice(0, 10)) {
          userPrompt += `- [${t.category || "geral"}] ${t.priority} — ${(t.description || "").slice(0, 100)}\n`;
        }
      }

      if (interactionData.satisfaction.length > 0) {
        userPrompt += `\n### Pesquisas de satisfação:\n`;
        for (const s of interactionData.satisfaction.slice(0, 5)) {
          userPrompt += `- Score: ${s.score}/10 — "${(s.comments || "sem comentário").slice(0, 100)}"\n`;
        }
      }

      if (!quiz_responses || quiz_responses.length === 0) {
        source = "ai_inferred";
      }
    }

    // Resolve persona
    const persona = await resolvePersona("client_dna_analyzer", tenantId);

    // Call AI
    const aiResponse = await callGemini({
      persona,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      tools: [DNA_TOOL],
      toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["client_behavioral_profile"] } },
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      return new Response(JSON.stringify({ error: "AI analysis failed", detail: errText }), { status: 502, headers: cors });
    }

    const aiData = await aiResponse.json();
    const fnCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;

    if (!fnCall || fnCall.name !== "client_behavioral_profile") {
      console.error("Unexpected AI response:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "Unexpected AI response format" }), { status: 502, headers: cors });
    }

    const dna = fnCall.args;

    // Check for existing profile (for versioning)
    const { data: existingProfile } = await serviceSupabase
      .from("client_behavioral_profiles")
      .select("id, version")
      .eq("tenant_id", tenantId)
      .eq("person_id", person_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const newVersion = existingProfile ? existingProfile.version + 1 : 1;

    // Persist to DB
    const profileData = {
      tenant_id: tenantId,
      person_id,
      communication_style: dna.communication_style || {},
      decision_profile: dna.decision_profile || {},
      engagement_pattern: dna.engagement_pattern || {},
      value_priorities: dna.value_priorities || {},
      personality_traits: dna.personality_traits || {},
      overall_dna_score: dna.overall_dna_score || 0,
      adaptability_index: dna.adaptability_index || 0,
      satisfaction_predictor: dna.satisfaction_predictor || 0,
      ai_summary: dna.ai_summary || "",
      ai_approach_guide: dna.ai_approach_guide || "",
      ai_risk_factors: dna.risk_factors || [],
      ai_opportunity_areas: dna.opportunity_areas || [],
      quiz_responses: quiz_responses || [],
      quiz_completed_at: (mode === "quiz" || mode === "hybrid") && quiz_responses?.length ? new Date().toISOString() : null,
      quiz_version: "v1",
      source,
      confidence_score: mode === "quiz" ? 85 : mode === "hybrid" ? 90 : 60,
      version: newVersion,
      previous_profile_id: existingProfile?.id || null,
      last_analyzed_at: new Date().toISOString(),
      next_review_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data: savedProfile, error: saveErr } = await serviceSupabase
      .from("client_behavioral_profiles")
      .insert(profileData)
      .select("id")
      .single();

    if (saveErr) {
      console.error("Save error:", saveErr);
      return new Response(JSON.stringify({ error: "Failed to save profile", detail: saveErr.message }), { status: 500, headers: cors });
    }

    // Log interaction (fire-and-forget)
    const responseTimeMs = Date.now() - startTime;
    logInteraction({
      tenantId,
      userId: user.id,
      functionKey: "client_dna_analyzer",
      inputSummary: `DNA analysis for ${person.name} (mode: ${mode})`,
      outputSummary: `Score: ${dna.overall_dna_score}, DISC: ${dna.personality_traits?.disc_profile}`,
      responseTimeMs,
    }).catch(() => {});

    // Return full result
    return new Response(JSON.stringify({
      success: true,
      profile_id: savedProfile.id,
      version: newVersion,
      person: { id: person.id, name: person.name },
      dna: {
        communication_style: dna.communication_style,
        decision_profile: dna.decision_profile,
        engagement_pattern: dna.engagement_pattern,
        value_priorities: dna.value_priorities,
        personality_traits: dna.personality_traits,
        overall_dna_score: dna.overall_dna_score,
        adaptability_index: dna.adaptability_index,
        satisfaction_predictor: dna.satisfaction_predictor,
      },
      ai_summary: dna.ai_summary,
      ai_approach_guide: dna.ai_approach_guide,
      risk_factors: dna.risk_factors,
      opportunity_areas: dna.opportunity_areas,
      meta: {
        source,
        confidence_score: profileData.confidence_score,
        response_time_ms: responseTimeMs,
        quiz_version: "v1",
      },
    }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
