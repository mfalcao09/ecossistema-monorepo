/**
 * relationship-concierge-ai — v1
 * F4: IntelliHome Concierge Multimodal
 *
 * 9 actions:
 *   - chat: Multi-turn conversation with RAG + memory + tool use
 *   - create_ticket: Create maintenance/support ticket from conversation
 *   - lookup_contract: Query active contract details for a person
 *   - lookup_payments: Query payment history / pending for a person
 *   - search_kb: Search knowledge base for FAQs and procedures
 *   - save_memory: Save/update concierge memory for a person
 *   - get_memory: Read concierge memories for a person
 *   - escalate: Escalate conversation to human agent
 *   - list_conversations: List conversations for a person/tenant
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

// ── AI Tool Declarations ────────────────────────────────────
const CONCIERGE_CHAT_TOOL = [
  {
    functionDeclarations: [
      {
        name: "concierge_response",
        description: "Structured concierge response with message, detected intent, suggested actions, and escalation flag",
        parameters: {
          type: "OBJECT",
          properties: {
            response_message: {
              type: "STRING",
              description: "Mensagem de resposta para o morador, em tom caloroso e profissional",
            },
            detected_intent: {
              type: "STRING",
              description: "Intenção detectada: greeting, maintenance_request, payment_query, contract_query, complaint, information_request, scheduling, escalation_request, farewell, other",
            },
            confidence: {
              type: "NUMBER",
              description: "Confiança na detecção de intenção (0-100)",
            },
            suggested_actions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  action_type: {
                    type: "STRING",
                    description: "Tipo: create_ticket, lookup_contract, lookup_payments, search_kb, schedule_visit, escalate_human",
                  },
                  action_label: { type: "STRING", description: "Label amigável para o botão de ação" },
                  action_params: { type: "STRING", description: "JSON string com parâmetros da ação" },
                  priority: { type: "STRING", description: "alta, media, baixa" },
                },
                required: ["action_type", "action_label"],
              },
              description: "Ações sugeridas baseadas na conversa",
            },
            should_escalate: {
              type: "BOOLEAN",
              description: "Se deve escalar para atendente humano",
            },
            escalation_reason: {
              type: "STRING",
              description: "Motivo da escalação (se should_escalate = true)",
            },
            sentiment: {
              type: "STRING",
              description: "Sentimento detectado: positive, neutral, negative, frustrated, urgent",
            },
            memory_updates: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  memory_key: { type: "STRING", description: "Chave da memória (ex: preferred_channel, issue_history)" },
                  memory_type: { type: "STRING", description: "preference, issue_history, context, sentiment, interaction_style, property_note, personal_note, ai_insight" },
                  memory_value: { type: "STRING", description: "Valor a salvar" },
                },
                required: ["memory_key", "memory_type", "memory_value"],
              },
              description: "Memórias a salvar/atualizar baseadas nesta interação",
            },
          },
          required: ["response_message", "detected_intent", "confidence", "sentiment"],
        },
      },
    ],
  },
];

const TICKET_TOOL = [
  {
    functionDeclarations: [
      {
        name: "ticket_creation_result",
        description: "Structured ticket creation with categorization and priority",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Título do chamado (claro e conciso)" },
            description: { type: "STRING", description: "Descrição detalhada do problema/solicitação" },
            category: {
              type: "STRING",
              description: "Categoria: manutencao, financeiro, contrato, reclamacao, solicitacao, emergencia, outro",
            },
            priority: { type: "STRING", description: "Prioridade: urgent, high, medium, low" },
            is_urgent: { type: "BOOLEAN", description: "Se é emergência (vazamento, segurança, etc)" },
            suggested_response: { type: "STRING", description: "Mensagem para confirmar abertura do ticket ao morador" },
          },
          required: ["title", "description", "category", "priority", "is_urgent", "suggested_response"],
        },
      },
    ],
  },
];

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // Auth
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Missing auth token" }), { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceSupabase = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: cors });

    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("id, tenant_id, role, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.tenant_id) return new Response(JSON.stringify({ error: "Profile/tenant not found" }), { status: 403, headers: cors });

    const { tenant_id: tenantId } = profile;
    const body = await req.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case "chat":
        result = await handleChat(serviceSupabase, tenantId, profile, body);
        break;
      case "create_ticket":
        result = await handleCreateTicket(serviceSupabase, tenantId, profile, body);
        break;
      case "lookup_contract":
        result = await handleLookupContract(serviceSupabase, tenantId, body);
        break;
      case "lookup_payments":
        result = await handleLookupPayments(serviceSupabase, tenantId, body);
        break;
      case "search_kb":
        result = await handleSearchKB(serviceSupabase, tenantId, body);
        break;
      case "save_memory":
        result = await handleSaveMemory(serviceSupabase, tenantId, body);
        break;
      case "get_memory":
        result = await handleGetMemory(serviceSupabase, tenantId, body);
        break;
      case "escalate":
        result = await handleEscalate(serviceSupabase, tenantId, profile, body);
        break;
      case "list_conversations":
        result = await handleListConversations(serviceSupabase, tenantId, body);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: cors });
    }

    // Log interaction (fire-and-forget)
    logInteraction({
      tenantId,
      userId: profile.id,
      functionKey: "concierge_ai",
      inputSummary: `action=${action} ${body.person_id ? `person=${body.person_id}` : ""}`.trim(),
      outputSummary: result?.detected_intent || result?.status || "ok",
    }).catch(() => {});

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("relationship-concierge-ai error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

// ── Chat Handler (main agentic flow) ────────────────────────
async function handleChat(
  db: any,
  tenantId: string,
  profile: any,
  body: any,
) {
  const { person_id, message, conversation_id, channel = "portal" } = body;
  if (!person_id || !message) throw new Error("person_id and message are required");

  const startMs = Date.now();

  // 1. Fetch context in parallel
  const [personData, memories, conversation, contractInfo, recentTickets, kbSnippets] = await Promise.all([
    fetchPersonData(db, tenantId, person_id),
    fetchMemories(db, tenantId, person_id),
    conversation_id ? fetchConversation(db, tenantId, conversation_id) : null,
    fetchActiveContract(db, tenantId, person_id),
    fetchRecentTickets(db, tenantId, person_id),
    fetchKBSnippets(db, tenantId),
  ]);

  // 2. Build context prompt
  const contextParts: string[] = [];

  if (personData) {
    contextParts.push(`MORADOR: ${personData.name || "Desconhecido"}${personData.email ? ` (${personData.email})` : ""}${personData.phone ? ` | Tel: ${personData.phone}` : ""}`);
  }

  if (contractInfo) {
    contextParts.push(`CONTRATO ATIVO: ${contractInfo.property_name || "Imóvel"} | Valor: R$${contractInfo.rent_value || "N/A"}/mês | Vencimento: ${contractInfo.end_date || "N/A"} | Status: ${contractInfo.status || "N/A"}`);
  }

  if (memories && memories.length > 0) {
    const memStr = memories.map((m: any) => `- ${m.memory_key}: ${m.memory_value}`).join("\n");
    contextParts.push(`MEMÓRIA DO MORADOR:\n${memStr}`);
  }

  if (recentTickets && recentTickets.length > 0) {
    const tickStr = recentTickets.map((t: any) => `- [${t.status}] ${t.title} (${new Date(t.created_at).toLocaleDateString("pt-BR")})`).join("\n");
    contextParts.push(`TICKETS RECENTES:\n${tickStr}`);
  }

  if (kbSnippets) {
    contextParts.push(`BASE DE CONHECIMENTO:\n${kbSnippets}`);
  }

  // 3. Build conversation history
  const existingMessages = conversation?.messages || [];
  const conversationHistory = existingMessages.slice(-20); // Last 20 messages for context

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  // Add context as first user message
  if (contextParts.length > 0) {
    contents.push({
      role: "user",
      parts: [{ text: `[CONTEXTO DO SISTEMA - NÃO MOSTRAR AO MORADOR]\n${contextParts.join("\n\n")}` }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "Entendido. Tenho o contexto do morador carregado. Vou usar essas informações para personalizar o atendimento." }],
    });
  }

  // Add conversation history
  for (const msg of conversationHistory) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  // Add new message
  contents.push({
    role: "user",
    parts: [{ text: message }],
  });

  // 4. Call AI
  const persona = await resolvePersona("concierge_ai", tenantId);
  const aiResp = await callGemini({
    persona,
    contents,
    tools: CONCIERGE_CHAT_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY" } },
  });

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    console.error("Gemini error:", errText);
    throw new Error("AI call failed");
  }

  const aiData = await aiResp.json();
  const fc = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;

  let aiResult: any;
  if (fc?.name === "concierge_response") {
    aiResult = fc.args;
  } else {
    // Fallback: use text response
    const textResp = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui processar sua mensagem. Pode tentar novamente?";
    aiResult = {
      response_message: textResp,
      detected_intent: "other",
      confidence: 50,
      sentiment: "neutral",
      suggested_actions: [],
      should_escalate: false,
      memory_updates: [],
    };
  }

  // 5. Save/update conversation
  const newMessages = [
    ...existingMessages,
    { role: "user", content: message, timestamp: new Date().toISOString() },
    { role: "assistant", content: aiResult.response_message, timestamp: new Date().toISOString(), intent: aiResult.detected_intent },
  ];

  let convId = conversation_id;
  if (convId) {
    await db.from("concierge_conversations").update({
      messages: newMessages,
      last_message_at: new Date().toISOString(),
      message_count: newMessages.length,
      ai_context: { last_intent: aiResult.detected_intent, sentiment: aiResult.sentiment },
    }).eq("id", convId).eq("tenant_id", tenantId);
  } else {
    const { data: newConv } = await db.from("concierge_conversations").insert({
      tenant_id: tenantId,
      person_id,
      channel,
      status: aiResult.should_escalate ? "waiting_human" : "active",
      messages: newMessages,
      last_message_at: new Date().toISOString(),
      message_count: newMessages.length,
      ai_context: { last_intent: aiResult.detected_intent, sentiment: aiResult.sentiment },
      started_by: "person",
    }).select("id").maybeSingle();
    convId = newConv?.id;
  }

  // 6. Save memory updates (fire-and-forget)
  if (aiResult.memory_updates && aiResult.memory_updates.length > 0) {
    for (const mem of aiResult.memory_updates) {
      db.from("concierge_memory")
        .upsert({
          tenant_id: tenantId,
          person_id,
          memory_key: mem.memory_key,
          memory_type: mem.memory_type,
          memory_value: mem.memory_value,
          last_accessed_at: new Date().toISOString(),
          access_count: 1,
        }, { onConflict: "tenant_id,person_id,memory_key" })
        .then(() => {})
        .catch((e: any) => console.error("Memory save error:", e));
    }
  }

  // 7. Auto-escalate if needed
  if (aiResult.should_escalate && convId) {
    await db.from("concierge_conversations").update({
      status: "waiting_human",
      escalated_at: new Date().toISOString(),
      escalation_reason: aiResult.escalation_reason || "AI detected need for human intervention",
    }).eq("id", convId).eq("tenant_id", tenantId);
  }

  return {
    conversation_id: convId,
    response_message: aiResult.response_message,
    detected_intent: aiResult.detected_intent,
    confidence: aiResult.confidence,
    sentiment: aiResult.sentiment,
    suggested_actions: aiResult.suggested_actions || [],
    should_escalate: aiResult.should_escalate || false,
    escalation_reason: aiResult.escalation_reason,
    response_time_ms: Date.now() - startMs,
  };
}

// ── Create Ticket Handler ───────────────────────────────────
async function handleCreateTicket(
  db: any,
  tenantId: string,
  profile: any,
  body: any,
) {
  const { person_id, conversation_id, user_message } = body;
  if (!person_id) throw new Error("person_id is required");

  // If user_message provided, use AI to categorize
  if (user_message) {
    const persona = await resolvePersona("concierge_ai", tenantId);
    const aiResp = await callGemini({
      persona,
      contents: [
        {
          role: "user",
          parts: [{ text: `O morador relatou o seguinte problema/solicitação. Crie um ticket de suporte estruturado:\n\n"${user_message}"` }],
        },
      ],
      tools: TICKET_TOOL,
      toolConfig: { functionCallingConfig: { mode: "ANY" } },
    });

    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const fc = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;
      if (fc?.name === "ticket_creation_result") {
        const ticket = fc.args;

        // Map category to support_tickets format
        const priorityMap: Record<string, string> = { urgent: "urgent", high: "high", medium: "medium", low: "low" };

        const { data: newTicket } = await db.from("support_tickets").insert({
          tenant_id: tenantId,
          person_id,
          title: ticket.title,
          description: ticket.description,
          category: ticket.category,
          priority: priorityMap[ticket.priority] || "medium",
          status: "open",
          source: "concierge_ai",
          created_by: profile.id,
        }).select("id, title, status, priority").maybeSingle();

        // Link ticket to conversation
        if (conversation_id && newTicket) {
          await db.from("concierge_conversations").update({
            linked_ticket_id: newTicket.id,
            actions_taken: [{ type: "ticket_created", ticket_id: newTicket.id, at: new Date().toISOString() }],
          }).eq("id", conversation_id).eq("tenant_id", tenantId);
        }

        return {
          ticket: newTicket,
          ai_categorization: {
            category: ticket.category,
            priority: ticket.priority,
            is_urgent: ticket.is_urgent,
          },
          suggested_response: ticket.suggested_response,
        };
      }
    }
  }

  // Fallback: create basic ticket from body params
  const { title, description, category = "solicitacao", priority = "medium" } = body;
  if (!title) throw new Error("title is required when no user_message provided");

  const { data: newTicket } = await db.from("support_tickets").insert({
    tenant_id: tenantId,
    person_id,
    title,
    description: description || "",
    category,
    priority,
    status: "open",
    source: "concierge_ai",
    created_by: profile.id,
  }).select("id, title, status, priority").maybeSingle();

  return { ticket: newTicket, suggested_response: `Chamado "${title}" criado com sucesso! Acompanhe pelo número #${newTicket?.id?.slice(0, 8)}.` };
}

// ── Lookup Contract Handler ─────────────────────────────────
async function handleLookupContract(db: any, tenantId: string, body: any) {
  const { person_id } = body;
  if (!person_id) throw new Error("person_id is required");

  const { data: contracts } = await db
    .from("contracts")
    .select("id, property_id, status, start_date, end_date, monthly_value, contract_type, payment_due_day, readjustment_index, readjustment_date, guarantor_info, clauses_summary, properties(name, address, property_type)")
    .eq("tenant_id", tenantId)
    .or(`tenant_person_id.eq.${person_id},buyer_person_id.eq.${person_id}`)
    .in("status", ["active", "pending_renewal", "expiring"])
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    contracts: (contracts || []).map((c: any) => ({
      id: c.id,
      property_name: c.properties?.name || "N/A",
      property_address: c.properties?.address || "N/A",
      property_type: c.properties?.property_type || "N/A",
      status: c.status,
      start_date: c.start_date,
      end_date: c.end_date,
      monthly_value: c.monthly_value,
      contract_type: c.contract_type,
      payment_due_day: c.payment_due_day,
      readjustment_index: c.readjustment_index,
      readjustment_date: c.readjustment_date,
    })),
    count: contracts?.length || 0,
  };
}

// ── Lookup Payments Handler ─────────────────────────────────
async function handleLookupPayments(db: any, tenantId: string, body: any) {
  const { person_id, months = 6 } = body;
  if (!person_id) throw new Error("person_id is required");

  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - months);

  const { data: payments } = await db
    .from("financial_transactions")
    .select("id, type, amount, due_date, paid_date, status, description, payment_method")
    .eq("tenant_id", tenantId)
    .eq("person_id", person_id)
    .gte("due_date", sinceDate.toISOString())
    .order("due_date", { ascending: false })
    .limit(20);

  const paid = (payments || []).filter((p: any) => p.status === "paid");
  const pending = (payments || []).filter((p: any) => p.status === "pending");
  const overdue = (payments || []).filter((p: any) => p.status === "overdue");

  return {
    payments: payments || [],
    summary: {
      total: payments?.length || 0,
      paid: paid.length,
      pending: pending.length,
      overdue: overdue.length,
      total_paid: paid.reduce((s: number, p: any) => s + (p.amount || 0), 0),
      total_pending: pending.reduce((s: number, p: any) => s + (p.amount || 0), 0),
      total_overdue: overdue.reduce((s: number, p: any) => s + (p.amount || 0), 0),
    },
  };
}

// ── Search Knowledge Base Handler ───────────────────────────
async function handleSearchKB(db: any, tenantId: string, body: any) {
  const { query, limit = 10 } = body;
  if (!query) throw new Error("query is required");

  const terms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);

  // Simple text search — ilike on title + content
  let q = db
    .from("ai_knowledge_base")
    .select("id, title, content, category, tags")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (terms.length > 0) {
    const orClauses = terms.map((t: string) => `title.ilike.%${t}%,content.ilike.%${t}%`).join(",");
    q = q.or(orClauses);
  }

  const { data: results } = await q
    .order("relevance_score", { ascending: false })
    .limit(limit);

  return {
    results: (results || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      category: r.category,
      tags: r.tags,
    })),
    count: results?.length || 0,
  };
}

// ── Save Memory Handler ─────────────────────────────────────
async function handleSaveMemory(db: any, tenantId: string, body: any) {
  const { person_id, memory_key, memory_type = "context", memory_value } = body;
  if (!person_id || !memory_key || !memory_value) throw new Error("person_id, memory_key, memory_value required");

  const { data, error } = await db.from("concierge_memory").upsert({
    tenant_id: tenantId,
    person_id,
    memory_key,
    memory_type,
    memory_value,
    last_accessed_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,person_id,memory_key" }).select("id, memory_key, memory_type").maybeSingle();

  if (error) throw new Error(`Memory save failed: ${error.message}`);
  return { memory: data, status: "saved" };
}

// ── Get Memory Handler ──────────────────────────────────────
async function handleGetMemory(db: any, tenantId: string, body: any) {
  const { person_id, memory_type } = body;
  if (!person_id) throw new Error("person_id is required");

  let q = db
    .from("concierge_memory")
    .select("id, memory_key, memory_type, memory_value, relevance_score, access_count, last_accessed_at, created_at")
    .eq("tenant_id", tenantId)
    .eq("person_id", person_id);

  if (memory_type) q = q.eq("memory_type", memory_type);

  const { data: memories } = await q
    .order("relevance_score", { ascending: false })
    .order("last_accessed_at", { ascending: false })
    .limit(50);

  // Update access timestamps (fire-and-forget)
  if (memories && memories.length > 0) {
    for (const m of memories) {
      db.from("concierge_memory").update({
        last_accessed_at: new Date().toISOString(),
        access_count: (m.access_count || 0) + 1,
      }).eq("id", m.id).then(() => {}).catch(() => {});
    }
  }

  return { memories: memories || [], count: memories?.length || 0 };
}

// ── Escalate Handler ────────────────────────────────────────
async function handleEscalate(db: any, tenantId: string, profile: any, body: any) {
  const { conversation_id, reason = "Solicitação de atendimento humano" } = body;
  if (!conversation_id) throw new Error("conversation_id is required");

  const { data: conv } = await db.from("concierge_conversations").update({
    status: "escalated",
    escalated_at: new Date().toISOString(),
    escalation_reason: reason,
    assigned_to: null, // Will be picked up by next available agent
  }).eq("id", conversation_id).eq("tenant_id", tenantId).select("id, status, person_id").maybeSingle();

  if (!conv) throw new Error("Conversation not found");

  // Add system message to conversation
  const { data: existing } = await db.from("concierge_conversations")
    .select("messages")
    .eq("id", conversation_id)
    .maybeSingle();

  const messages = existing?.messages || [];
  messages.push({
    role: "system",
    content: `Conversa escalada para atendimento humano. Motivo: ${reason}`,
    timestamp: new Date().toISOString(),
  });

  await db.from("concierge_conversations").update({ messages }).eq("id", conversation_id);

  return {
    conversation_id: conv.id,
    status: "escalated",
    message: "Sua conversa foi encaminhada para um atendente. Em breve alguém entrará em contato.",
  };
}

// ── List Conversations Handler ──────────────────────────────
async function handleListConversations(db: any, tenantId: string, body: any) {
  const { person_id, status, limit = 20, offset = 0 } = body;

  let q = db
    .from("concierge_conversations")
    .select("id, person_id, channel, status, message_count, last_message_at, started_by, escalated_at, resolved_at, satisfaction_rating, people(name, email)")
    .eq("tenant_id", tenantId);

  if (person_id) q = q.eq("person_id", person_id);
  if (status) q = q.eq("status", status);

  const { data: conversations } = await q
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return {
    conversations: (conversations || []).map((c: any) => ({
      id: c.id,
      person_id: c.person_id,
      person_name: c.people?.name || "N/A",
      person_email: c.people?.email,
      channel: c.channel,
      status: c.status,
      message_count: c.message_count,
      last_message_at: c.last_message_at,
      started_by: c.started_by,
      escalated_at: c.escalated_at,
      resolved_at: c.resolved_at,
      satisfaction_rating: c.satisfaction_rating,
    })),
    count: conversations?.length || 0,
  };
}

// ── Data Fetchers ───────────────────────────────────────────
async function fetchPersonData(db: any, tenantId: string, personId: string) {
  const { data } = await db
    .from("people")
    .select("id, name, email, phone, type, document, notes")
    .eq("tenant_id", tenantId)
    .eq("id", personId)
    .maybeSingle();
  return data;
}

async function fetchMemories(db: any, tenantId: string, personId: string) {
  const { data } = await db
    .from("concierge_memory")
    .select("memory_key, memory_type, memory_value, relevance_score")
    .eq("tenant_id", tenantId)
    .eq("person_id", personId)
    .order("relevance_score", { ascending: false })
    .limit(20);
  return data || [];
}

async function fetchConversation(db: any, tenantId: string, convId: string) {
  const { data } = await db
    .from("concierge_conversations")
    .select("id, messages, status, channel, ai_context")
    .eq("tenant_id", tenantId)
    .eq("id", convId)
    .maybeSingle();
  return data;
}

async function fetchActiveContract(db: any, tenantId: string, personId: string) {
  const { data } = await db
    .from("contracts")
    .select("id, status, start_date, end_date, monthly_value, contract_type, payment_due_day, readjustment_index, properties(name, address)")
    .eq("tenant_id", tenantId)
    .or(`tenant_person_id.eq.${personId},buyer_person_id.eq.${personId}`)
    .in("status", ["active", "pending_renewal"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    ...data,
    property_name: data.properties?.name,
    rent_value: data.monthly_value,
  };
}

async function fetchRecentTickets(db: any, tenantId: string, personId: string) {
  const { data } = await db
    .from("support_tickets")
    .select("id, title, status, priority, category, created_at")
    .eq("tenant_id", tenantId)
    .eq("person_id", personId)
    .order("created_at", { ascending: false })
    .limit(5);
  return data || [];
}

async function fetchKBSnippets(db: any, tenantId: string) {
  const { data } = await db
    .from("ai_knowledge_base")
    .select("title, content")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .or("function_key.eq.concierge_ai,function_key.is.null")
    .order("relevance_score", { ascending: false })
    .limit(8);

  if (!data || data.length === 0) return null;

  let result = "";
  for (const s of data) {
    const entry = `• ${s.title}: ${s.content}\n`;
    if (result.length + entry.length > 2000) break;
    result += entry;
  }
  return result.trim() || null;
}
