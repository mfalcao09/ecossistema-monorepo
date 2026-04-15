// commercial-lead-distribution v1 — Distribuição Inteligente de Leads
// Self-contained Edge Function: CORS whitelist, auth/tenant inline, 5-factor scoring
// 4 actions: auto_assign, get_dashboard, configure_rules, get_assignment_history
// Strategies: round_robin, workload, score, region, hybrid
// Pair programming: Claudinho + Buchecha (sessão 79)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── CORS ────────────────────────────────────────────────────────────────────
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];
const DEV_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PREVIEW_RE = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

function allowedOrigin(req: Request): string {
  const o = req.headers.get("origin") ?? "";
  if (PROD_ORIGINS.includes(o)) return o;
  if (DEV_RE.test(o) || PREVIEW_RE.test(o)) return o;
  return PROD_ORIGINS[0];
}

function cors(req: Request, extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...extra,
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface BrokerProfile {
  id: string;          // profiles.id (PK)
  user_id: string;     // profiles.user_id (FK auth.users)
  name: string;
  department: string | null;
}

interface BrokerScore {
  broker: BrokerProfile;
  workloadScore: number;
  expertiseScore: number;
  regionScore: number;
  performanceScore: number;
  availabilityScore: number;
  totalScore: number;
  details: Record<string, unknown>;
}

interface DistributionRule {
  id: string;
  strategy: string;
  weight_workload: number;
  weight_expertise: number;
  weight_region: number;
  weight_performance: number;
  weight_availability: number;
  max_leads_per_broker: number;
  auto_assign_enabled: boolean;
  config: Record<string, unknown>;
}

// ─── Auth helpers ────────────────────────────────────────────────────────────
type UserRole = "superadmin" | "admin" | "gerente" | "corretor" | "financeiro" | "juridico" | "manutencao";

const ADMIN_ROLES: UserRole[] = ["superadmin", "admin", "gerente"];

async function resolveAuth(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("NOT_AUTHENTICATED");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.tenant_id) throw new Error("NO_TENANT");

  // Fetch user roles for authorization checks
  const { data: roleEntries } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", profile.tenant_id);

  const roles = (roleEntries || []).map((r: { role: string }) => r.role as UserRole);

  return { userId: user.id, profileId: profile.id, tenantId: profile.tenant_id, roles };
}

function hasAdminRole(roles: UserRole[]): boolean {
  return roles.some(r => ADMIN_ROLES.includes(r));
}

// ─── Scoring Functions ───────────────────────────────────────────────────────

/** Factor 1: Workload — fewer active leads = higher score */
async function calcWorkloadScore(
  supabase: ReturnType<typeof createClient>,
  broker: BrokerProfile,
  tenantId: string,
  maxLeads: number,
): Promise<{ score: number; activeLeads: number }> {
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("assigned_to", broker.user_id)
    .in("status", ["novo", "contatado", "qualificado", "visita_agendada", "proposta"]);

  const activeLeads = count ?? 0;
  // Score: 100 when 0 leads, 0 when at maxLeads
  const score = Math.max(0, Math.round(100 * (1 - activeLeads / Math.max(maxLeads, 1))));
  return { score, activeLeads };
}

/** Factor 2: Expertise — match broker department/config with lead interest */
function calcExpertiseScore(
  broker: BrokerProfile,
  leadInterestType: string | null,
  leadSource: string | null,
  config: Record<string, unknown>,
): { score: number; matched: string[] } {
  const matched: string[] = [];
  let score = 50; // base

  // Check broker specializations from config
  const specializations = (config.broker_specializations as Record<string, string[]>) || {};
  const brokerSpecs = specializations[broker.user_id] || [];

  if (leadInterestType && brokerSpecs.includes(leadInterestType)) {
    score += 30;
    matched.push(`interest:${leadInterestType}`);
  }

  // Department matching
  if (broker.department) {
    const dept = broker.department.toLowerCase();
    if (leadInterestType === "compra" && dept.includes("vend")) { score += 20; matched.push("dept:vendas"); }
    else if (leadInterestType === "locacao" && (dept.includes("loc") || dept.includes("admin"))) { score += 20; matched.push("dept:locacao"); }
    else if (leadInterestType === "investimento" && dept.includes("invest")) { score += 20; matched.push("dept:investimento"); }
  }

  // Source expertise
  const sourceSpecs = (config.source_expertise as Record<string, string[]>) || {};
  const brokerSources = sourceSpecs[broker.user_id] || [];
  if (leadSource && brokerSources.includes(leadSource)) {
    score += 10;
    matched.push(`source:${leadSource}`);
  }

  return { score: Math.min(100, score), matched };
}

/** Factor 3: Region — match broker regions with lead preferred_region */
function calcRegionScore(
  broker: BrokerProfile,
  leadRegion: string | null,
  config: Record<string, unknown>,
): { score: number; regionMatch: string | null } {
  if (!leadRegion) return { score: 50, regionMatch: null }; // neutral if no region

  const regionAssignments = (config.broker_regions as Record<string, string[]>) || {};
  const brokerRegions = regionAssignments[broker.user_id] || [];

  if (brokerRegions.length === 0) return { score: 40, regionMatch: null }; // no config

  const normalizedLead = leadRegion.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const region of brokerRegions) {
    const normalizedRegion = region.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Min 3 chars to avoid false positives (e.g. "de" matching "Rio de Janeiro")
    if (normalizedRegion.length >= 3 && normalizedLead.length >= 3) {
      if (normalizedLead.includes(normalizedRegion) || normalizedRegion.includes(normalizedLead)) {
        return { score: 100, regionMatch: region };
      }
    }
  }

  return { score: 20, regionMatch: null }; // no match
}

/** Factor 4: Performance — conversion rate from past leads */
async function calcPerformanceScore(
  supabase: ReturnType<typeof createClient>,
  broker: BrokerProfile,
  tenantId: string,
): Promise<{ score: number; conversionRate: number; totalAssigned: number; converted: number }> {
  // Count total leads assigned to broker (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { count: totalAssigned } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("assigned_to", broker.user_id)
    .gte("created_at", ninetyDaysAgo);

  const { count: converted } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("assigned_to", broker.user_id)
    .eq("status", "convertido")
    .gte("created_at", ninetyDaysAgo);

  const total = totalAssigned ?? 0;
  const conv = converted ?? 0;

  if (total === 0) return { score: 50, conversionRate: 0, totalAssigned: 0, converted: 0 }; // new broker, neutral

  const conversionRate = conv / total;
  // Score: 20% conversion = 100, 0% = 30
  const score = Math.min(100, Math.round(30 + conversionRate * 350));
  return { score, conversionRate: Math.round(conversionRate * 100), totalAssigned: total, converted: conv };
}

/** Factor 5: Availability — last contact recency + current queue freshness */
async function calcAvailabilityScore(
  supabase: ReturnType<typeof createClient>,
  broker: BrokerProfile,
  tenantId: string,
): Promise<{ score: number; lastAssignedDaysAgo: number }> {
  // When was the last lead assigned to this broker?
  const { data: lastLog } = await supabase
    .from("lead_assignment_logs")
    .select("created_at")
    .eq("tenant_id", tenantId)
    .eq("broker_id", broker.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastLog) return { score: 90, lastAssignedDaysAgo: -1 }; // never assigned, high availability

  const daysAgo = (Date.now() - new Date(lastLog.created_at).getTime()) / (24 * 60 * 60 * 1000);
  // Score: more recent assignment = lower availability (cooldown)
  // 0 days = 30, 1 day = 60, 3+ days = 100
  const score = Math.min(100, Math.round(30 + Math.min(daysAgo, 3) * 23.3));
  return { score, lastAssignedDaysAgo: Math.round(daysAgo * 10) / 10 };
}

// ─── Main scoring engine ─────────────────────────────────────────────────────
async function scoreBrokers(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  lead: { interest_type: string | null; source: string | null; preferred_region: string | null },
  brokers: BrokerProfile[],
  rule: DistributionRule,
): Promise<BrokerScore[]> {
  const results: BrokerScore[] = [];

  for (const broker of brokers) {
    const [workload, performance, availability] = await Promise.all([
      calcWorkloadScore(supabase, broker, tenantId, rule.max_leads_per_broker),
      calcPerformanceScore(supabase, broker, tenantId),
      calcAvailabilityScore(supabase, broker, tenantId),
    ]);

    const expertise = calcExpertiseScore(broker, lead.interest_type, lead.source, rule.config);
    const region = calcRegionScore(broker, lead.preferred_region, rule.config);

    // Weighted total
    const wW = rule.weight_workload / 100;
    const wE = rule.weight_expertise / 100;
    const wR = rule.weight_region / 100;
    const wP = rule.weight_performance / 100;
    const wA = rule.weight_availability / 100;

    const totalScore = Math.round(
      workload.score * wW +
      expertise.score * wE +
      region.score * wR +
      performance.score * wP +
      availability.score * wA
    );

    results.push({
      broker,
      workloadScore: workload.score,
      expertiseScore: expertise.score,
      regionScore: region.score,
      performanceScore: performance.score,
      availabilityScore: availability.score,
      totalScore,
      details: {
        activeLeads: workload.activeLeads,
        expertiseMatched: expertise.matched,
        regionMatch: region.regionMatch,
        conversionRate: performance.conversionRate,
        totalAssigned: performance.totalAssigned,
        converted: performance.converted,
        lastAssignedDaysAgo: availability.lastAssignedDaysAgo,
      },
    });
  }

  // Sort by totalScore descending
  results.sort((a, b) => b.totalScore - a.totalScore);
  return results;
}

// ─── Round Robin helper ──────────────────────────────────────────────────────
async function roundRobinPick(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  brokers: BrokerProfile[],
  maxLeads: number,
): Promise<BrokerProfile | null> {
  if (brokers.length === 0) return null;

  // Get last assigned broker
  const { data: lastLog } = await supabase
    .from("lead_assignment_logs")
    .select("broker_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const startIdx = lastLog
    ? (brokers.findIndex(b => b.user_id === lastLog.broker_id) + 1) % brokers.length
    : 0;

  // Iterate through brokers starting from next in line, skip those at capacity
  for (let i = 0; i < brokers.length; i++) {
    const candidate = brokers[(startIdx + i) % brokers.length];
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("assigned_to", candidate.user_id)
      .in("status", ["novo", "contatado", "qualificado", "visita_agendada", "proposta"]);
    if ((count ?? 0) < maxLeads) return candidate;
  }

  // All at capacity — return next in line anyway (graceful degradation)
  return brokers[startIdx % brokers.length];
}

// ─── Action Handlers ─────────────────────────────────────────────────────────

async function handleAutoAssign(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const leadId = body.lead_id as string;
  if (!leadId) return { error: "lead_id is required", status: 400 };

  // Fetch lead
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, name, interest_type, source, preferred_region, assigned_to, status")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (leadErr || !lead) return { error: "Lead not found", status: 404 };

  // Exclude terminal leads (convertido/perdido) — shouldn't be reassigned
  const TERMINAL_STATUSES = ["convertido", "perdido"];
  if (TERMINAL_STATUSES.includes(lead.status)) {
    return { data: { assigned: false, reason: "lead_status_terminal", lead_id: leadId } };
  }

  // Fetch active rule for tenant
  const { data: rule } = await supabase
    .from("lead_distribution_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!rule) return { error: "No active distribution rule configured", status: 404 };
  if (!rule.auto_assign_enabled) return { data: { assigned: false, reason: "auto_assign_disabled" } };

  // Fetch brokers (profiles with corretor/gerente/admin roles in this tenant)
  const { data: roleEntries } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .in("role", ["corretor", "gerente", "admin"]);

  if (!roleEntries || roleEntries.length === 0) {
    return { data: { assigned: false, reason: "no_eligible_brokers" } };
  }

  const brokerUserIds = [...new Set(roleEntries.map((r: { user_id: string }) => r.user_id))];

  const { data: brokerProfiles } = await supabase
    .from("profiles")
    .select("id, user_id, name, department")
    .eq("tenant_id", tenantId)
    .in("user_id", brokerUserIds);

  if (!brokerProfiles || brokerProfiles.length === 0) {
    return { data: { assigned: false, reason: "no_broker_profiles" } };
  }

  const brokers = brokerProfiles as BrokerProfile[];
  let selectedBroker: BrokerProfile | null = null;
  let scoring: BrokerScore[] = [];
  let strategyUsed = rule.strategy;

  if (rule.strategy === "round_robin") {
    selectedBroker = await roundRobinPick(supabase, tenantId, brokers, rule.max_leads_per_broker);
    scoring = selectedBroker ? [{
      broker: selectedBroker, workloadScore: 0, expertiseScore: 0, regionScore: 0,
      performanceScore: 0, availabilityScore: 0, totalScore: 0, details: { method: "round_robin" },
    }] : [];
  } else {
    // Score all brokers
    scoring = await scoreBrokers(supabase, tenantId, lead, brokers, rule as DistributionRule);

    if (scoring.length > 0) {
      // Filter out brokers at max capacity
      const eligible = scoring.filter(s => {
        const activeLeads = (s.details.activeLeads as number) || 0;
        return activeLeads < rule.max_leads_per_broker;
      });

      if (eligible.length > 0) {
        selectedBroker = eligible[0].broker;
      } else {
        // All at capacity — pick the one with least leads
        scoring.sort((a, b) => ((a.details.activeLeads as number) || 0) - ((b.details.activeLeads as number) || 0));
        selectedBroker = scoring[0].broker;
      }
    }
  }

  if (!selectedBroker) {
    return { data: { assigned: false, reason: "no_broker_selected" } };
  }

  // Assign lead
  const { error: updateErr } = await supabase
    .from("leads")
    .update({ assigned_to: selectedBroker.user_id, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("tenant_id", tenantId);

  if (updateErr) {
    console.error("Failed to assign lead:", updateErr);
    return { error: "Failed to assign lead", status: 500 };
  }

  // Log assignment (check for insert errors)
  const winnerScoring = scoring.find(s => s.broker.user_id === selectedBroker!.user_id);
  const { error: logErr } = await supabase.from("lead_assignment_logs").insert({
    tenant_id: tenantId,
    lead_id: leadId,
    broker_id: selectedBroker.user_id,
    broker_name: selectedBroker.name,
    strategy_used: strategyUsed,
    scoring: winnerScoring ? {
      workload: winnerScoring.workloadScore,
      expertise: winnerScoring.expertiseScore,
      region: winnerScoring.regionScore,
      performance: winnerScoring.performanceScore,
      availability: winnerScoring.availabilityScore,
      details: winnerScoring.details,
    } : { method: "round_robin" },
    total_score: winnerScoring?.totalScore ?? 0,
    assigned_by: "auto",
    previous_broker_id: lead.assigned_to || null,
  });

  if (logErr) {
    console.error("Failed to log assignment (lead was assigned):", logErr);
    // Don't fail — lead was already assigned, log is secondary
  }

  return {
    data: {
      assigned: true,
      lead_id: leadId,
      broker_id: selectedBroker.user_id,
      broker_name: selectedBroker.name,
      strategy: strategyUsed,
      total_score: winnerScoring?.totalScore ?? 0,
      scoring_breakdown: winnerScoring ? {
        workload: winnerScoring.workloadScore,
        expertise: winnerScoring.expertiseScore,
        region: winnerScoring.regionScore,
        performance: winnerScoring.performanceScore,
        availability: winnerScoring.availabilityScore,
      } : null,
      all_candidates: scoring.slice(0, 5).map(s => ({
        broker_id: s.broker.user_id,
        broker_name: s.broker.name,
        total_score: s.totalScore,
      })),
    },
  };
}

async function handleGetDashboard(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  roles: UserRole[],
) {
  if (!hasAdminRole(roles)) return { error: "Insufficient permissions", status: 403 };

  // Get active rule
  const { data: rule } = await supabase
    .from("lead_distribution_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get assignment stats (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: total30d },
    { count: total7d },
    { count: autoCount },
    { data: brokerStats },
  ] = await Promise.all([
    supabase.from("lead_assignment_logs").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo),
    supabase.from("lead_assignment_logs").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gte("created_at", sevenDaysAgo),
    supabase.from("lead_assignment_logs").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("assigned_by", "auto").gte("created_at", thirtyDaysAgo),
    supabase.from("lead_assignment_logs")
      .select("broker_id, broker_name, total_score, strategy_used, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  // Aggregate by broker
  const byBroker = new Map<string, { name: string; count: number; avgScore: number; scores: number[] }>();
  for (const log of (brokerStats || [])) {
    const existing = byBroker.get(log.broker_id) || { name: log.broker_name || "?", count: 0, avgScore: 0, scores: [] };
    existing.count++;
    existing.scores.push(Number(log.total_score) || 0);
    byBroker.set(log.broker_id, existing);
  }

  const brokerDistribution = Array.from(byBroker.entries()).map(([brokerId, data]) => ({
    broker_id: brokerId,
    broker_name: data.name,
    leads_assigned: data.count,
    avg_score: Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length),
  })).sort((a, b) => b.leads_assigned - a.leads_assigned);

  return {
    data: {
      rule: rule || null,
      stats: {
        total_assignments_30d: total30d ?? 0,
        total_assignments_7d: total7d ?? 0,
        auto_assignments_30d: autoCount ?? 0,
        manual_assignments_30d: (total30d ?? 0) - (autoCount ?? 0),
        auto_rate_pct: total30d ? Math.round(((autoCount ?? 0) / total30d) * 100) : 0,
      },
      broker_distribution: brokerDistribution,
    },
  };
}

async function handleConfigureRules(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  body: Record<string, unknown>,
  roles: UserRole[],
) {
  if (!hasAdminRole(roles)) return { error: "Insufficient permissions", status: 403 };

  const {
    strategy, weight_workload, weight_expertise, weight_region,
    weight_performance, weight_availability, max_leads_per_broker,
    auto_assign_enabled, config,
  } = body;

  // Validate strategy value
  const VALID_STRATEGIES = ["round_robin", "workload", "score", "region", "hybrid"];
  if (strategy && !VALID_STRATEGIES.includes(strategy as string)) {
    return { error: `Invalid strategy: ${strategy}`, status: 400 };
  }

  // Validate weights sum to 100 (for non-round_robin)
  if (strategy !== "round_robin") {
    const wSum = (Number(weight_workload) || 20) + (Number(weight_expertise) || 20) +
      (Number(weight_region) || 30) + (Number(weight_performance) || 15) + (Number(weight_availability) || 15);
    if (wSum !== 100) {
      return { error: `Weights must sum to 100 (current: ${wSum})`, status: 400 };
    }
  }

  // Deactivate existing rules for tenant
  await supabase
    .from("lead_distribution_rules")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  // Insert new rule
  const { data: newRule, error } = await supabase
    .from("lead_distribution_rules")
    .insert({
      tenant_id: tenantId,
      strategy: strategy || "hybrid",
      weight_workload: Number(weight_workload) ?? 20,
      weight_expertise: Number(weight_expertise) ?? 20,
      weight_region: Number(weight_region) ?? 30,
      weight_performance: Number(weight_performance) ?? 15,
      weight_availability: Number(weight_availability) ?? 15,
      max_leads_per_broker: Number(max_leads_per_broker) ?? 50,
      auto_assign_enabled: auto_assign_enabled !== false,
      config: config || {},
      is_active: true,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create rule:", error);
    return { error: "Failed to save configuration", status: 500 };
  }

  return { data: { rule: newRule, message: "Configuration saved" } };
}

async function handleGetHistory(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  body: Record<string, unknown>,
  roles: UserRole[],
) {
  if (!hasAdminRole(roles)) return { error: "Insufficient permissions", status: 403 };

  const leadId = body.lead_id as string | undefined;
  const brokerId = body.broker_id as string | undefined;
  const limit = Math.min(Number(body.limit) || 50, 200);
  const offset = Number(body.offset) || 0;

  let query = supabase
    .from("lead_assignment_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (leadId) query = query.eq("lead_id", leadId);
  if (brokerId) query = query.eq("broker_id", brokerId);

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch history:", error);
    return { error: "Failed to fetch history", status: 500 };
  }

  return { data: { logs: data || [], count: data?.length ?? 0 } };
}

// ─── Main Handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { userId, tenantId, roles } = await resolveAuth(supabase);
    const body = await req.json().catch(() => ({}));
    const action = (body.action as string) || "auto_assign";

    let result: { data?: unknown; error?: string; status?: number };

    switch (action) {
      case "auto_assign":
        result = await handleAutoAssign(supabase, tenantId, userId, body);
        break;
      case "get_dashboard":
        result = await handleGetDashboard(supabase, tenantId, roles);
        break;
      case "configure_rules":
        result = await handleConfigureRules(supabase, tenantId, userId, body, roles);
        break;
      case "get_assignment_history":
        result = await handleGetHistory(supabase, tenantId, body, roles);
        break;
      default:
        result = { error: "Unknown action", status: 400 };
    }

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status || 400,
        headers: { ...cors(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result.data), {
      status: 200,
      headers: { ...cors(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("commercial-lead-distribution error:", err);

    if (msg === "NOT_AUTHENTICATED") {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...cors(req), "Content-Type": "application/json" },
      });
    }
    if (msg === "NO_TENANT") {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 403, headers: { ...cors(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...cors(req), "Content-Type": "application/json" },
    });
  }
});
