import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * commercial-sla-engine v1
 * ─────────────────────────
 * Backend SLA enforcement: periodic checks, auto-escalation, notifications, pulse events.
 *
 * Actions:
 *  - check_violations  → Scan leads+deals, detect violations, emit alerts
 *  - escalate          → Auto-escalate critical violations to managers
 *  - get_dashboard     → SLA dashboard with computed metrics
 *  - get_rules         → Get tenant SLA rules (from settings)
 *  - update_rules      → Save custom SLA rules
 *  - get_history       → Violation history log
 */

const PROD_ORIGINS = [
  "https://app.intentusrealestate.com.br",
  "https://intentus-plataform.vercel.app",
];

const DEV_ORIGIN_REGEX =
  /^https?:\/\/(localhost|127\.0\.0\.1|intentus-plataform-.+\.vercel\.app)/;

function corsHeaders(origin?: string) {
  const allowedOrigin =
    origin && (PROD_ORIGINS.includes(origin) || DEV_ORIGIN_REGEX.test(origin))
      ? origin
      : PROD_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SlaRules {
  leads: {
    first_response_minutes: number;
    follow_up_hours: number;
    enabled: boolean;
  };
  deals: {
    stage_hours: Record<string, number>;
    max_total_days: number;
    enabled: boolean;
  };
  escalation: {
    warning_threshold_pct: number; // % of SLA time → warning
    critical_threshold_pct: number; // % of SLA time → critical
    auto_escalate: boolean;
    auto_notify: boolean;
    escalation_targets: string[]; // user_ids (managers)
  };
}

interface Violation {
  entity_type: "lead" | "deal";
  entity_id: string;
  entity_name: string;
  sla_type: "first_response" | "stage_time" | "follow_up" | "total_time";
  sla_target_value: number;
  sla_target_unit: string;
  actual_value: number;
  severity: "critical" | "warning";
  status: string;
  assigned_to: string | null;
  assigned_name: string | null;
}

const DEFAULT_SLA_RULES: SlaRules = {
  leads: {
    first_response_minutes: 60,
    follow_up_hours: 48,
    enabled: true,
  },
  deals: {
    stage_hours: {
      rascunho: 48,
      enviado_juridico: 72,
      em_analise: 72,
      elaboracao_validacao: 96,
      em_validacao: 48,
      aprovado: 72,
      em_assinatura: 48,
    },
    max_total_days: 90,
    enabled: true,
  },
  escalation: {
    warning_threshold_pct: 80,
    critical_threshold_pct: 150,
    auto_escalate: true,
    auto_notify: true,
    escalation_targets: [],
  },
};

// ─── Auth ────────────────────────────────────────────────────────────────────

async function resolveAuth(req: Request, supabase: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    throw new Error("Missing or invalid Authorization header");

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) throw new Error("Invalid authentication token");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.tenant_id) throw new Error("User has no tenant");
  return { user, tenantId: profile.tenant_id, profileId: profile.id };
}

// ─── Get Rules ──────────────────────────────────────────────────────────────

async function getSlaRules(supabase: any, tenantId: string): Promise<SlaRules> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();

  const saved = tenant?.settings?.sla_rules_v2;
  if (!saved) return DEFAULT_SLA_RULES;

  return {
    leads: { ...DEFAULT_SLA_RULES.leads, ...saved.leads },
    deals: {
      ...DEFAULT_SLA_RULES.deals,
      ...saved.deals,
      stage_hours: { ...DEFAULT_SLA_RULES.deals.stage_hours, ...(saved.deals?.stage_hours || {}) },
    },
    escalation: { ...DEFAULT_SLA_RULES.escalation, ...saved.escalation },
  };
}

// ─── Check Violations ───────────────────────────────────────────────────────

async function handleCheckViolations(supabase: any, tenantId: string) {
  const rules = await getSlaRules(supabase, tenantId);
  const now = Date.now();
  const violations: Violation[] = [];

  // Fetch profiles for names
  const { data: profiles = [] } = await supabase
    .from("profiles")
    .select("user_id, name")
    .eq("tenant_id", tenantId)
    .limit(100);
  const profileMap = new Map<string, string>();
  for (const p of profiles) profileMap.set(p.user_id, p.name);

  // ── Lead SLA ──
  if (rules.leads.enabled) {
    const { data: leads = [] } = await supabase
      .from("leads")
      .select("id, name, status, assigned_to, created_at, last_contact_at")
      .eq("tenant_id", tenantId)
      .not("status", "in", '("convertido","perdido")')
      .limit(500);

    for (const lead of leads) {
      const createdAt = new Date(lead.created_at).getTime();

      if (!lead.last_contact_at) {
        // First response check
        const minutesElapsed = Math.floor((now - createdAt) / 60000);
        const target = rules.leads.first_response_minutes;
        if (minutesElapsed > target) {
          const pct = (minutesElapsed / target) * 100;
          violations.push({
            entity_type: "lead",
            entity_id: lead.id,
            entity_name: lead.name,
            sla_type: "first_response",
            sla_target_value: target,
            sla_target_unit: "min",
            actual_value: minutesElapsed,
            severity: pct >= rules.escalation.critical_threshold_pct ? "critical" : "warning",
            status: lead.status,
            assigned_to: lead.assigned_to,
            assigned_name: lead.assigned_to ? profileMap.get(lead.assigned_to) || null : null,
          });
        }
      } else {
        // Follow-up check
        const lastContact = new Date(lead.last_contact_at).getTime();
        const hoursElapsed = Math.floor((now - lastContact) / 3600000);
        const target = rules.leads.follow_up_hours;
        if (hoursElapsed > target) {
          const pct = (hoursElapsed / target) * 100;
          violations.push({
            entity_type: "lead",
            entity_id: lead.id,
            entity_name: lead.name,
            sla_type: "follow_up",
            sla_target_value: target,
            sla_target_unit: "h",
            actual_value: hoursElapsed,
            severity: pct >= rules.escalation.critical_threshold_pct ? "critical" : "warning",
            status: lead.status,
            assigned_to: lead.assigned_to,
            assigned_name: lead.assigned_to ? profileMap.get(lead.assigned_to) || null : null,
          });
        }
      }
    }
  }

  // ── Deal SLA ──
  if (rules.deals.enabled) {
    const { data: deals = [] } = await supabase
      .from("deal_requests")
      .select("id, title, status, assigned_to, updated_at, created_at")
      .eq("tenant_id", tenantId)
      .not("status", "in", '("concluido","cancelado")')
      .limit(500);

    for (const deal of deals) {
      const updatedAt = new Date(deal.updated_at).getTime();
      const hoursInStage = Math.floor((now - updatedAt) / 3600000);
      const targetHours = rules.deals.stage_hours[deal.status] || 72;

      if (hoursInStage > targetHours) {
        const pct = (hoursInStage / targetHours) * 100;
        violations.push({
          entity_type: "deal",
          entity_id: deal.id,
          entity_name: deal.title || "Negócio",
          sla_type: "stage_time",
          sla_target_value: targetHours,
          sla_target_unit: "h",
          actual_value: hoursInStage,
          severity: pct >= rules.escalation.critical_threshold_pct ? "critical" : "warning",
          status: deal.status,
          assigned_to: deal.assigned_to,
          assigned_name: deal.assigned_to ? profileMap.get(deal.assigned_to) || null : null,
        });
      }

      // Total time check
      const createdAt = new Date(deal.created_at).getTime();
      const totalDays = Math.floor((now - createdAt) / 86400000);
      if (totalDays > rules.deals.max_total_days) {
        violations.push({
          entity_type: "deal",
          entity_id: deal.id,
          entity_name: deal.title || "Negócio",
          sla_type: "total_time",
          sla_target_value: rules.deals.max_total_days,
          sla_target_unit: "d",
          actual_value: totalDays,
          severity: "critical",
          status: deal.status,
          assigned_to: deal.assigned_to,
          assigned_name: deal.assigned_to ? profileMap.get(deal.assigned_to) || null : null,
        });
      }
    }
  }

  // Sort: critical first, then by actual_value desc
  violations.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return b.actual_value - a.actual_value;
  });

  // ── Auto-escalation ──
  let escalated = 0;
  if (rules.escalation.auto_escalate) {
    const criticals = violations.filter((v) => v.severity === "critical");
    if (criticals.length > 0 && rules.escalation.escalation_targets.length > 0) {
      // Log escalation to automation_logs
      const escalationLogs = criticals.slice(0, 10).map((v) => ({
        tenant_id: tenantId,
        trigger_event: "sla_violation_critical",
        action_type: "escalation",
        action_taken: `SLA ${v.sla_type} violado: ${v.entity_name} (${v.actual_value}${v.sla_target_unit} / SLA ${v.sla_target_value}${v.sla_target_unit})`,
        status: "executado",
        notes: `severity:critical | entity:${v.entity_type}:${v.entity_id}`,
      }));

      const { data: inserted } = await supabase
        .from("commercial_automation_logs")
        .insert(escalationLogs)
        .select("id");
      escalated = inserted?.length || 0;
    }
  }

  // ── Auto-notify via pulse ──
  let notified = 0;
  if (rules.escalation.auto_notify) {
    const newViolations = violations.filter((v) => v.severity === "critical").slice(0, 5);
    if (newViolations.length > 0) {
      const pulseEvents = newViolations.map((v) => ({
        tenant_id: tenantId,
        event_type: "sla_violation",
        entity_type: v.entity_type,
        entity_id: v.entity_id,
        title: `SLA Violado: ${v.entity_name}`,
        description: `${v.sla_type === "first_response" ? "Primeiro contato" : v.sla_type === "follow_up" ? "Follow-up" : v.sla_type === "stage_time" ? "Tempo no estágio" : "Tempo total"} — ${v.actual_value}${v.sla_target_unit} (SLA: ${v.sla_target_value}${v.sla_target_unit})`,
        priority: "high",
        urgency_score: 90,
        metadata: {
          sla_type: v.sla_type,
          severity: v.severity,
          actual: v.actual_value,
          target: v.sla_target_value,
        },
      }));

      const { data: inserted } = await supabase
        .from("pulse_events")
        .insert(pulseEvents)
        .select("id");
      notified = inserted?.length || 0;
    }
  }

  // Summary
  const summary = {
    total_violations: violations.length,
    critical: violations.filter((v) => v.severity === "critical").length,
    warning: violations.filter((v) => v.severity === "warning").length,
    by_type: {
      first_response: violations.filter((v) => v.sla_type === "first_response").length,
      follow_up: violations.filter((v) => v.sla_type === "follow_up").length,
      stage_time: violations.filter((v) => v.sla_type === "stage_time").length,
      total_time: violations.filter((v) => v.sla_type === "total_time").length,
    },
    escalated,
    notified,
  };

  return { violations: violations.slice(0, 50), summary, rules };
}

// ─── Get Dashboard ──────────────────────────────────────────────────────────

async function handleGetDashboard(supabase: any, tenantId: string) {
  const result = await handleCheckViolations(supabase, tenantId);

  // Compute compliance rates
  const { data: leads = [] } = await supabase
    .from("leads")
    .select("id, last_contact_at, created_at")
    .eq("tenant_id", tenantId)
    .not("status", "in", '("convertido","perdido")')
    .limit(500);

  const rules = result.rules;
  let respondedWithinSla = 0;
  let totalResponded = 0;

  for (const lead of leads) {
    if (lead.last_contact_at) {
      totalResponded++;
      const responseMinutes = Math.floor(
        (new Date(lead.last_contact_at).getTime() - new Date(lead.created_at).getTime()) / 60000
      );
      if (responseMinutes <= rules.leads.first_response_minutes) respondedWithinSla++;
    }
  }

  const complianceRate = totalResponded > 0
    ? Math.round((respondedWithinSla / totalResponded) * 100)
    : 100;

  // Avg response time
  let totalResponse = 0;
  let responseCount = 0;
  for (const lead of leads) {
    if (lead.last_contact_at) {
      const mins = Math.floor(
        (new Date(lead.last_contact_at).getTime() - new Date(lead.created_at).getTime()) / 60000
      );
      if (mins > 0 && mins < 10080) { // < 7 days
        totalResponse += mins;
        responseCount++;
      }
    }
  }
  const avgResponseMinutes = responseCount > 0 ? Math.round(totalResponse / responseCount) : 0;

  return {
    ...result,
    compliance: {
      first_response_rate: complianceRate,
      avg_response_minutes: avgResponseMinutes,
      total_leads: leads.length,
      responded: totalResponded,
      pending_response: leads.length - totalResponded,
    },
  };
}

// ─── Escalate ───────────────────────────────────────────────────────────────

async function handleEscalate(
  supabase: any,
  tenantId: string,
  violationIds: string[],
  targetUserId: string
) {
  // Log escalation
  const logs = violationIds.map((vId) => ({
    tenant_id: tenantId,
    trigger_event: "sla_manual_escalation",
    action_type: "escalation",
    action_taken: `Manual escalation to ${targetUserId} for violation ${vId}`,
    status: "executado",
    notes: `target_user:${targetUserId}`,
  }));

  const { data, error } = await supabase
    .from("commercial_automation_logs")
    .insert(logs)
    .select("id");

  if (error) return { error: error.message };
  return { escalated: data?.length || 0 };
}

// ─── Update Rules ───────────────────────────────────────────────────────────

async function handleUpdateRules(supabase: any, tenantId: string, newRules: Partial<SlaRules>) {
  const current = await getSlaRules(supabase, tenantId);
  const merged: SlaRules = {
    leads: { ...current.leads, ...(newRules.leads || {}) },
    deals: {
      ...current.deals,
      ...(newRules.deals || {}),
      stage_hours: {
        ...current.deals.stage_hours,
        ...(newRules.deals?.stage_hours || {}),
      },
    },
    escalation: { ...current.escalation, ...(newRules.escalation || {}) },
  };

  // Save to tenants.settings.sla_rules_v2
  const { data: tenant } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();

  const settings = tenant?.settings || {};
  settings.sla_rules_v2 = merged;

  const { error } = await supabase
    .from("tenants")
    .update({ settings })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  return { success: true, rules: merged };
}

// ─── Get History ────────────────────────────────────────────────────────────

async function handleGetHistory(supabase: any, tenantId: string, limit: number = 50) {
  const { data, error } = await supabase
    .from("commercial_automation_logs")
    .select("id, trigger_event, action_type, action_taken, status, created_at, notes")
    .eq("tenant_id", tenantId)
    .in("trigger_event", ["sla_violation_critical", "sla_manual_escalation"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { error: error.message };
  return { history: data || [] };
}

// ─── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req.headers.get("origin") || "") });
  }

  try {
    const origin = req.headers.get("origin") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || ""
    );

    const { tenantId } = await resolveAuth(req, supabase);

    let body: any = {};
    if (req.method === "POST") body = await req.json();

    const { action, ...params } = body;
    let result: any;

    switch (action) {
      case "check_violations":
        result = await handleCheckViolations(supabase, tenantId);
        break;
      case "get_dashboard":
        result = await handleGetDashboard(supabase, tenantId);
        break;
      case "escalate":
        result = await handleEscalate(supabase, tenantId, params.violation_ids || [], params.target_user_id || "");
        break;
      case "get_rules":
        result = await getSlaRules(supabase, tenantId);
        break;
      case "update_rules":
        result = await handleUpdateRules(supabase, tenantId, params.rules || {});
        break;
      case "get_history":
        result = await handleGetHistory(supabase, tenantId, params.limit || 50);
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
  } catch (err: any) {
    console.error("SLA Engine error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("origin") || ""), "Content-Type": "application/json" },
    });
  }
});
