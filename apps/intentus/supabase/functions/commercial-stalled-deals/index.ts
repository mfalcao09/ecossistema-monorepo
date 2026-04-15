// commercial-stalled-deals v1 — Stalled Deals Detection Engine
// Self-contained Edge Function (Supabase deploy bundler doesn't resolve ../_shared/)
// Actions: detect, get_dashboard, suggest_actions
// Scoring: Multi-factor (days_in_stage, deal_value, last_contact, stage_criticality)
// IA: OpenRouter → Gemini 2.0 Flash for action suggestions
// CORS whitelist + auth/tenant inline

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ───────────────────────────────────────────────────────────────────
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];
const DEV_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PREVIEW_REGEX = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  const extra = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (extra.includes(origin)) return true;
  return DEV_REGEX.test(origin) || PREVIEW_REGEX.test(origin);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : PROD_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface StalledDeal {
  deal_id: string;
  deal_type: string;
  status: string;
  property_title: string | null;
  proposed_value: number;
  proposed_monthly_value: number;
  days_in_stage: number;
  threshold_days: number;
  stall_score: number; // 0-100
  stall_level: "warning" | "critical";
  assigned_to: string | null;
  assigned_name: string | null;
  last_contact_days: number | null;
  created_at: string;
  factors: {
    days_factor: number;
    value_factor: number;
    contact_factor: number;
    criticality_factor: number;
  };
}

interface DashboardData {
  total_stalled: number;
  critical_count: number;
  warning_count: number;
  avg_days_stalled: number;
  total_value_at_risk: number;
  top_stalled: StalledDeal[];
  by_status: Record<string, number>;
  by_deal_type: Record<string, number>;
}

interface ActionSuggestion {
  action: string;
  urgency: "alta" | "media" | "baixa";
  reason: string;
  talking_points: string[];
  recommended_next_status: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────
// Default thresholds per status (days). Pipeline columns can override via wip_limit or custom config
const DEFAULT_THRESHOLDS: Record<string, number> = {
  rascunho: 7,
  enviado_juridico: 5,
  analise_documental: 7,
  aguardando_documentos: 10,
  parecer_em_elaboracao: 7,
  parecer_negativo: 3,
  minuta_em_elaboracao: 10,
  em_validacao: 5,
  ajustes_pendentes: 7,
  aprovado_comercial: 5,
  contrato_finalizado: 3,
  em_assinatura: 5,
};

// Terminal statuses — never considered stalled
const TERMINAL_STATUSES = ["concluido", "cancelado"];

// Stage criticality weights (higher = more critical stage to be stuck in)
const STAGE_CRITICALITY: Record<string, number> = {
  rascunho: 0.3,
  enviado_juridico: 0.5,
  analise_documental: 0.6,
  aguardando_documentos: 0.7,
  parecer_em_elaboracao: 0.6,
  parecer_negativo: 0.9,
  minuta_em_elaboracao: 0.7,
  em_validacao: 0.8,
  ajustes_pendentes: 0.8,
  aprovado_comercial: 0.9,
  contrato_finalizado: 0.95,
  em_assinatura: 0.95,
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function daysBetween(from: string, to: Date): number {
  const diff = to.getTime() - new Date(from).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function computeStallScore(
  daysInStage: number,
  thresholdDays: number,
  dealValue: number,
  lastContactDays: number | null,
  stageCriticality: number
): { score: number; factors: StalledDeal["factors"] } {
  // Factor 1: Days in stage relative to threshold (0-100, weight 40%)
  const daysRatio = Math.min(daysInStage / Math.max(thresholdDays, 1), 3); // cap at 3x threshold
  const daysFactor = Math.min(100, Math.round(daysRatio * 33.3));

  // Factor 2: Deal value (higher value = higher urgency) (0-100, weight 20%)
  const value = Math.max(dealValue, 0);
  // Log scale: R$10k=30, R$100k=60, R$500k=80, R$1M+=90
  const valueFactor = value <= 0 ? 20 : Math.min(100, Math.round(20 + Math.log10(Math.max(value, 1)) * 14));

  // Factor 3: Last contact recency (0-100, weight 25%)
  let contactFactor = 50; // default if unknown
  if (lastContactDays !== null) {
    if (lastContactDays <= 1) contactFactor = 10;
    else if (lastContactDays <= 3) contactFactor = 30;
    else if (lastContactDays <= 7) contactFactor = 50;
    else if (lastContactDays <= 14) contactFactor = 70;
    else if (lastContactDays <= 30) contactFactor = 85;
    else contactFactor = 100;
  }

  // Factor 4: Stage criticality (0-100, weight 15%)
  const criticalityFactor = Math.round(stageCriticality * 100);

  // Weighted score
  const score = Math.min(100, Math.round(
    daysFactor * 0.40 +
    valueFactor * 0.20 +
    contactFactor * 0.25 +
    criticalityFactor * 0.15
  ));

  return {
    score,
    factors: {
      days_factor: daysFactor,
      value_factor: valueFactor,
      contact_factor: contactFactor,
      criticality_factor: criticalityFactor,
    },
  };
}

// ─── Auth / Tenant Resolution ───────────────────────────────────────────────
async function resolveAuth(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.tenant_id) throw new Error("Tenant não encontrado");
  return { user, tenantId: profile.tenant_id as string };
}

// ─── Pipeline Column Thresholds ─────────────────────────────────────────────
async function getPipelineThresholds(
  supabase: ReturnType<typeof createClient>,
  tenantId: string
): Promise<Record<string, number>> {
  // Try to get per-column thresholds from pipeline_columns
  const { data: columns } = await supabase
    .from("pipeline_columns")
    .select("statuses, wip_limit, pipeline_template_id")
    .order("sort_order");

  // Also get pipeline templates to filter by tenant
  const { data: templates } = await supabase
    .from("pipeline_templates")
    .select("id")
    .eq("tenant_id", tenantId);

  const templateIds = new Set((templates || []).map((t: any) => t.id));
  const thresholds = { ...DEFAULT_THRESHOLDS };

  if (columns && columns.length > 0) {
    for (const col of columns) {
      if (!templateIds.has(col.pipeline_template_id)) continue;
      // Use wip_limit as threshold (days) if set and > 0
      if (col.wip_limit && col.wip_limit > 0 && Array.isArray(col.statuses)) {
        for (const status of col.statuses) {
          // Only override if wip_limit is explicitly set (non-zero)
          thresholds[status] = col.wip_limit;
        }
      }
    }
  }

  return thresholds;
}

// ─── Action: detect ─────────────────────────────────────────────────────────
async function handleDetect(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  body: any
): Promise<StalledDeal[]> {
  const now = new Date();
  const dealType = body?.deal_type || null; // optional filter
  const minScore = body?.min_score || 0;

  // Get thresholds
  const thresholds = await getPipelineThresholds(supabase, tenantId);

  // Fetch active (non-terminal) deals
  let query = supabase
    .from("deal_requests")
    .select("id, deal_type, status, proposed_value, proposed_monthly_value, assigned_to, created_at, property_id, properties:property_id(title)")
    .eq("tenant_id", tenantId)
    .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
    .limit(500);

  if (dealType) query = query.eq("deal_type", dealType);

  const { data: deals, error: dealsErr } = await query;
  if (dealsErr) throw dealsErr;
  if (!deals || deals.length === 0) return [];

  const dealIds = deals.map((d: any) => d.id);

  // Fetch latest history entry per deal (for accurate "days in current stage")
  const { data: historyEntries } = await supabase
    .from("deal_request_history")
    .select("deal_request_id, to_status, created_at")
    .in("deal_request_id", dealIds)
    .order("created_at", { ascending: false });

  // Build map: deal_id → latest history entry matching current status
  const latestStageEntry = new Map<string, string>();
  if (historyEntries) {
    const seen = new Set<string>();
    for (const entry of historyEntries) {
      const key = entry.deal_request_id;
      if (seen.has(key)) continue;
      // Find matching entry for current status
      const deal = deals.find((d: any) => d.id === key);
      if (deal && entry.to_status === deal.status) {
        latestStageEntry.set(key, entry.created_at);
        seen.add(key);
      }
    }
  }

  // Fetch assigned user names
  const assignedIds = [...new Set(deals.filter((d: any) => d.assigned_to).map((d: any) => d.assigned_to))];
  const assignedNames = new Map<string, string>();
  if (assignedIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name")
      .in("user_id", assignedIds);
    if (profiles) {
      for (const p of profiles) assignedNames.set(p.user_id, p.name || "Sem nome");
    }
  }

  // Fetch last interaction date per deal (via deal_request_comments)
  const { data: comments } = await supabase
    .from("deal_request_comments")
    .select("deal_request_id, created_at")
    .in("deal_request_id", dealIds)
    .order("created_at", { ascending: false });

  const lastCommentDate = new Map<string, string>();
  if (comments) {
    for (const c of comments) {
      if (!lastCommentDate.has(c.deal_request_id)) {
        lastCommentDate.set(c.deal_request_id, c.created_at);
      }
    }
  }

  // Compute stall scores
  const stalledDeals: StalledDeal[] = [];

  for (const deal of deals as any[]) {
    const status = deal.status;
    const threshold = thresholds[status] || 7;

    // Days in stage: use history entry if available, fallback to deal created_at
    const stageEnteredAt = latestStageEntry.get(deal.id) || deal.created_at;
    const daysInStage = daysBetween(stageEnteredAt, now);

    // Skip if not past warning threshold (50% of threshold)
    if (daysInStage < threshold * 0.5) continue;

    // Deal value
    const dealValue = Number(deal.proposed_value || 0) || Number(deal.proposed_monthly_value || 0) * 12;

    // Last contact
    const lastComment = lastCommentDate.get(deal.id);
    const lastContactDays = lastComment ? daysBetween(lastComment, now) : null;

    // Stage criticality
    const criticality = STAGE_CRITICALITY[status] || 0.5;

    const { score, factors } = computeStallScore(daysInStage, threshold, dealValue, lastContactDays, criticality);

    if (score < minScore) continue;

    const stallLevel: "warning" | "critical" = daysInStage >= threshold ? "critical" : "warning";

    stalledDeals.push({
      deal_id: deal.id,
      deal_type: deal.deal_type,
      status,
      property_title: (deal.properties as any)?.title || null,
      proposed_value: Number(deal.proposed_value || 0),
      proposed_monthly_value: Number(deal.proposed_monthly_value || 0),
      days_in_stage: daysInStage,
      threshold_days: threshold,
      stall_score: score,
      stall_level: stallLevel,
      assigned_to: deal.assigned_to,
      assigned_name: deal.assigned_to ? (assignedNames.get(deal.assigned_to) || null) : null,
      last_contact_days: lastContactDays,
      created_at: deal.created_at,
      factors,
    });
  }

  // Sort by stall_score descending
  stalledDeals.sort((a, b) => b.stall_score - a.stall_score);

  return stalledDeals;
}

// ─── Action: get_dashboard ──────────────────────────────────────────────────
async function handleDashboard(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  body: any
): Promise<DashboardData> {
  const stalledDeals = await handleDetect(supabase, tenantId, { ...body, min_score: 0 });

  const critical = stalledDeals.filter((d) => d.stall_level === "critical");
  const warnings = stalledDeals.filter((d) => d.stall_level === "warning");

  const avgDays = stalledDeals.length > 0
    ? Math.round(stalledDeals.reduce((s, d) => s + d.days_in_stage, 0) / stalledDeals.length)
    : 0;

  const totalValue = stalledDeals.reduce((s, d) => s + (d.proposed_value || d.proposed_monthly_value * 12), 0);

  // Group by status
  const byStatus: Record<string, number> = {};
  for (const d of stalledDeals) {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
  }

  // Group by deal_type
  const byDealType: Record<string, number> = {};
  for (const d of stalledDeals) {
    byDealType[d.deal_type] = (byDealType[d.deal_type] || 0) + 1;
  }

  return {
    total_stalled: stalledDeals.length,
    critical_count: critical.length,
    warning_count: warnings.length,
    avg_days_stalled: avgDays,
    total_value_at_risk: Math.round(totalValue * 100) / 100,
    top_stalled: stalledDeals.slice(0, 15),
    by_status: byStatus,
    by_deal_type: byDealType,
  };
}

// ─── Action: suggest_actions ────────────────────────────────────────────────
async function handleSuggestActions(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  body: any
): Promise<{ deal_id: string; suggestions: ActionSuggestion[]; model_used: string }> {
  const dealId = body?.deal_id;
  if (!dealId) throw new Error("deal_id é obrigatório");

  // Fetch deal details
  const { data: deal, error: dealErr } = await supabase
    .from("deal_requests")
    .select("*, properties:property_id(title, city, neighborhood), deal_request_parties(role, people:person_id(name))")
    .eq("id", dealId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (dealErr || !deal) throw new Error("Negócio não encontrado");

  // Fetch history
  const { data: history } = await supabase
    .from("deal_request_history")
    .select("from_status, to_status, notes, created_at")
    .eq("deal_request_id", dealId)
    .order("created_at", { ascending: true })
    .limit(20);

  // Fetch recent comments
  const { data: comments } = await supabase
    .from("deal_request_comments")
    .select("message, created_at")
    .eq("deal_request_id", dealId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Build context for IA
  const parties = (deal.deal_request_parties || []).map((p: any) => `${p.role}: ${p.people?.name || "N/A"}`).join(", ");
  const historyStr = (history || []).map((h: any) => `${h.from_status || "início"} → ${h.to_status} (${h.created_at?.slice(0, 10)})`).join(" | ");
  const commentsStr = (comments || []).slice(0, 3).map((c: any) => c.message?.slice(0, 100)).join("; ");
  const propertyInfo = deal.properties ? `${(deal.properties as any).title || ""}, ${(deal.properties as any).city || ""} - ${(deal.properties as any).neighborhood || ""}` : "Sem imóvel";

  const now = new Date();
  const thresholds = await getPipelineThresholds(supabase, tenantId);
  const threshold = thresholds[deal.status] || 7;

  // Try IA
  const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY");
  let modelUsed = "rule_engine_v1";
  let suggestions: ActionSuggestion[] = [];

  if (OPENROUTER_KEY) {
    try {
      const prompt = `Você é um consultor imobiliário especialista em destravar negócios parados.

CONTEXTO DO NEGÓCIO:
- Tipo: ${deal.deal_type}
- Status atual: ${deal.status} (parado há muito tempo, threshold: ${threshold} dias)
- Imóvel: ${propertyInfo}
- Valor proposto: R$ ${Number(deal.proposed_value || 0).toLocaleString("pt-BR")}
- Valor mensal: R$ ${Number(deal.proposed_monthly_value || 0).toLocaleString("pt-BR")}
- Partes: ${parties || "Não informadas"}
- Histórico de movimentação: ${historyStr || "Sem histórico"}
- Últimas mensagens: ${commentsStr || "Sem mensagens recentes"}
- Data de criação: ${deal.created_at?.slice(0, 10)}

Sugira 2-3 ações concretas para destravar este negócio. Para cada ação:
1. Descreva a ação de forma direta e prática
2. Classifique a urgência (alta/media/baixa)
3. Explique o motivo
4. Liste 2-3 pontos de conversa para o corretor usar
5. Se aplicável, sugira o próximo status do pipeline

Responda APENAS em JSON:
{
  "suggestions": [
    {
      "action": "string",
      "urgency": "alta|media|baixa",
      "reason": "string",
      "talking_points": ["string"],
      "recommended_next_status": "string|null"
    }
  ]
}`;

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": "https://app.intentusrealestate.com.br",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          response_format: { type: "json_object" },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.suggestions)) {
            suggestions = parsed.suggestions;
            modelUsed = "gemini-2.0-flash";
          }
        }
      }
    } catch (e) {
      console.error("IA suggestion error:", e);
    }
  }

  // Fallback rule-based
  if (suggestions.length === 0) {
    suggestions = generateRuleBasedSuggestions(deal, threshold);
    modelUsed = "rule_engine_v1";
  }

  return { deal_id: dealId, suggestions, model_used: modelUsed };
}

function generateRuleBasedSuggestions(deal: any, threshold: number): ActionSuggestion[] {
  const suggestions: ActionSuggestion[] = [];
  const status = deal.status;

  // Generic "follow up" action
  suggestions.push({
    action: "Entrar em contato com as partes envolvidas para alinhar pendências",
    urgency: "alta",
    reason: `Negócio está parado no status "${status}" além do prazo esperado de ${threshold} dias`,
    talking_points: [
      "Verificar se há documentação pendente",
      "Confirmar interesse das partes na continuidade",
      "Identificar e resolver bloqueios específicos",
    ],
    recommended_next_status: null,
  });

  // Status-specific suggestions
  if (["rascunho"].includes(status)) {
    suggestions.push({
      action: "Enviar solicitação ao jurídico para iniciar análise",
      urgency: "alta",
      reason: "Negócio em rascunho sem encaminhamento pode perder timing",
      talking_points: ["Documentação mínima já está completa?", "Há urgência do cliente?"],
      recommended_next_status: "enviado_juridico",
    });
  } else if (["aguardando_documentos"].includes(status)) {
    suggestions.push({
      action: "Cobrar documentação pendente das partes",
      urgency: "alta",
      reason: "Documentos pendentes são o principal bloqueio nesta fase",
      talking_points: ["Listar documentos faltantes", "Oferecer ajuda para obtenção", "Definir prazo limite"],
      recommended_next_status: null,
    });
  } else if (["parecer_negativo"].includes(status)) {
    suggestions.push({
      action: "Reavaliar viabilidade ou cancelar negócio",
      urgency: "alta",
      reason: "Parecer negativo sem ação indica negócio possivelmente inviável",
      talking_points: ["Motivo do parecer negativo", "Possibilidade de ajustes nas condições", "Considerar cancelamento formal"],
      recommended_next_status: "cancelado",
    });
  } else if (["aprovado_comercial", "contrato_finalizado", "em_assinatura"].includes(status)) {
    suggestions.push({
      action: "Agendar assinatura e concluir o negócio",
      urgency: "alta",
      reason: "Negócio aprovado/finalizado parado desperdiça oportunidade de fechamento",
      talking_points: ["Agendar data de assinatura", "Confirmar disponibilidade de todas as partes", "Preparar documentação final"],
      recommended_next_status: status === "em_assinatura" ? "concluido" : "em_assinatura",
    });
  }

  return suggestions;
}

// ─── Main Handler ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );

    const { user, tenantId } = await resolveAuth(supabase);
    const body = await req.json().catch(() => ({}));
    const action = body?.action || "detect";

    let result: unknown;

    switch (action) {
      case "detect":
        result = await handleDetect(supabase, tenantId, body);
        break;
      case "get_dashboard":
        result = await handleDashboard(supabase, tenantId, body);
        break;
      case "suggest_actions":
        result = await handleSuggestActions(supabase, tenantId, body);
        break;
      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("commercial-stalled-deals error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    const status = message.includes("autenticado") || message.includes("Tenant") ? 401 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
