// commercial-pulse-feed v1 — Pulse/Feed Central de Ações CRM
// Self-contained Edge Function: CORS whitelist, auth/tenant, IA prioritization
// Actions: get_feed, get_insights, backfill, mark_read
// Session 76 — Pair programming Claudinho + Buchecha

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── CORS ────────────────────────────────────────────────────────
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];
const DEV_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PREVIEW_REGEX = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if ([...PROD_ORIGINS, ...extra].includes(origin)) return true;
  if (DEV_REGEX.test(origin) || PREVIEW_REGEX.test(origin)) return true;
  return false;
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isAllowedOrigin(origin) ? origin : PROD_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── Auth / Tenant ───────────────────────────────────────────────
async function resolveAuth(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("AUTH_REQUIRED");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.tenant_id) throw new Error("TENANT_REQUIRED");
  return { user, tenantId: profile.tenant_id, fullName: profile.full_name ?? "Usuário" };
}

// ─── Types ───────────────────────────────────────────────────────
interface PulseEvent {
  id: string;
  tenant_id: string;
  event_type: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  metadata: Record<string, unknown>;
  priority: string;
  urgency_score: number;
  is_read: boolean;
  created_at: string;
}

// ─── Event Type Config ───────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  deal_created: "Negócio criado",
  deal_stage_changed: "Estágio alterado",
  deal_won: "Negócio ganho",
  deal_lost: "Negócio perdido",
  comment_added: "Comentário adicionado",
  mention: "Menção recebida",
  interaction_logged: "Interação registrada",
  lead_created: "Lead criado",
  lead_converted: "Lead convertido",
  automation_executed: "Automação executada",
  commission_split: "Comissão registrada",
  follow_started: "Seguindo negócio",
  proposal_sent: "Proposta enviada",
  document_signed: "Documento assinado",
  payment_received: "Pagamento recebido",
  payment_overdue: "Pagamento atrasado",
  visit_scheduled: "Visita agendada",
};

// ─── IA Prioritization ──────────────────────────────────────────
function computeUrgencyScore(event: { event_type: string; metadata: Record<string, unknown>; created_at: string }): { priority: string; urgency_score: number } {
  let score = 50;
  const ageHours = (Date.now() - new Date(event.created_at).getTime()) / (1000 * 60 * 60);

  // Event type base scoring
  switch (event.event_type) {
    case "deal_won": score = 90; break;
    case "deal_lost": score = 85; break;
    case "payment_overdue": score = 88; break;
    case "mention": score = 80; break;
    case "deal_stage_changed": score = 70; break;
    case "proposal_sent": score = 72; break;
    case "commission_split": score = 65; break;
    case "automation_executed": score = 40; break;
    case "follow_started": score = 30; break;
    case "lead_created": score = 60; break;
    case "interaction_logged": score = 55; break;
    case "comment_added": score = 50; break;
    case "deal_created": score = 65; break;
    case "visit_scheduled": score = 62; break;
    default: score = 50;
  }

  // Metadata-based adjustments
  const meta = event.metadata ?? {};
  if (meta.proposed_value && Number(meta.proposed_value) > 500000) score += 10;
  if (meta.days_overdue && Number(meta.days_overdue) > 7) score += 15;
  if (meta.days_stalled && Number(meta.days_stalled) > 14) score += 12;

  // Recency boost (events < 1h get +10, < 4h get +5)
  if (ageHours < 1) score += 10;
  else if (ageHours < 4) score += 5;

  // Staleness penalty (events > 48h lose points)
  if (ageHours > 48) score -= 10;
  if (ageHours > 168) score -= 20; // > 1 week

  score = Math.max(0, Math.min(100, score));

  let priority: string;
  if (score >= 80) priority = "critical";
  else if (score >= 60) priority = "high";
  else if (score >= 40) priority = "normal";
  else priority = "low";

  return { priority, urgency_score: score };
}

// ─── IA Insights (OpenRouter → Gemini) ──────────────────────────
async function generateFeedInsights(events: PulseEvent[]): Promise<{ summary: string; suggested_actions: Array<{ action: string; reason: string; priority: string; entity_id?: string }> }> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey || events.length === 0) {
    return { summary: "Sem atividade recente para analisar.", suggested_actions: [] };
  }

  const recentEvents = events.slice(0, 30).map(e => ({
    type: EVENT_LABELS[e.event_type] ?? e.event_type,
    entity: e.entity_name ?? e.entity_id,
    entity_type: e.entity_type,
    priority: e.priority,
    score: e.urgency_score,
    age_hours: Math.round((Date.now() - new Date(e.created_at).getTime()) / (1000 * 60 * 60)),
    meta: e.metadata,
  }));

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Você é o analista comercial IA da Intentus Real Estate. Analise as atividades recentes do CRM e gere:
1. Um resumo executivo de 2-3 frases sobre o que está acontecendo
2. Até 5 ações sugeridas priorizadas (coisas que o corretor/gerente deveria fazer AGORA)

Foque em: follow-ups atrasados, negócios estagnados, oportunidades quentes, riscos.

Responda em JSON: { "summary": "...", "suggested_actions": [{ "action": "...", "reason": "...", "priority": "alta|media|baixa", "entity_id": "uuid_opcional" }] }`,
          },
          { role: "user", content: `Atividades recentes:\n${JSON.stringify(recentEvents, null, 2)}` },
        ],
      }),
    });

    if (!resp.ok) throw new Error(`OpenRouter ${resp.status}`);
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary ?? "Análise indisponível.",
      suggested_actions: (parsed.suggested_actions ?? []).slice(0, 5),
    };
  } catch (err) {
    console.error("IA insights error:", err);
    // Fallback rule-based
    const criticals = events.filter(e => e.priority === "critical" || e.priority === "high");
    return {
      summary: `${events.length} atividades recentes. ${criticals.length} requerem atenção imediata.`,
      suggested_actions: criticals.slice(0, 3).map(e => ({
        action: `Verificar: ${EVENT_LABELS[e.event_type] ?? e.event_type} — ${e.entity_name ?? e.entity_id}`,
        reason: `Urgência: ${e.urgency_score}/100`,
        priority: e.priority === "critical" ? "alta" : "media",
        entity_id: e.entity_id,
      })),
    };
  }
}

// ─── Backfill from existing tables ──────────────────────────────
async function backfillEvents(supabase: ReturnType<typeof createClient>, tenantId: string): Promise<{ inserted: number }> {
  let inserted = 0;
  const batchInsert = async (events: Array<Partial<PulseEvent>>) => {
    if (events.length === 0) return;
    const withScores = events.map(e => {
      const { priority, urgency_score } = computeUrgencyScore({
        event_type: e.event_type!,
        metadata: (e.metadata ?? {}) as Record<string, unknown>,
        created_at: e.created_at!,
      });
      return { ...e, tenant_id: tenantId, priority, urgency_score };
    });
    const { error } = await supabase.from("pulse_events").insert(withScores);
    if (!error) inserted += withScores.length;
    else console.error("Backfill insert error:", error.message);
  };

  // 1. deal_request_history
  const { data: history } = await supabase
    .from("deal_request_history")
    .select("id, deal_request_id, from_status, to_status, notes, created_by, created_at, tenant_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (history?.length) {
    await batchInsert(history.map((h: Record<string, unknown>) => ({
      event_type: h.to_status === "concluido" ? "deal_won" : h.to_status === "perdido" ? "deal_lost" : "deal_stage_changed",
      actor_id: h.created_by as string,
      entity_type: "deal",
      entity_id: h.deal_request_id as string,
      entity_name: null,
      metadata: { from_status: h.from_status, to_status: h.to_status, notes: h.notes },
      created_at: h.created_at as string,
    })));
  }

  // 2. deal_request_comments
  const { data: comments } = await supabase
    .from("deal_request_comments")
    .select("id, deal_request_id, message, mentioned_users, created_by, created_at, tenant_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (comments?.length) {
    await batchInsert(comments.map((c: Record<string, unknown>) => ({
      event_type: (c.mentioned_users as string[] | null)?.length ? "mention" : "comment_added",
      actor_id: c.created_by as string,
      entity_type: "deal",
      entity_id: c.deal_request_id as string,
      entity_name: null,
      metadata: { message: (c.message as string)?.substring(0, 200), mentioned_users: c.mentioned_users },
      created_at: c.created_at as string,
    })));
  }

  // 3. interactions
  const { data: interactions } = await supabase
    .from("interactions")
    .select("id, person_id, user_id, interaction_type, notes, created_at, tenant_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (interactions?.length) {
    await batchInsert(interactions.map((i: Record<string, unknown>) => ({
      event_type: "interaction_logged",
      actor_id: i.user_id as string,
      entity_type: "person",
      entity_id: i.person_id as string,
      entity_name: null,
      metadata: { interaction_type: i.interaction_type, notes: (i.notes as string)?.substring(0, 200) },
      created_at: i.created_at as string,
    })));
  }

  // 4. commercial_automation_logs
  const { data: autoLogs } = await supabase
    .from("commercial_automation_logs")
    .select("id, automation_id, trigger_event, action_type, lead_id, person_id, action_taken, status, created_at, tenant_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (autoLogs?.length) {
    await batchInsert(autoLogs.map((a: Record<string, unknown>) => ({
      event_type: "automation_executed",
      actor_id: null,
      entity_type: a.lead_id ? "lead" : "person",
      entity_id: (a.lead_id ?? a.person_id ?? a.automation_id) as string,
      entity_name: null,
      metadata: { trigger_event: a.trigger_event, action_type: a.action_type, action_taken: a.action_taken, status: a.status },
      created_at: a.created_at as string,
    })));
  }

  // 5. leads (creation events)
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, email, created_by, created_at, tenant_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (leads?.length) {
    await batchInsert(leads.map((l: Record<string, unknown>) => ({
      event_type: "lead_created",
      actor_id: l.created_by as string | null,
      entity_type: "lead",
      entity_id: l.id as string,
      entity_name: (l.name as string) ?? (l.email as string),
      metadata: {},
      created_at: l.created_at as string,
    })));
  }

  return { inserted };
}

// ─── Main Handler ────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { user, tenantId, fullName } = await resolveAuth(supabase);
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "get_feed";

    // ─── GET FEED ────────────────────────────────────────────────
    if (action === "get_feed") {
      const {
        page = 0,
        page_size = 30,
        entity_type,
        event_type,
        actor_id,
        priority,
        entity_id,
        date_from,
        date_to,
        unread_only,
      } = body;

      let query = supabase
        .from("pulse_events")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range(page * page_size, (page + 1) * page_size - 1);

      if (entity_type) query = query.eq("entity_type", entity_type);
      if (event_type) query = query.eq("event_type", event_type);
      if (actor_id) query = query.eq("actor_id", actor_id);
      if (priority) query = query.eq("priority", priority);
      if (entity_id) query = query.eq("entity_id", entity_id);
      if (date_from) query = query.gte("created_at", date_from);
      if (date_to) query = query.lte("created_at", date_to);
      if (unread_only) query = query.eq("is_read", false);

      const { data: events, error } = await query;
      if (error) throw error;

      // Enrich with actor names (batch)
      const actorIds = [...new Set((events ?? []).filter((e: PulseEvent) => e.actor_id).map((e: PulseEvent) => e.actor_id))];
      let actorMap: Record<string, string> = {};
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", actorIds);
        actorMap = Object.fromEntries((profiles ?? []).map((p: Record<string, unknown>) => [p.user_id, p.full_name ?? "Usuário"]));
      }

      const enriched = (events ?? []).map((e: PulseEvent) => ({
        ...e,
        actor_name: e.actor_id ? (actorMap[e.actor_id] ?? "Usuário") : "Sistema",
        event_label: EVENT_LABELS[e.event_type] ?? e.event_type,
      }));

      // Count totals for pagination
      const { count } = await supabase
        .from("pulse_events")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      return new Response(JSON.stringify({ events: enriched, total: count ?? 0, page, page_size }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ─── GET INSIGHTS (IA) ───────────────────────────────────────
    if (action === "get_insights") {
      const { data: recentEvents } = await supabase
        .from("pulse_events")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("urgency_score", { ascending: false })
        .limit(50);

      const insights = await generateFeedInsights(recentEvents ?? []);

      // Stats
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { count: total24h } = await supabase
        .from("pulse_events").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).gte("created_at", last24h);

      const { count: total7d } = await supabase
        .from("pulse_events").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).gte("created_at", last7d);

      const { count: unreadCount } = await supabase
        .from("pulse_events").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("is_read", false);

      const { count: criticalCount } = await supabase
        .from("pulse_events").select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).in("priority", ["critical", "high"]).eq("is_read", false);

      return new Response(JSON.stringify({
        ...insights,
        stats: { total_24h: total24h ?? 0, total_7d: total7d ?? 0, unread: unreadCount ?? 0, critical_unread: criticalCount ?? 0 },
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── MARK READ ───────────────────────────────────────────────
    if (action === "mark_read") {
      const { event_ids, mark_all } = body;
      if (mark_all) {
        await supabase.from("pulse_events").update({ is_read: true }).eq("tenant_id", tenantId).eq("is_read", false);
      } else if (event_ids?.length) {
        await supabase.from("pulse_events").update({ is_read: true }).eq("tenant_id", tenantId).in("id", event_ids);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── BACKFILL ────────────────────────────────────────────────
    if (action === "backfill") {
      const result = await backfillEvents(supabase, tenantId);
      return new Response(JSON.stringify({ success: true, ...result }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("commercial-pulse-feed error:", msg);
    const status = msg === "AUTH_REQUIRED" ? 401 : msg === "TENANT_REQUIRED" ? 403 : 500;
    return new Response(JSON.stringify({ error: status < 500 ? msg : "Erro interno do servidor" }), {
      status, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
