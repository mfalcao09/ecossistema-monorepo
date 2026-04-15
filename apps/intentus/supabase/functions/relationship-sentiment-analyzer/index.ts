/**
 * relationship-sentiment-analyzer — v1
 * Sentiment Scanner de Primeiro Contato (F3)
 *
 * Modes:
 *   1. "analyze" — Analyze a single text (ticket, message, etc.)
 *   2. "scan_ticket" — Auto-analyze a support ticket + all messages
 *   3. "batch" — Analyze recent unanalyzed tickets for a person
 *
 * Features:
 *   - Multi-emotion detection with intensity
 *   - Intent classification
 *   - Urgency assessment with auto-escalation
 *   - Suggested response generation
 *   - First contact detection
 *
 * Squad: Claudinho (Claude) + Buchecha (MiniMax M2.7)
 * Created: 2026-03-21
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolvePersona, callGemini, logInteraction } from "../_shared/resolve-persona.ts";

// ── CORS ────────────────────────────────────────────────────
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

// ── Sentiment Tool for Function Calling ─────────────────────
const SENTIMENT_TOOL = {
  functionDeclarations: [
    {
      name: "sentiment_analysis_result",
      description: "Complete sentiment analysis of client communication text",
      parameters: {
        type: "OBJECT",
        properties: {
          overall_sentiment: {
            type: "STRING",
            description: "very_positive | positive | neutral | negative | very_negative",
          },
          sentiment_score: {
            type: "NUMBER",
            description: "Score from -100 (very negative) to +100 (very positive)",
          },
          confidence: {
            type: "NUMBER",
            description: "Confidence in analysis 0-100",
          },
          emotions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                emotion: { type: "STRING", description: "Name of emotion detected" },
                intensity: { type: "NUMBER", description: "Intensity 0-100" },
                trigger: { type: "STRING", description: "What triggered this emotion" },
              },
              required: ["emotion", "intensity", "trigger"],
            },
            description: "Detected emotions with intensity and triggers",
          },
          detected_intents: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                intent: { type: "STRING", description: "complaint | praise | request | churn_signal | info_request | threat | gratitude | frustration_vent" },
                confidence: { type: "NUMBER", description: "Confidence 0-100" },
              },
              required: ["intent", "confidence"],
            },
          },
          key_phrases: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Key phrases from the text",
          },
          topics: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Topics detected: maintenance, payment, communication, contract, etc.",
          },
          urgency_level: {
            type: "STRING",
            description: "critical | high | medium | normal | low",
          },
          urgency_score: {
            type: "NUMBER",
            description: "Urgency score 0-100",
          },
          urgency_justification: {
            type: "STRING",
            description: "Why this urgency level",
          },
          recommended_response_tone: {
            type: "STRING",
            description: "empathetic | technical | assertive | conciliatory | celebratory",
          },
          recommended_actions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                action: { type: "STRING" },
                priority: { type: "STRING", description: "high | medium | low" },
                responsible: { type: "STRING", description: "cs | manager | technical | financial" },
              },
              required: ["action", "priority"],
            },
          },
          ai_suggested_response: {
            type: "STRING",
            description: "Suggested response text in Portuguese that the agent can send to the client",
          },
          requires_escalation: {
            type: "BOOLEAN",
            description: "Whether this needs immediate escalation",
          },
          escalation_reason: {
            type: "STRING",
            description: "If escalation needed, why",
          },
        },
        required: [
          "overall_sentiment", "sentiment_score", "confidence",
          "emotions", "detected_intents", "key_phrases", "topics",
          "urgency_level", "urgency_score", "recommended_response_tone",
          "recommended_actions", "ai_suggested_response",
          "requires_escalation",
        ],
      },
    },
  ],
};

// ── Escalation thresholds ───────────────────────────────────
const ESCALATION_THRESHOLDS = {
  sentiment_score: -60, // auto-escalate if below -60
  urgency_score: 80,    // auto-escalate if above 80
  churn_intent_confidence: 70, // if churn_signal intent > 70%
};

// ── Helper: check if first contact ──────────────────────────
async function isFirstContact(
  supabase: any,
  tenantId: string,
  personId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("sentiment_analyses")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("person_id", personId);
  return (count || 0) === 0;
}

// ── Helper: get ticket text ─────────────────────────────────
async function getTicketText(
  supabase: any,
  ticketId: string,
): Promise<{ text: string; personId: string | null; contractId: string | null }> {
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, subject, description, person_id, contract_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) return { text: "", personId: null, contractId: null };

  // Get messages
  const { data: messages } = await supabase
    .from("support_ticket_messages")
    .select("content, sender_type, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
    .limit(20);

  let fullText = `Assunto: ${ticket.subject || ""}\n`;
  fullText += `Descrição: ${ticket.description || ""}\n\n`;

  if (messages && messages.length > 0) {
    fullText += "Mensagens:\n";
    for (const msg of messages) {
      fullText += `[${msg.sender_type}]: ${msg.content}\n`;
    }
  }

  return { text: fullText, personId: ticket.person_id, contractId: ticket.contract_id };
}

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

    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.tenant_id) return new Response(JSON.stringify({ error: "No tenant" }), { status: 400, headers: cors });

    const tenantId = profile.tenant_id;
    const body = await req.json();
    const { mode = "analyze", text, person_id, contract_id, ticket_id, source_type = "manual" } = body;

    const startTime = Date.now();
    let sourceText = "";
    let personId = person_id;
    let contractId = contract_id;

    // Resolve text based on mode
    if (mode === "scan_ticket" && ticket_id) {
      const ticketData = await getTicketText(serviceSupabase, ticket_id);
      sourceText = ticketData.text;
      personId = personId || ticketData.personId;
      contractId = contractId || ticketData.contractId;
    } else if (mode === "analyze" && text) {
      sourceText = text;
    } else if (mode === "batch" && person_id) {
      // Get recent unanalyzed tickets
      const { data: tickets } = await serviceSupabase
        .from("support_tickets")
        .select("id, subject, description, created_at")
        .eq("tenant_id", tenantId)
        .eq("person_id", person_id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!tickets || tickets.length === 0) {
        return new Response(JSON.stringify({ success: true, results: [], message: "No tickets to analyze" }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Analyze each ticket sequentially
      const results = [];
      for (const ticket of tickets) {
        const ticketData = await getTicketText(serviceSupabase, ticket.id);
        if (!ticketData.text.trim()) continue;

        try {
          const result = await analyzeAndSave({
            serviceSupabase,
            tenantId,
            personId: person_id,
            contractId: ticketData.contractId,
            ticketId: ticket.id,
            sourceText: ticketData.text,
            sourceType: "ticket",
            userId: user.id,
          });
          results.push(result);
        } catch (e) {
          console.error(`Error analyzing ticket ${ticket.id}:`, e);
        }
      }

      return new Response(JSON.stringify({ success: true, results, count: results.length }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode or missing params" }), { status: 400, headers: cors });
    }

    if (!sourceText.trim()) {
      return new Response(JSON.stringify({ error: "No text to analyze" }), { status: 400, headers: cors });
    }

    if (!personId) {
      return new Response(JSON.stringify({ error: "person_id required" }), { status: 400, headers: cors });
    }

    const result = await analyzeAndSave({
      serviceSupabase,
      tenantId,
      personId,
      contractId,
      ticketId: ticket_id,
      sourceText,
      sourceType: mode === "scan_ticket" ? "ticket" : source_type,
      userId: user.id,
    });

    return new Response(JSON.stringify({ success: true, ...result }), {
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

// ── Core analyze + save function ────────────────────────────
async function analyzeAndSave(opts: {
  serviceSupabase: any;
  tenantId: string;
  personId: string;
  contractId?: string;
  ticketId?: string;
  sourceText: string;
  sourceType: string;
  userId: string;
}) {
  const { serviceSupabase, tenantId, personId, contractId, ticketId, sourceText, sourceType, userId } = opts;
  const startTime = Date.now();

  // Check first contact
  const firstContact = await isFirstContact(serviceSupabase, tenantId, personId);

  // Get person name for context
  const { data: person } = await serviceSupabase
    .from("people")
    .select("name, type")
    .eq("id", personId)
    .maybeSingle();

  // Build prompt
  let prompt = `Analise o sentimento da seguinte comunicação de um cliente:\n\n`;
  prompt += `**Cliente:** ${person?.name || "N/A"} (${person?.type || "N/A"})\n`;
  if (firstContact) {
    prompt += `**ATENÇÃO: Este é o PRIMEIRO CONTATO deste cliente.** Dê atenção especial à primeira impressão.\n`;
  }
  prompt += `**Tipo:** ${sourceType}\n\n`;
  prompt += `---\n${sourceText.slice(0, 5000)}\n---\n\n`;
  prompt += `Analise profundamente o sentimento, emoções, intenções e urgência. Gere uma resposta sugerida que seja profissional, empática e adequada ao contexto do mercado imobiliário brasileiro.`;

  // Resolve persona & call AI
  const persona = await resolvePersona("sentiment_analyzer", tenantId);

  const aiResponse = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [SENTIMENT_TOOL],
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["sentiment_analysis_result"] } },
  });

  if (!aiResponse.ok) {
    throw new Error(`AI error: ${await aiResponse.text()}`);
  }

  const aiData = await aiResponse.json();
  const fnCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;

  if (!fnCall || fnCall.name !== "sentiment_analysis_result") {
    throw new Error("Unexpected AI response format");
  }

  const result = fnCall.args;

  // Check auto-escalation thresholds
  let requiresEscalation = result.requires_escalation || false;
  let escalationReason = result.escalation_reason || "";

  if (result.sentiment_score <= ESCALATION_THRESHOLDS.sentiment_score) {
    requiresEscalation = true;
    escalationReason = `Sentimento muito negativo (score: ${result.sentiment_score})`;
  }
  if (result.urgency_score >= ESCALATION_THRESHOLDS.urgency_score) {
    requiresEscalation = true;
    escalationReason = escalationReason
      ? `${escalationReason} + Urgência alta (${result.urgency_score})`
      : `Urgência alta (score: ${result.urgency_score})`;
  }
  const churnIntent = (result.detected_intents || []).find((i: any) => i.intent === "churn_signal");
  if (churnIntent && churnIntent.confidence >= ESCALATION_THRESHOLDS.churn_intent_confidence) {
    requiresEscalation = true;
    escalationReason = escalationReason
      ? `${escalationReason} + Sinal de churn (${churnIntent.confidence}%)`
      : `Sinal de churn detectado (confiança: ${churnIntent.confidence}%)`;
  }

  // Save to DB
  const analysisData = {
    tenant_id: tenantId,
    person_id: personId,
    contract_id: contractId || null,
    ticket_id: ticketId || null,
    source_type: sourceType,
    source_text: sourceText.slice(0, 10000),
    overall_sentiment: result.overall_sentiment,
    sentiment_score: result.sentiment_score,
    confidence: result.confidence,
    emotions: result.emotions || [],
    detected_intents: result.detected_intents || [],
    key_phrases: result.key_phrases || [],
    topics: result.topics || [],
    urgency_level: result.urgency_level,
    urgency_score: result.urgency_score,
    recommended_response_tone: result.recommended_response_tone,
    recommended_actions: result.recommended_actions || [],
    ai_suggested_response: result.ai_suggested_response,
    requires_escalation: requiresEscalation,
    escalation_reason: escalationReason || null,
    is_first_contact: firstContact,
  };

  const { data: saved, error: saveErr } = await serviceSupabase
    .from("sentiment_analyses")
    .insert(analysisData)
    .select("id")
    .single();

  if (saveErr) throw new Error(`Save error: ${saveErr.message}`);

  // Create escalation if needed
  let escalationId = null;
  if (requiresEscalation) {
    const { data: esc } = await serviceSupabase
      .from("sentiment_escalations")
      .insert({
        tenant_id: tenantId,
        sentiment_analysis_id: saved.id,
        person_id: personId,
        escalation_type: "auto",
        trigger_reason: escalationReason,
        priority: result.urgency_level === "critical" ? "critical" : result.urgency_level === "high" ? "high" : "medium",
        status: "pending",
      })
      .select("id")
      .single();
    escalationId = esc?.id;
  }

  // Log interaction
  const responseTimeMs = Date.now() - startTime;
  logInteraction({
    tenantId,
    userId,
    functionKey: "sentiment_analyzer",
    inputSummary: `Sentiment for ${person?.name} (${sourceType}) — ${firstContact ? "FIRST CONTACT" : "returning"}`,
    outputSummary: `${result.overall_sentiment} (${result.sentiment_score}) | Urgency: ${result.urgency_level} | Escalation: ${requiresEscalation}`,
    responseTimeMs,
  }).catch(() => {});

  return {
    analysis_id: saved.id,
    escalation_id: escalationId,
    person: { id: personId, name: person?.name },
    is_first_contact: firstContact,
    sentiment: {
      overall: result.overall_sentiment,
      score: result.sentiment_score,
      confidence: result.confidence,
    },
    emotions: result.emotions,
    intents: result.detected_intents,
    urgency: {
      level: result.urgency_level,
      score: result.urgency_score,
    },
    recommended_response_tone: result.recommended_response_tone,
    recommended_actions: result.recommended_actions,
    ai_suggested_response: result.ai_suggested_response,
    escalation: requiresEscalation ? {
      id: escalationId,
      reason: escalationReason,
      priority: result.urgency_level === "critical" ? "critical" : result.urgency_level === "high" ? "high" : "medium",
    } : null,
    meta: { response_time_ms: responseTimeMs },
  };
}
