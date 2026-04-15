/**
 * commercial-lead-chatbot v1
 * Chatbot IA conversacional para qualificação de leads imobiliários.
 *
 * 4 actions:
 *   - chat:              Mensagem conversacional com contexto do lead (streaming-ready)
 *   - qualify:           Qualificação automática BANT com scoring + recomendações
 *   - get_conversations: Lista conversas de um lead
 *   - get_messages:      Mensagens de uma conversa
 *
 * Self-contained: inline CORS, auth/tenant resolution, Gemini 2.0 Flash via OpenRouter.
 * Persiste conversas e mensagens em lead_chatbot_conversations + lead_chatbot_messages.
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
  let allowOrigin = "";
  if (PROD_ORIGINS.includes(origin)) {
    allowOrigin = origin;
  } else if (
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    /^https:\/\/intentus-plataform-.+\.vercel\.app$/.test(origin)
  ) {
    allowOrigin = origin;
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin || PROD_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ─── Auth helpers ────────────────────────────────────────────────────────────
function getSupabaseClients(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") ?? "";
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  const adminClient = createClient(url, service);
  return { userClient, adminClient };
}

async function resolveAuth(req: Request) {
  const { userClient, adminClient } = getSupabaseClients(req);
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: profile } = await adminClient
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Sem empresa vinculada");

  return { user, tenantId: profile.tenant_id, adminClient };
}

// ─── AI call ─────────────────────────────────────────────────────────────────
async function callAI(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  jsonMode = false,
): Promise<string> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const body: Record<string, unknown> = {
    model: "google/gemini-2.0-flash-001",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.4,
    max_tokens: 2048,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://app.intentusrealestate.com.br",
      "X-Title": "Intentus Lead Chatbot",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error("OpenRouter error:", resp.status, err);
    throw new Error(`AI error: ${resp.status}`);
  }

  const data = await resp.json();
  return (
    data.choices?.[0]?.message?.content ||
    "Desculpe, não consegui processar sua mensagem."
  );
}

// ─── Lead context builder ────────────────────────────────────────────────────
async function buildLeadContext(
  adminClient: ReturnType<typeof createClient>,
  leadId: string,
  tenantId: string,
): Promise<string> {
  // Fetch lead
  const { data: lead } = await adminClient
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .single();

  if (!lead) return "Lead não encontrado.";

  const parts: string[] = [
    `## Perfil do Lead`,
    `- Nome: ${lead.name}`,
    `- Email: ${lead.email || "N/A"}`,
    `- Telefone: ${lead.phone || "N/A"}`,
    `- Origem: ${lead.source}`,
    `- Status: ${lead.status}`,
    `- Interesse: ${lead.interest_type || "N/A"}`,
    `- Região preferida: ${lead.preferred_region || "N/A"}`,
    `- Orçamento: ${lead.budget_min ? `R$ ${lead.budget_min}` : "N/A"} - ${lead.budget_max ? `R$ ${lead.budget_max}` : "N/A"}`,
    `- Score: ${lead.lead_score ?? "Não avaliado"}/100`,
    `- Observações: ${lead.notes || "Nenhuma"}`,
    `- Criado em: ${lead.created_at}`,
    `- Último contato: ${lead.last_contact_at || "Nunca"}`,
  ];

  // Fetch interactions (if person_id linked)
  if (lead.person_id) {
    const { data: interactions } = await adminClient
      .from("interactions")
      .select("interaction_type, notes, created_at")
      .eq("person_id", lead.person_id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (interactions && interactions.length > 0) {
      parts.push(`\n## Últimas ${interactions.length} Interações`);
      for (const i of interactions) {
        parts.push(
          `- [${i.interaction_type}] ${i.created_at?.slice(0, 10)}: ${i.notes || "(sem notas)"}`,
        );
      }
    }
  }

  // Fetch property if linked
  if (lead.property_id) {
    const { data: prop } = await adminClient
      .from("properties")
      .select("title, city, neighborhood, area_total, property_type")
      .eq("id", lead.property_id)
      .single();
    if (prop) {
      parts.push(`\n## Imóvel de Interesse`);
      parts.push(
        `- ${prop.title} | ${prop.city}/${prop.neighborhood} | ${prop.area_total}m² | Tipo: ${prop.property_type}`,
      );
    }
  }

  return parts.join("\n");
}

// ─── System prompts ──────────────────────────────────────────────────────────
const CHAT_SYSTEM_PROMPT = `Você é o Assistente de Qualificação de Leads da Intentus Real Estate, uma plataforma SaaS para o mercado imobiliário brasileiro.

## Seu papel
- Ajudar corretores a qualificar leads de forma conversacional e natural
- Sugerir perguntas estratégicas para entender o perfil do cliente
- Identificar nível de urgência, capacidade financeira, necessidades e motivação
- Recomendar próximos passos baseados no perfil do lead

## Framework de qualificação (BANT adaptado para imobiliário)
- **Budget (Orçamento)**: Faixa de preço, forma de pagamento, financiamento
- **Authority (Decisor)**: Quem decide, se há cônjuge/sócio, se é investidor
- **Need (Necessidade)**: Tipo de imóvel, quartos, vagas, região, prazo
- **Timeline (Urgência)**: Quando precisa, se já visitou outros, se tem imóvel para vender

## Regras
- Responda SEMPRE em português brasileiro, de forma profissional mas amigável
- Use linguagem do mercado imobiliário BR (corretor, escritura, ITBI, financiamento, etc.)
- Seja conciso — máximo 3-4 parágrafos por resposta
- Se o lead parece qualificado (hot), sugira converter em negócio
- Se falta informação crítica, sugira a pergunta mais importante a fazer
- NÃO invente dados — use apenas o contexto fornecido
- Quando sugerir ações, seja específico (ex: "Ligue hoje às 14h", "Envie comparativo de 3 imóveis na Vila Madalena")`;

const QUALIFY_SYSTEM_PROMPT = `Você é um especialista em qualificação de leads do mercado imobiliário brasileiro.
Analise o perfil do lead e retorne um JSON com a seguinte estrutura:
{
  "qualification_score": 0-100,
  "qualification_level": "hot" | "warm" | "cold" | "unqualified",
  "bant_analysis": {
    "budget": { "score": 0-25, "status": "identified" | "partial" | "unknown", "notes": "..." },
    "authority": { "score": 0-25, "status": "decision_maker" | "influencer" | "unknown", "notes": "..." },
    "need": { "score": 0-25, "status": "clear" | "vague" | "unknown", "notes": "..." },
    "timeline": { "score": 0-25, "status": "urgent" | "medium" | "long_term" | "unknown", "notes": "..." }
  },
  "key_insights": ["..."],
  "recommended_actions": [{ "action": "...", "priority": "alta" | "media" | "baixa", "reason": "..." }],
  "missing_information": ["..."],
  "suggested_questions": ["..."],
  "conversion_probability": 0-100,
  "summary": "Resumo de 2-3 frases sobre o lead"
}`;

// ─── Action handlers ─────────────────────────────────────────────────────────

async function handleChat(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const leadId = body.lead_id as string;
  const message = body.message as string;
  let conversationId = body.conversation_id as string | null;

  if (!leadId || !message) {
    return { error: "lead_id and message are required", status: 400 };
  }

  // Build lead context
  const leadContext = await buildLeadContext(adminClient, leadId, tenantId);

  // Create or get conversation
  if (!conversationId) {
    const { data: conv, error: convErr } = await adminClient
      .from("lead_chatbot_conversations")
      .insert({
        tenant_id: tenantId,
        lead_id: leadId,
        started_by: userId,
        title: message.slice(0, 80),
      })
      .select("id")
      .single();
    if (convErr) throw convErr;
    conversationId = conv.id;
  }

  // Save user message
  await adminClient.from("lead_chatbot_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });

  // Fetch conversation history (last 20 messages for context)
  const { data: history } = await adminClient
    .from("lead_chatbot_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  // Build messages for AI
  const aiMessages = [
    { role: "user", content: `[CONTEXTO DO LEAD]\n${leadContext}` },
    ...(history || []).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  ];

  // Call AI
  const reply = await callAI(CHAT_SYSTEM_PROMPT, aiMessages);

  // Save assistant response
  await adminClient.from("lead_chatbot_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: reply,
  });

  // Update last_contact_at on lead (fire-and-forget)
  adminClient
    .from("leads")
    .update({ last_contact_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .then(() => {})
    .catch(() => {});

  return {
    data: {
      conversation_id: conversationId,
      reply,
      message_count: (history?.length || 0) + 2,
    },
  };
}

async function handleQualify(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const leadId = body.lead_id as string;
  if (!leadId) return { error: "lead_id is required", status: 400 };

  const leadContext = await buildLeadContext(adminClient, leadId, tenantId);

  // Also include recent chatbot conversation if exists
  let chatHistory = "";
  const { data: convs } = await adminClient
    .from("lead_chatbot_conversations")
    .select("id")
    .eq("lead_id", leadId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (convs && convs.length > 0) {
    const { data: msgs } = await adminClient
      .from("lead_chatbot_messages")
      .select("role, content")
      .eq("conversation_id", convs[0].id)
      .order("created_at", { ascending: true })
      .limit(30);

    if (msgs && msgs.length > 0) {
      chatHistory =
        "\n\n## Histórico de Conversa do Chatbot\n" +
        msgs
          .map(
            (m: { role: string; content: string }) =>
              `[${m.role}]: ${m.content.slice(0, 200)}`,
          )
          .join("\n");
    }
  }

  const fullContext = leadContext + chatHistory;

  let result: Record<string, unknown>;
  try {
    const aiReply = await callAI(
      QUALIFY_SYSTEM_PROMPT,
      [{ role: "user", content: fullContext }],
      true, // JSON mode
    );
    result = JSON.parse(aiReply);
  } catch {
    // Rule-based fallback
    result = buildRuleBasedQualification(leadContext);
  }

  // Save qualification result to the latest conversation (if exists)
  if (convs && convs.length > 0) {
    await adminClient
      .from("lead_chatbot_conversations")
      .update({ qualification_result: result, updated_at: new Date().toISOString() })
      .eq("id", convs[0].id);
  }

  return { data: result };
}

function buildRuleBasedQualification(
  context: string,
): Record<string, unknown> {
  const hasBudget = context.includes("Orçamento:") && !context.includes("N/A - N/A");
  const hasRegion = context.includes("Região preferida:") && !context.includes("Região preferida: N/A");
  const hasInterest = context.includes("Interesse:") && !context.includes("Interesse: N/A");
  const hasInteractions = context.includes("## Últimas");
  const hasProperty = context.includes("## Imóvel de Interesse");

  let score = 20;
  if (hasBudget) score += 20;
  if (hasRegion) score += 15;
  if (hasInterest) score += 10;
  if (hasInteractions) score += 15;
  if (hasProperty) score += 20;

  const level =
    score >= 70 ? "hot" : score >= 40 ? "warm" : score >= 20 ? "cold" : "unqualified";

  const missing: string[] = [];
  if (!hasBudget) missing.push("Faixa de orçamento do lead");
  if (!hasRegion) missing.push("Região de interesse");
  if (!hasInterest) missing.push("Tipo de imóvel desejado");
  if (!hasInteractions) missing.push("Histórico de interações");

  return {
    qualification_score: score,
    qualification_level: level,
    bant_analysis: {
      budget: {
        score: hasBudget ? 20 : 5,
        status: hasBudget ? "identified" : "unknown",
        notes: hasBudget ? "Orçamento informado" : "Sem informação de orçamento",
      },
      authority: { score: 15, status: "unknown", notes: "Necessário confirmar se é decisor" },
      need: {
        score: hasInterest ? 20 : 5,
        status: hasInterest ? "partial" : "unknown",
        notes: hasInterest ? "Interesse informado" : "Sem informação de necessidade",
      },
      timeline: { score: 10, status: "unknown", notes: "Urgência não avaliada" },
    },
    key_insights: ["Qualificação baseada em regras (modelo de IA indisponível)"],
    recommended_actions: [
      { action: "Entrar em contato para entender urgência", priority: "alta", reason: "Timeline não avaliada" },
    ],
    missing_information: missing,
    suggested_questions: [
      "Quando você pretende se mudar/investir?",
      "Vai financiar ou pagar à vista?",
      "Quem mais participa da decisão?",
    ],
    conversion_probability: Math.max(10, score - 10),
    summary: `Lead com score ${score}/100 (${level}). Análise por regras — ${missing.length} informações faltando.`,
    model_used: "rule_engine_v1",
  };
}

async function handleGetConversations(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const leadId = body.lead_id as string;
  if (!leadId) return { error: "lead_id is required", status: 400 };

  const { data, error } = await adminClient
    .from("lead_chatbot_conversations")
    .select("id, title, qualification_result, is_archived, created_at, updated_at")
    .eq("lead_id", leadId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return { data: data || [] };
}

async function handleGetMessages(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  body: Record<string, unknown>,
) {
  const conversationId = body.conversation_id as string;
  if (!conversationId) return { error: "conversation_id is required", status: 400 };

  // Verify conversation belongs to tenant
  const { data: conv } = await adminClient
    .from("lead_chatbot_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .single();

  if (!conv) return { error: "Conversa não encontrada", status: 404 };

  const { data, error } = await adminClient
    .from("lead_chatbot_messages")
    .select("id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) throw error;
  return { data: data || [] };
}

// ─── Main handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const { user, tenantId, adminClient } = await resolveAuth(req);
    const body = await req.json();
    const action = (body.action as string) || "chat";

    let result: { data?: unknown; error?: string; status?: number };

    switch (action) {
      case "chat":
        result = await handleChat(adminClient, user.id, tenantId, body);
        break;
      case "qualify":
        result = await handleQualify(adminClient, tenantId, body);
        break;
      case "get_conversations":
        result = await handleGetConversations(adminClient, tenantId, body);
        break;
      case "get_messages":
        result = await handleGetMessages(adminClient, tenantId, body);
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
    console.error("commercial-lead-chatbot error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro interno do chatbot",
      }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
