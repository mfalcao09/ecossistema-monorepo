/**
 * relationship-property-twin — v1
 * F5: Digital Twin do Imóvel
 *
 * 8 actions:
 *   - get_timeline: Fetch timeline events for a property
 *   - add_event: Add manual event to timeline
 *   - get_alerts: Fetch proactive maintenance alerts
 *   - dismiss_alert: Dismiss/snooze/resolve an alert
 *   - get_profile: Get AI-generated property health profile
 *   - generate_profile: Re-generate property profile with AI analysis
 *   - chat: Ask questions about the property (contextual AI)
 *   - generate_alerts: AI scan to detect new proactive alerts
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
const TWIN_ANALYSIS_TOOL = [
  {
    functionDeclarations: [
      {
        name: "property_analysis",
        description: "Structured analysis of a property based on its timeline, documents, and maintenance history",
        parameters: {
          type: "OBJECT",
          properties: {
            health_score: { type: "NUMBER", description: "Score de saúde do imóvel 0-100" },
            maintenance_score: { type: "NUMBER", description: "Score de manutenção 0-100" },
            documentation_score: { type: "NUMBER", description: "Score de documentação 0-100" },
            risk_level: { type: "STRING", description: "low, medium, high, critical" },
            summary: { type: "STRING", description: "Resumo executivo do estado do imóvel (2-3 parágrafos)" },
            key_findings: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  finding: { type: "STRING" },
                  severity: { type: "STRING" },
                  category: { type: "STRING" },
                },
              },
              description: "Achados principais da análise",
            },
            recommendations: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  action: { type: "STRING" },
                  priority: { type: "STRING" },
                  estimated_cost: { type: "STRING" },
                  urgency: { type: "STRING" },
                },
              },
              description: "Recomendações de ação",
            },
            alerts_to_create: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  alert_type: { type: "STRING" },
                  title: { type: "STRING" },
                  description: { type: "STRING" },
                  priority: { type: "STRING" },
                  threshold_days: { type: "NUMBER" },
                },
              },
              description: "Alertas proativos a criar",
            },
          },
          required: ["health_score", "maintenance_score", "documentation_score", "risk_level", "summary"],
        },
      },
    ],
  },
];

const TWIN_CHAT_TOOL = [
  {
    functionDeclarations: [
      {
        name: "twin_response",
        description: "Resposta contextual sobre o imóvel",
        parameters: {
          type: "OBJECT",
          properties: {
            response_message: { type: "STRING", description: "Resposta para o usuário" },
            data_referenced: { type: "ARRAY", items: { type: "STRING" }, description: "Dados que fundamentaram a resposta" },
            confidence: { type: "NUMBER", description: "Confiança 0-1" },
          },
          required: ["response_message", "confidence"],
        },
      },
    ],
  },
];

// ── Data Fetchers ───────────────────────────────────────────
async function fetchPropertyData(sb: any, propertyId: string, tenantId: string) {
  const { data } = await sb
    .from("properties")
    .select("id, title, property_code, property_type, purpose, status, condominium_name, street, number, neighborhood, city, state, rooms, suites, bathrooms, parking_spots, area_total, area_built, sale_price, rental_price, condominium_fee, iptu, description")
    .eq("id", propertyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data;
}

async function fetchTimeline(sb: any, propertyId: string, tenantId: string, limit = 50) {
  const { data } = await sb
    .from("property_twin_timeline")
    .select("*")
    .eq("property_id", propertyId)
    .eq("tenant_id", tenantId)
    .order("event_date", { ascending: false })
    .limit(limit);
  return data || [];
}

async function fetchAlerts(sb: any, propertyId: string, tenantId: string, status?: string) {
  let q = sb
    .from("property_twin_alerts")
    .select("*")
    .eq("property_id", propertyId)
    .eq("tenant_id", tenantId);
  if (status) q = q.eq("status", status);
  const { data } = await q.order("created_at", { ascending: false }).limit(50);
  return data || [];
}

async function fetchProfile(sb: any, propertyId: string, tenantId: string) {
  const { data } = await sb
    .from("property_twin_profile")
    .select("*")
    .eq("property_id", propertyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data;
}

async function fetchPropertyDocuments(sb: any, propertyId: string, tenantId: string) {
  const { data } = await sb
    .from("property_documents")
    .select("id, name, document_type, status, expiry_date, created_at")
    .eq("property_id", propertyId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(30);
  return data || [];
}

async function fetchPropertyTickets(sb: any, propertyId: string, tenantId: string) {
  const { data } = await sb
    .from("support_tickets")
    .select("id, subject, category, priority, status, created_at, resolved_at")
    .eq("property_id", propertyId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(30);
  return data || [];
}

async function fetchPropertyContracts(sb: any, propertyId: string, tenantId: string) {
  const { data } = await sb
    .from("contracts")
    .select("id, contract_type, status, start_date, end_date, monthly_value, readjustment_index, payment_due_day")
    .eq("property_id", propertyId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(10);
  return data || [];
}

// ── Action Handlers ─────────────────────────────────────────

async function handleGetTimeline(sb: any, body: any, tenantId: string) {
  const { property_id, limit = 50, event_type } = body;
  if (!property_id) return { error: "property_id required" };

  let q = sb
    .from("property_twin_timeline")
    .select("*")
    .eq("property_id", property_id)
    .eq("tenant_id", tenantId);
  if (event_type) q = q.eq("event_type", event_type);
  const { data, error } = await q.order("event_date", { ascending: false }).limit(limit);
  if (error) return { error: error.message };
  return { timeline: data || [] };
}

async function handleAddEvent(sb: any, body: any, tenantId: string) {
  const { property_id, event_type, event_category, title, description, event_date, severity, status, performed_by, cost, metadata } = body;
  if (!property_id || !event_type || !title) return { error: "property_id, event_type, title required" };

  const { data, error } = await sb
    .from("property_twin_timeline")
    .insert({
      tenant_id: tenantId,
      property_id,
      event_type,
      event_category: event_category || "general",
      title,
      description,
      event_date: event_date || new Date().toISOString(),
      severity: severity || "info",
      status: status || "completed",
      performed_by,
      cost,
      ai_generated: false,
      metadata: metadata || {},
    })
    .select()
    .maybeSingle();
  if (error) return { error: error.message };
  return { event: data };
}

async function handleGetAlerts(sb: any, body: any, tenantId: string) {
  const { property_id, status: alertStatus } = body;
  if (!property_id) return { error: "property_id required" };
  const alerts = await fetchAlerts(sb, property_id, tenantId, alertStatus || "active");
  return { alerts };
}

async function handleDismissAlert(sb: any, body: any, tenantId: string) {
  const { alert_id, action, snooze_days } = body;
  if (!alert_id || !action) return { error: "alert_id and action (dismiss|snooze|resolve) required" };

  const update: any = {};
  if (action === "dismiss") update.status = "dismissed";
  else if (action === "resolve") { update.status = "resolved"; update.resolved_at = new Date().toISOString(); }
  else if (action === "snooze") {
    update.status = "snoozed";
    const d = new Date();
    d.setDate(d.getDate() + (snooze_days || 7));
    update.snoozed_until = d.toISOString();
  }

  const { data, error } = await sb
    .from("property_twin_alerts")
    .update(update)
    .eq("id", alert_id)
    .eq("tenant_id", tenantId)
    .select()
    .maybeSingle();
  if (error) return { error: error.message };
  return { alert: data };
}

async function handleGetProfile(sb: any, body: any, tenantId: string) {
  const { property_id } = body;
  if (!property_id) return { error: "property_id required" };
  const profile = await fetchProfile(sb, property_id, tenantId);
  return { profile };
}

async function handleGenerateProfile(sb: any, body: any, tenantId: string, persona: any, userId: string) {
  const { property_id } = body;
  if (!property_id) return { error: "property_id required" };

  // Parallel context fetch
  const [property, timeline, documents, tickets, contracts] = await Promise.all([
    fetchPropertyData(sb, property_id, tenantId),
    fetchTimeline(sb, property_id, tenantId, 100),
    fetchPropertyDocuments(sb, property_id, tenantId),
    fetchPropertyTickets(sb, property_id, tenantId),
    fetchPropertyContracts(sb, property_id, tenantId),
  ]);

  if (!property) return { error: "Imóvel não encontrado" };

  const contextPrompt = `Analise o seguinte imóvel e gere um perfil completo de saúde:

## Dados do Imóvel
${JSON.stringify(property, null, 2)}

## Timeline de Eventos (${timeline.length} eventos)
${timeline.slice(0, 50).map((e: any) => `- [${e.event_date}] ${e.event_type}/${e.severity}: ${e.title} ${e.description || ""} ${e.cost ? `(R$ ${e.cost})` : ""}`).join("\n") || "Nenhum evento registrado"}

## Documentos (${documents.length})
${documents.map((d: any) => `- ${d.document_type}: ${d.name} [${d.status}] ${d.expiry_date ? `exp: ${d.expiry_date}` : ""}`).join("\n") || "Nenhum documento"}

## Tickets/Chamados (${tickets.length})
${tickets.map((t: any) => `- [${t.created_at}] ${t.category}/${t.priority}: ${t.subject} [${t.status}] ${t.resolved_at ? `resolvido: ${t.resolved_at}` : ""}`).join("\n") || "Nenhum ticket"}

## Contratos (${contracts.length})
${contracts.map((c: any) => `- ${c.contract_type} [${c.status}] ${c.start_date} a ${c.end_date} R$ ${c.monthly_value}/mês`).join("\n") || "Nenhum contrato"}

Gere a análise completa usando a função property_analysis.`;

  const t0 = Date.now();
  const aiResponse = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: contextPrompt }] }],
    tools: TWIN_ANALYSIS_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["property_analysis"] } },
  });
  const elapsed = Date.now() - t0;

  if (!aiResponse.ok) throw new Error("AI error: " + aiResponse.status);
  const aiData = await aiResponse.json();

  // Parse AI response
  let analysis: any = {};
  const fnCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  if (fnCall?.name === "property_analysis") {
    analysis = fnCall.args || {};
  }

  // Upsert profile
  const profileData = {
    tenant_id: tenantId,
    property_id,
    health_score: analysis.health_score ?? 50,
    maintenance_score: analysis.maintenance_score ?? 50,
    documentation_score: analysis.documentation_score ?? 50,
    risk_level: analysis.risk_level || "medium",
    ai_summary: analysis.summary || "",
    key_findings: analysis.key_findings || [],
    recommendations: analysis.recommendations || [],
    total_events: timeline.length,
    total_maintenance_cost: timeline.reduce((sum: number, e: any) => sum + (e.cost || 0), 0),
    last_maintenance_date: timeline.find((e: any) => e.event_type === "maintenance")?.event_date,
    last_inspection_date: timeline.find((e: any) => e.event_type === "inspection")?.event_date,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: savedProfile, error: profileError } = await sb
    .from("property_twin_profile")
    .upsert(profileData, { onConflict: "tenant_id,property_id" })
    .select()
    .maybeSingle();

  // Auto-create alerts from AI recommendations
  if (analysis.alerts_to_create?.length) {
    const alertInserts = analysis.alerts_to_create.map((a: any) => ({
      tenant_id: tenantId,
      property_id,
      alert_type: a.alert_type || "ai_recommendation",
      title: a.title,
      description: a.description,
      priority: a.priority || "medium",
      threshold_days: a.threshold_days,
      ai_generated: true,
      status: "active",
    }));
    await sb.from("property_twin_alerts").insert(alertInserts);
  }

  // Log AI interaction
  try {
    await logInteraction({
      tenantId,
      userId,
      functionKey: "property_twin_ai",
      inputSummary: contextPrompt.slice(0, 500),
      outputSummary: JSON.stringify(analysis).slice(0, 500),
      responseTimeMs: elapsed,
    });
  } catch (_) {}

  return {
    profile: savedProfile || profileData,
    analysis,
    alerts_created: analysis.alerts_to_create?.length || 0,
    response_time_ms: elapsed,
  };
}

async function handleChat(sb: any, body: any, tenantId: string, persona: any, userId: string) {
  const { property_id, message } = body;
  if (!property_id || !message) return { error: "property_id and message required" };

  // Parallel context fetch
  const [property, timeline, documents, tickets, profile] = await Promise.all([
    fetchPropertyData(sb, property_id, tenantId),
    fetchTimeline(sb, property_id, tenantId, 30),
    fetchPropertyDocuments(sb, property_id, tenantId),
    fetchPropertyTickets(sb, property_id, tenantId),
    fetchProfile(sb, property_id, tenantId),
  ]);

  if (!property) return { error: "Imóvel não encontrado" };

  const contextPrompt = `Contexto do imóvel para responder a pergunta do usuário:

## Imóvel: ${property.title || property.property_code}
Tipo: ${property.property_type} | Status: ${property.status} | ${property.area_total}m²
Endereço: ${property.street}, ${property.number} - ${property.neighborhood}, ${property.city}/${property.state}
${property.condominium_name ? `Condomínio: ${property.condominium_name}` : ""}

${profile ? `## Health Score: ${profile.health_score}/100 | Manutenção: ${profile.maintenance_score}/100 | Docs: ${profile.documentation_score}/100
Resumo IA: ${profile.ai_summary || "N/A"}` : ""}

## Timeline Recente (${timeline.length} eventos)
${timeline.slice(0, 20).map((e: any) => `- [${e.event_date?.substring(0, 10)}] ${e.event_type}: ${e.title} ${e.cost ? `R$ ${e.cost}` : ""}`).join("\n") || "Sem eventos"}

## Documentos (${documents.length})
${documents.slice(0, 15).map((d: any) => `- ${d.document_type}: ${d.name} [${d.status}]`).join("\n") || "Sem docs"}

## Tickets (${tickets.length})
${tickets.slice(0, 10).map((t: any) => `- [${t.created_at?.substring(0, 10)}] ${t.category}: ${t.subject} [${t.status}]`).join("\n") || "Sem tickets"}

## Pergunta do Usuário
${message}

Responda usando a função twin_response.`;

  const t0 = Date.now();
  const aiResponse = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: contextPrompt }] }],
    tools: TWIN_CHAT_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["twin_response"] } },
  });
  const elapsed = Date.now() - t0;

  if (!aiResponse.ok) throw new Error("AI error: " + aiResponse.status);
  const aiData = await aiResponse.json();

  let response: any = { response_message: "Não consegui processar sua pergunta. Tente reformular.", confidence: 0 };
  const fnCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  if (fnCall?.name === "twin_response") {
    response = fnCall.args || response;
  }

  try {
    await logInteraction({
      tenantId,
      userId,
      functionKey: "property_twin_ai",
      inputSummary: message.slice(0, 500),
      outputSummary: response.response_message.slice(0, 500),
      responseTimeMs: elapsed,
    });
  } catch (_) {}

  return {
    response_message: response.response_message,
    data_referenced: response.data_referenced || [],
    confidence: response.confidence ?? 0.5,
    response_time_ms: elapsed,
  };
}

async function handleGenerateAlerts(sb: any, body: any, tenantId: string, persona: any, userId: string) {
  const { property_id } = body;
  if (!property_id) return { error: "property_id required" };

  const [property, timeline, documents, contracts] = await Promise.all([
    fetchPropertyData(sb, property_id, tenantId),
    fetchTimeline(sb, property_id, tenantId, 50),
    fetchPropertyDocuments(sb, property_id, tenantId),
    fetchPropertyContracts(sb, property_id, tenantId),
  ]);

  if (!property) return { error: "Imóvel não encontrado" };

  // Dismiss old AI alerts before regenerating
  await sb
    .from("property_twin_alerts")
    .update({ status: "expired" })
    .eq("property_id", property_id)
    .eq("tenant_id", tenantId)
    .eq("ai_generated", true)
    .eq("status", "active");

  const today = new Date().toISOString().substring(0, 10);
  const contextPrompt = `Analise o imóvel abaixo e gere ALERTAS PROATIVOS de manutenção e cuidados.
Data de hoje: ${today}

## Imóvel: ${property.title} (${property.property_type})

## Timeline (${timeline.length} eventos)
${timeline.slice(0, 30).map((e: any) => `- [${e.event_date?.substring(0, 10)}] ${e.event_type}/${e.event_category}: ${e.title}`).join("\n") || "Sem eventos"}

## Documentos (${documents.length})
${documents.map((d: any) => `- ${d.document_type}: ${d.name} [${d.status}] ${d.expiry_date ? `exp: ${d.expiry_date}` : ""}`).join("\n") || "Sem docs"}

## Contratos (${contracts.length})
${contracts.map((c: any) => `- ${c.contract_type} [${c.status}] fim: ${c.end_date}`).join("\n") || "Sem contratos"}

Gere alertas proativos usando a função property_analysis. Foque em:
1. Manutenções que deveriam ser feitas periodicamente (HVAC, impermeabilização, etc)
2. Documentos prestes a vencer
3. Contratos próximos do vencimento
4. Recomendações sazonais`;

  const t0 = Date.now();
  const aiResponse = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: contextPrompt }] }],
    tools: TWIN_ANALYSIS_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["property_analysis"] } },
  });
  const elapsed = Date.now() - t0;

  if (!aiResponse.ok) throw new Error("AI error: " + aiResponse.status);
  const aiData = await aiResponse.json();

  let analysis: any = {};
  const fnCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  if (fnCall?.name === "property_analysis") {
    analysis = fnCall.args || {};
  }

  let alertsCreated = 0;
  if (analysis.alerts_to_create?.length) {
    const alertInserts = analysis.alerts_to_create.map((a: any) => ({
      tenant_id: tenantId,
      property_id,
      alert_type: a.alert_type || "ai_recommendation",
      title: a.title,
      description: a.description,
      priority: a.priority || "medium",
      threshold_days: a.threshold_days,
      ai_generated: true,
      status: "active",
    }));
    const { error } = await sb.from("property_twin_alerts").insert(alertInserts);
    if (!error) alertsCreated = alertInserts.length;
  }

  return { alerts_created: alertsCreated, analysis_summary: analysis.summary, response_time_ms: elapsed };
}

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Auth
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const { data: profile } = await sb.from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
    if (!profile?.tenant_id) return new Response(JSON.stringify({ error: "No tenant" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

    const tenantId = profile.tenant_id;
    const body = await req.json();
    const action = body.action;

    const persona = await resolvePersona("property_twin_ai", tenantId);

    let result: any;
    switch (action) {
      case "get_timeline": result = await handleGetTimeline(sb, body, tenantId); break;
      case "add_event": result = await handleAddEvent(sb, body, tenantId); break;
      case "get_alerts": result = await handleGetAlerts(sb, body, tenantId); break;
      case "dismiss_alert": result = await handleDismissAlert(sb, body, tenantId); break;
      case "get_profile": result = await handleGetProfile(sb, body, tenantId); break;
      case "generate_profile": result = await handleGenerateProfile(sb, body, tenantId, persona, user.id); break;
      case "chat": result = await handleChat(sb, body, tenantId, persona, user.id); break;
      case "generate_alerts": result = await handleGenerateAlerts(sb, body, tenantId, persona, user.id); break;
      default:
        result = { error: `Unknown action: ${action}. Available: get_timeline, add_event, get_alerts, dismiss_alert, get_profile, generate_profile, chat, generate_alerts` };
    }

    const status = result.error ? 400 : 200;
    return new Response(JSON.stringify(result), { status, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
