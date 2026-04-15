/**
 * relationship-life-events-engine — v1
 * F6: Proactive Life Events Engine
 *
 * 10 actions:
 *   - get_events: List life events for tenant (with filters)
 *   - add_event: Create manual life event
 *   - update_event: Update event status
 *   - get_rules: List event rules
 *   - add_rule: Create event rule
 *   - toggle_rule: Enable/disable rule
 *   - get_actions: Get actions for an event
 *   - scan_events: AI scans client data to detect new life events
 *   - generate_content: AI generates personalized content for an event
 *   - get_stats: Dashboard statistics
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
const LIFE_EVENTS_SCAN_TOOL = [
  {
    functionDeclarations: [
      {
        name: "detected_life_events",
        description: "Life events detected from client data analysis",
        parameters: {
          type: "OBJECT",
          properties: {
            events: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  event_type: { type: "STRING", description: "contract_anniversary|birthday|renewal_window|guarantee_expiry|payment_milestone|occupancy_anniversary|market_trigger|behavioral_pattern|seasonal|custom" },
                  event_category: { type: "STRING", description: "lifecycle|financial|behavioral|market|seasonal|relationship" },
                  title: { type: "STRING", description: "Título descritivo do evento" },
                  description: { type: "STRING", description: "Descrição detalhada" },
                  event_date: { type: "STRING", description: "Data do evento YYYY-MM-DD" },
                  priority: { type: "STRING", description: "low|medium|high|critical" },
                  recurrence: { type: "STRING", description: "none|yearly|monthly|quarterly" },
                  pattern_confidence: { type: "NUMBER", description: "Confiança do pattern matching 0-100" },
                  recommended_action: { type: "STRING", description: "Ação recomendada" },
                  recommended_channel: { type: "STRING", description: "email|whatsapp|call|offer" },
                  person_id: { type: "STRING", description: "UUID do cliente (person_id)" },
                  property_id: { type: "STRING", description: "UUID do imóvel se aplicável" },
                  contract_id: { type: "STRING", description: "UUID do contrato se aplicável" },
                },
                required: ["event_type", "event_category", "title", "description", "event_date", "priority"],
              },
            },
            summary: { type: "STRING", description: "Resumo da análise" },
            total_opportunities: { type: "NUMBER", description: "Total de oportunidades detectadas" },
          },
          required: ["events", "summary", "total_opportunities"],
        },
      },
    ],
  },
];

const CONTENT_GENERATION_TOOL = [
  {
    functionDeclarations: [
      {
        name: "generated_content",
        description: "Personalized content generated for a life event",
        parameters: {
          type: "OBJECT",
          properties: {
            subject: { type: "STRING", description: "Assunto do email/mensagem" },
            greeting: { type: "STRING", description: "Saudação personalizada" },
            body: { type: "STRING", description: "Corpo da mensagem" },
            call_to_action: { type: "STRING", description: "CTA principal" },
            closing: { type: "STRING", description: "Fechamento" },
            tone: { type: "STRING", description: "Tom usado: warm|professional|celebratory|urgent|informative" },
            personalization_score: { type: "NUMBER", description: "Score de personalização 0-100" },
            alternative_channels: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  channel: { type: "STRING", description: "email|whatsapp|sms" },
                  adapted_message: { type: "STRING", description: "Mensagem adaptada para o canal" },
                },
              },
            },
          },
          required: ["subject", "greeting", "body", "call_to_action", "closing", "tone", "personalization_score"],
        },
      },
    ],
  },
];

// ── Data Fetchers ────────────────────────────────────────────
async function fetchTenantClients(sb: any, tenantId: string, limit = 100) {
  const { data } = await sb
    .from("people")
    .select("id, name, email, phone, cpf, birth_date, created_at, metadata")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

async function fetchTenantContracts(sb: any, tenantId: string, limit = 200) {
  const { data } = await sb
    .from("contracts")
    .select("id, tenant_id, property_id, status, start_date, end_date, rent_value, contract_type, created_at, people_contracts(person_id, role)")
    .eq("tenant_id", tenantId)
    .in("status", ["ativo", "active", "vigente"])
    .order("start_date", { ascending: false })
    .limit(limit);
  return data || [];
}

async function fetchRecentPayments(sb: any, tenantId: string, limit = 500) {
  const { data } = await sb
    .from("payments")
    .select("id, contract_id, due_date, payment_date, amount, status")
    .eq("tenant_id", tenantId)
    .order("due_date", { ascending: false })
    .limit(limit);
  return data || [];
}

async function fetchExistingEvents(sb: any, tenantId: string) {
  const { data } = await sb
    .from("client_life_events")
    .select("id, person_id, event_type, event_date, status")
    .eq("tenant_id", tenantId)
    .in("status", ["upcoming", "triggered"])
    .order("event_date", { ascending: true });
  return data || [];
}

async function fetchEventWithDetails(sb: any, tenantId: string, eventId: string) {
  const { data } = await sb
    .from("client_life_events")
    .select("*, people(name, email, phone)")
    .eq("tenant_id", tenantId)
    .eq("id", eventId)
    .maybeSingle();
  return data;
}

async function fetchPersonContext(sb: any, tenantId: string, personId: string) {
  const [personRes, contractsRes, paymentsRes, ticketsRes] = await Promise.all([
    sb.from("people").select("*").eq("tenant_id", tenantId).eq("id", personId).maybeSingle(),
    sb.from("contracts").select("*, properties(address, neighborhood, city)").eq("tenant_id", tenantId).eq("people_contracts.person_id", personId),
    sb.from("payments").select("id, due_date, payment_date, amount, status, contract_id").eq("tenant_id", tenantId).order("due_date", { ascending: false }).limit(50),
    sb.from("tickets").select("id, title, status, priority, created_at").eq("tenant_id", tenantId).eq("person_id", personId).order("created_at", { ascending: false }).limit(20),
  ]);
  return {
    person: personRes.data,
    contracts: contractsRes.data || [],
    payments: paymentsRes.data || [],
    tickets: ticketsRes.data || [],
  };
}

// ── Main Handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers: cors });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const sbAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const { data: profile } = await sbAdmin
      .from("profiles")
      .select("id, tenant_id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.tenant_id) return new Response(JSON.stringify({ error: "No tenant" }), { status: 403, headers: cors });

    const tenantId = profile.tenant_id;
    const { action, ...params } = await req.json();

    // ─── GET_EVENTS ──────────────────────────────────────
    if (action === "get_events") {
      const { status: filterStatus, event_type, priority, person_id, limit: lim = 50 } = params;
      let q = sbAdmin
        .from("client_life_events")
        .select("*, people(name, email)")
        .eq("tenant_id", tenantId)
        .order("event_date", { ascending: true })
        .limit(lim);

      if (filterStatus) q = q.eq("status", filterStatus);
      if (event_type) q = q.eq("event_type", event_type);
      if (priority) q = q.eq("priority", priority);
      if (person_id) q = q.eq("person_id", person_id);

      const { data, error } = await q;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ events: data }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── ADD_EVENT ───────────────────────────────────────
    if (action === "add_event") {
      const { event_type, event_category, title, description, event_date, priority, recurrence, person_id, property_id, contract_id, tags } = params;
      const { data, error } = await sbAdmin
        .from("client_life_events")
        .insert({
          tenant_id: tenantId,
          event_type,
          event_category: event_category || "lifecycle",
          title,
          description,
          event_date,
          priority: priority || "medium",
          recurrence: recurrence || "none",
          next_occurrence: recurrence === "yearly" ? new Date(new Date(event_date).setFullYear(new Date(event_date).getFullYear() + 1)).toISOString().slice(0, 10) : null,
          person_id: person_id || null,
          property_id: property_id || null,
          contract_id: contract_id || null,
          tags: tags || [],
          ai_generated: false,
        })
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ event: data }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── UPDATE_EVENT ────────────────────────────────────
    if (action === "update_event") {
      const { event_id, status: newStatus, ...updates } = params;
      const updatePayload: any = { ...updates };
      if (newStatus) updatePayload.status = newStatus;

      const { data, error } = await sbAdmin
        .from("client_life_events")
        .update(updatePayload)
        .eq("tenant_id", tenantId)
        .eq("id", event_id)
        .select()
        .maybeSingle();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ event: data }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── GET_RULES ───────────────────────────────────────
    if (action === "get_rules") {
      const { data, error } = await sbAdmin
        .from("life_event_rules")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ rules: data }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── ADD_RULE ────────────────────────────────────────
    if (action === "add_rule") {
      const { name, description, rule_type, event_type, conditions, recommended_action, action_config, priority, cooldown_days } = params;
      const { data, error } = await sbAdmin
        .from("life_event_rules")
        .insert({
          tenant_id: tenantId,
          name,
          description,
          rule_type,
          event_type,
          conditions: conditions || {},
          recommended_action: recommended_action || "notify",
          action_config: action_config || {},
          priority: priority || "medium",
          cooldown_days: cooldown_days || 30,
        })
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ rule: data }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── TOGGLE_RULE ─────────────────────────────────────
    if (action === "toggle_rule") {
      const { rule_id, is_active } = params;
      const { data, error } = await sbAdmin
        .from("life_event_rules")
        .update({ is_active })
        .eq("tenant_id", tenantId)
        .eq("id", rule_id)
        .select()
        .maybeSingle();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ rule: data }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── GET_ACTIONS ─────────────────────────────────────
    if (action === "get_actions") {
      const { event_id } = params;
      const { data, error } = await sbAdmin
        .from("life_event_actions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("event_id", event_id)
        .order("created_at", { ascending: false });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ actions: data }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── SCAN_EVENTS (AI) ────────────────────────────────
    if (action === "scan_events") {
      const [clients, contracts, payments, existingEvents] = await Promise.all([
        fetchTenantClients(sbAdmin, tenantId, 50),
        fetchTenantContracts(sbAdmin, tenantId, 100),
        fetchRecentPayments(sbAdmin, tenantId, 300),
        fetchExistingEvents(sbAdmin, tenantId),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const persona = await resolvePersona("life_events_ai", tenantId);
      const prompt = `Analise os dados abaixo e detecte "momentos de vida" e oportunidades proativas.

Data de hoje: ${today}

CLIENTES (${clients.length}):
${JSON.stringify(clients.slice(0, 30), null, 2)}

CONTRATOS ATIVOS (${contracts.length}):
${JSON.stringify(contracts.slice(0, 50), null, 2)}

PAGAMENTOS RECENTES (${payments.length}):
${JSON.stringify(payments.slice(0, 100), null, 2)}

EVENTOS JÁ DETECTADOS (${existingEvents.length} — NÃO duplicar):
${JSON.stringify(existingEvents.slice(0, 50), null, 2)}

Detecte:
1. Aniversários de contrato nos próximos 60 dias
2. Aniversários de clientes nos próximos 30 dias
3. Janelas de renovação (contratos expirando em 90 dias)
4. Garantias expirando
5. Marcos de pagamento (12, 24, 36 parcelas)
6. Padrões comportamentais (pagamentos antecipados, regularidade)
7. Datas sazonais relevantes (Natal, Dia das Mães, etc.)

IMPORTANTE: NÃO duplicar eventos que já existem na lista acima.
Retorne APENAS eventos NOVOS e relevantes.`;

      const startTime = Date.now();
      const aiResponse = await callGemini({
        persona,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: LIFE_EVENTS_SCAN_TOOL,
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: ["detected_life_events"],
          },
        },
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI error:", errorText);
        return new Response(JSON.stringify({ error: "AI request failed" }), { status: 500, headers: cors });
      }

      const aiData = await aiResponse.json();
      const fnCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;
      let detected = { events: [], summary: "Nenhum evento detectado", total_opportunities: 0 };
      if (fnCall?.args) {
        detected = fnCall.args as any;
      }

      // Insert detected events
      const inserted = [];
      for (const evt of (detected.events || [])) {
        const { data: ins, error } = await sbAdmin
          .from("client_life_events")
          .insert({
            tenant_id: tenantId,
            person_id: evt.person_id || null,
            property_id: evt.property_id || null,
            contract_id: evt.contract_id || null,
            event_type: evt.event_type,
            event_category: evt.event_category || "lifecycle",
            title: evt.title,
            description: evt.description,
            event_date: evt.event_date,
            priority: evt.priority || "medium",
            recurrence: evt.recurrence || "none",
            ai_generated: true,
            pattern_confidence: evt.pattern_confidence || null,
            ai_recommendation: { action: evt.recommended_action, channel: evt.recommended_channel },
          })
          .select()
          .maybeSingle();
        if (!error && ins) inserted.push(ins);
      }

      const responseTimeMs = Date.now() - startTime;
      await logInteraction({
        tenantId,
        userId: user.id,
        functionKey: "life_events_ai",
        inputSummary: `Scan: ${clients.length} clients, ${contracts.length} contracts`,
        outputSummary: `Detected ${inserted.length} new events`,
        responseTimeMs,
      });

      return new Response(JSON.stringify({
        summary: detected.summary,
        total_opportunities: detected.total_opportunities,
        events_created: inserted.length,
        events: inserted,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── GENERATE_CONTENT (AI) ───────────────────────────
    if (action === "generate_content") {
      const { event_id, channel = "email" } = params;

      const event = await fetchEventWithDetails(sbAdmin, tenantId, event_id);
      if (!event) return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers: cors });

      let personContext = null;
      if (event.person_id) {
        personContext = await fetchPersonContext(sbAdmin, tenantId, event.person_id);
      }

      const persona = await resolvePersona("life_events_ai", tenantId);
      const prompt = `Gere conteúdo personalizado para o seguinte evento de vida:

EVENTO:
- Tipo: ${event.event_type}
- Título: ${event.title}
- Descrição: ${event.description}
- Data: ${event.event_date}
- Prioridade: ${event.priority}

CLIENTE:
${personContext?.person ? `- Nome: ${personContext.person.name}\n- Email: ${personContext.person.email}\n- Desde: ${personContext.person.created_at}` : "Informações não disponíveis"}

CONTRATOS:
${personContext?.contracts ? JSON.stringify(personContext.contracts.slice(0, 5), null, 2) : "Sem contratos"}

HISTÓRICO DE PAGAMENTOS:
${personContext?.payments ? `${personContext.payments.length} pagamentos registrados. Últimos 5: ${JSON.stringify(personContext.payments.slice(0, 5))}` : "Sem histórico"}

Canal preferido: ${channel}

Gere uma mensagem calorosa, personalizada e que NÃO pareça automática.
Use o nome do cliente quando disponível.
Inclua adaptações para email, WhatsApp e SMS.`;

      const startTime = Date.now();
      const aiResponse = await callGemini({
        persona,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: CONTENT_GENERATION_TOOL,
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: ["generated_content"],
          },
        },
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI error:", errorText);
        return new Response(JSON.stringify({ error: "AI request failed" }), { status: 500, headers: cors });
      }

      const aiData = await aiResponse.json();
      const fnCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;
      let content: any = { subject: "", greeting: "", body: "", call_to_action: "", closing: "", tone: "warm", personalization_score: 0 };
      if (fnCall?.args) {
        content = fnCall.args;
      }

      // Save action
      await sbAdmin.from("life_event_actions").insert({
        tenant_id: tenantId,
        event_id,
        action_type: "content_generated",
        title: `Conteúdo gerado: ${content.subject || event.title}`,
        description: `Canal: ${channel}, Tom: ${content.tone}`,
        content_generated: content,
        status: "completed",
        executed_at: new Date().toISOString(),
        executed_by: profile.id,
      });

      // Update event status
      await sbAdmin
        .from("client_life_events")
        .update({ status: "actioned" })
        .eq("id", event_id)
        .eq("tenant_id", tenantId);

      const responseTimeMs = Date.now() - startTime;
      await logInteraction({
        tenantId,
        userId: user.id,
        functionKey: "life_events_ai",
        inputSummary: `Content for event ${event.event_type}: ${event.title}`,
        outputSummary: `Generated ${content.tone} content, score ${content.personalization_score}`,
        responseTimeMs,
      });

      return new Response(JSON.stringify({ content, event_id }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── GET_STATS ───────────────────────────────────────
    if (action === "get_stats") {
      const [eventsRes, rulesRes, actionsRes] = await Promise.all([
        sbAdmin.from("client_life_events").select("id, status, priority, event_type, event_category", { count: "exact" }).eq("tenant_id", tenantId),
        sbAdmin.from("life_event_rules").select("id, is_active", { count: "exact" }).eq("tenant_id", tenantId),
        sbAdmin.from("life_event_actions").select("id, status, action_type", { count: "exact" }).eq("tenant_id", tenantId),
      ]);

      const events = eventsRes.data || [];
      const rules = rulesRes.data || [];
      const actions = actionsRes.data || [];

      const upcoming = events.filter((e: any) => e.status === "upcoming").length;
      const triggered = events.filter((e: any) => e.status === "triggered").length;
      const actioned = events.filter((e: any) => e.status === "actioned").length;
      const completed = events.filter((e: any) => e.status === "completed").length;
      const highPriority = events.filter((e: any) => e.priority === "high" || e.priority === "critical").length;
      const activeRules = rules.filter((r: any) => r.is_active).length;
      const pendingActions = actions.filter((a: any) => a.status === "pending").length;
      const completedActions = actions.filter((a: any) => a.status === "completed").length;

      return new Response(JSON.stringify({
        stats: {
          total_events: events.length,
          upcoming,
          triggered,
          actioned,
          completed,
          high_priority: highPriority,
          total_rules: rules.length,
          active_rules: activeRules,
          total_actions: actions.length,
          pending_actions: pendingActions,
          completed_actions: completedActions,
          by_type: Object.entries(
            events.reduce((acc: any, e: any) => { acc[e.event_type] = (acc[e.event_type] || 0) + 1; return acc; }, {})
          ).map(([type, count]) => ({ type, count })),
          by_category: Object.entries(
            events.reduce((acc: any, e: any) => { acc[e.event_category] = (acc[e.event_category] || 0) + 1; return acc; }, {})
          ).map(([category, count]) => ({ category, count })),
        },
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: cors });
  } catch (err) {
    const cors = buildCorsHeaders(req);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
