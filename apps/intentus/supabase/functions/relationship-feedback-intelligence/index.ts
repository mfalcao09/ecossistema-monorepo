/**
 * relationship-feedback-intelligence — v1
 * F10: Feedback Intelligence Loop
 *
 * 12 actions:
 *   - get_clusters: List feedback clusters for tenant (with filters)
 *   - add_cluster: Create manual cluster
 *   - update_cluster: Update cluster data
 *   - get_patterns: List detected patterns (with filters)
 *   - get_action_items: List action items (with filters)
 *   - add_action_item: Create action item
 *   - update_action_item: Update action item status/assignment
 *   - analyze_feedback: AI clusters feedback items
 *   - detect_patterns: AI detects patterns from clusters
 *   - generate_actions: AI generates action items from clusters+patterns
 *   - get_dashboard: Dashboard statistics
 *   - get_trend_analysis: Trend data for charts
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
const CLUSTER_ANALYSIS_TOOL = [
  {
    functionDeclarations: [
      {
        name: "feedback_cluster_analysis",
        description: "Análise e agrupamento de feedback em clusters com insights acionáveis",
        parameters: {
          type: "OBJECT",
          properties: {
            cluster_name: { type: "STRING", description: "Nome descritivo do cluster" },
            primary_category: {
              type: "STRING",
              description: "Categoria: atendimento, manutencao, financeiro, comunicacao, documentacao, seguranca, infraestrutura, limpeza, vizinhanca, localizacao, contratuais, tecnologia, other, geral, processo",
            },
            ai_summary: { type: "STRING", description: "Resumo executivo do cluster em 3-5 frases" },
            ai_root_causes: {
              type: "ARRAY", items: { type: "STRING" },
              description: "Causas raiz identificadas",
            },
            ai_recommendations: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  action: { type: "STRING", description: "Ação recomendada" },
                  priority: { type: "STRING", description: "alta, media, baixa" },
                  impact: { type: "STRING", description: "Impacto esperado" },
                },
              },
              description: "Recomendações de melhoria",
            },
            sentiment_distribution: {
              type: "OBJECT",
              properties: {
                very_negative: { type: "NUMBER" },
                negative: { type: "NUMBER" },
                neutral: { type: "NUMBER" },
                positive: { type: "NUMBER" },
                very_positive: { type: "NUMBER" },
              },
              description: "Distribuição percentual de sentimento",
            },
            trend: { type: "STRING", description: "improving, stable, declining, new" },
            impact_score: { type: "NUMBER", description: "Score de impacto (0-100)" },
            churn_correlation: { type: "NUMBER", description: "Correlação com churn (0-1)" },
          },
          required: ["cluster_name", "primary_category", "ai_summary", "ai_root_causes", "ai_recommendations", "sentiment_distribution", "trend", "impact_score", "churn_correlation"],
        },
      },
    ],
  },
];

const PATTERN_DETECTION_TOOL = [
  {
    functionDeclarations: [
      {
        name: "pattern_detection",
        description: "Detecção de padrões recorrentes em clusters de feedback",
        parameters: {
          type: "OBJECT",
          properties: {
            patterns: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  pattern_type: { type: "STRING", description: "recurring, seasonal, escalating, emerging, resolved" },
                  description: { type: "STRING", description: "Descrição detalhada do padrão" },
                  severity: { type: "STRING", description: "critical, high, medium, low" },
                  priority_score: { type: "NUMBER", description: "Score de prioridade (0-100)" },
                  ai_analysis: { type: "STRING", description: "Análise detalhada" },
                  ai_prediction: { type: "STRING", description: "Previsão de evolução" },
                  ai_suggested_fix: { type: "STRING", description: "Solução sugerida" },
                  affected_categories: { type: "ARRAY", items: { type: "STRING" }, description: "Categorias afetadas" },
                },
              },
              description: "Padrões detectados",
            },
          },
          required: ["patterns"],
        },
      },
    ],
  },
];

const ACTION_GENERATION_TOOL = [
  {
    functionDeclarations: [
      {
        name: "action_generation",
        description: "Geração de ações corretivas baseadas em clusters e padrões de feedback",
        parameters: {
          type: "OBJECT",
          properties: {
            actions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING", description: "Título da ação" },
                  description: { type: "STRING", description: "Descrição detalhada" },
                  action_type: { type: "STRING", description: "improvement, fix, process_change, training, communication, product, policy, other" },
                  priority: { type: "STRING", description: "critical, high, medium, low" },
                  effort_estimate: { type: "STRING", description: "Ex: '2 semanas', '1 sprint', '3 meses'" },
                  impact_score: { type: "NUMBER", description: "Score de impacto (0-100)" },
                  affected_clients_estimate: { type: "NUMBER", description: "Estimativa de clientes afetados" },
                  ai_rationale: { type: "STRING", description: "Justificativa da IA para esta ação" },
                },
              },
              description: "Ações geradas",
            },
          },
          required: ["actions"],
        },
      },
    ],
  },
];

// ── Handlers ────────────────────────────────────────────────

async function handleGetClusters(client: any, tenantId: string, body: any, cors: any) {
  let q = client.from("feedback_clusters").select("*").eq("tenant_id", tenantId).order("impact_score", { ascending: false });
  if (body.filters?.is_active !== undefined) q = q.eq("is_active", body.filters.is_active);
  if (body.filters?.primary_category) q = q.eq("primary_category", body.filters.primary_category);
  if (body.filters?.trend) q = q.eq("trend", body.filters.trend);
  if (body.filters?.limit) q = q.limit(body.filters.limit);
  const { data, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data: data || [] }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleAddCluster(client: any, tenantId: string, body: any, cors: any) {
  const { cluster_name, primary_category, feedback_ids } = body;
  if (!cluster_name || !primary_category) return new Response(JSON.stringify({ error: "cluster_name e primary_category obrigatórios" }), { status: 400, headers: cors });
  const { data, error } = await client.from("feedback_clusters").insert({
    tenant_id: tenantId, cluster_name, cluster_type: "manual",
    primary_category, feedback_ids: feedback_ids || [], is_active: true,
  }).select("*").single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data }), { status: 201, headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleUpdateCluster(client: any, tenantId: string, body: any, cors: any) {
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: "id obrigatório" }), { status: 400, headers: cors });
  const { data, error } = await client.from("feedback_clusters")
    .update(updates).eq("id", id).eq("tenant_id", tenantId).select("*").maybeSingle();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleGetPatterns(client: any, tenantId: string, body: any, cors: any) {
  let q = client.from("feedback_patterns").select("*").eq("tenant_id", tenantId).order("priority_score", { ascending: false });
  if (body.filters?.is_active !== undefined) q = q.eq("is_active", body.filters.is_active);
  if (body.filters?.severity) q = q.eq("severity", body.filters.severity);
  if (body.filters?.pattern_type) q = q.eq("pattern_type", body.filters.pattern_type);
  if (body.filters?.limit) q = q.limit(body.filters.limit);
  const { data, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data: data || [] }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleGetActionItems(client: any, tenantId: string, body: any, cors: any) {
  let q = client.from("feedback_action_items").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  if (body.filters?.action_status) q = q.eq("action_status", body.filters.action_status);
  if (body.filters?.priority) q = q.eq("priority", body.filters.priority);
  if (body.filters?.limit) q = q.limit(body.filters.limit);
  const { data, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data: data || [] }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleAddActionItem(client: any, tenantId: string, body: any, cors: any) {
  const { title, description, action_type, priority, source_cluster_id, source_pattern_id, assigned_to, due_date, effort_estimate } = body;
  if (!title || !action_type) return new Response(JSON.stringify({ error: "title e action_type obrigatórios" }), { status: 400, headers: cors });
  const { data, error } = await client.from("feedback_action_items").insert({
    tenant_id: tenantId, title, description: description || null,
    action_type, action_status: "open", priority: priority || "medium",
    source_cluster_id: source_cluster_id || null, source_pattern_id: source_pattern_id || null,
    assigned_to: assigned_to || null, due_date: due_date || null,
    effort_estimate: effort_estimate || null, ai_generated: false,
  }).select("*").single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data }), { status: 201, headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleUpdateActionItem(client: any, tenantId: string, body: any, cors: any) {
  const { id, ...updates } = body;
  if (!id) return new Response(JSON.stringify({ error: "id obrigatório" }), { status: 400, headers: cors });
  if (updates.action_status === "completed" && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
  }
  const { data, error } = await client.from("feedback_action_items")
    .update(updates).eq("id", id).eq("tenant_id", tenantId).select("*").maybeSingle();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ data }), { headers: { ...cors, "Content-Type": "application/json" } });
}

// ── AI Handlers ─────────────────────────────────────────────

async function handleAnalyzeFeedback(client: any, tenantId: string, userId: string, body: any, cors: any) {
  const { feedback_ids } = body;
  if (!feedback_ids || !Array.isArray(feedback_ids) || feedback_ids.length === 0) {
    return new Response(JSON.stringify({ error: "feedback_ids (array) obrigatório" }), { status: 400, headers: cors });
  }
  const t0 = Date.now();

  // Fetch feedback items
  const { data: feedbackItems, error: fe } = await client.from("exit_feedback")
    .select("*, exit_interviews!inner(exit_type, exit_reason_primary, ai_sentiment, ai_churn_category)")
    .in("id", feedback_ids).eq("tenant_id", tenantId);
  if (fe) return new Response(JSON.stringify({ error: fe.message }), { status: 500, headers: cors });
  if (!feedbackItems?.length) return new Response(JSON.stringify({ error: "Nenhum feedback encontrado" }), { status: 404, headers: cors });

  const persona = await resolvePersona("feedback_intelligence_ai", tenantId);
  const prompt = `Analise estes ${feedbackItems.length} feedbacks de clientes do mercado imobiliário e agrupe em um cluster coerente.

FEEDBACK ITEMS:
${JSON.stringify(feedbackItems.map((f: any) => ({
  id: f.id, category: f.category, rating: f.rating, importance: f.importance,
  feedback_text: f.feedback_text, ai_sentiment: f.ai_sentiment, ai_theme: f.ai_theme,
  exit_type: f.exit_interviews?.exit_type, exit_reason: f.exit_interviews?.exit_reason_primary,
  interview_sentiment: f.exit_interviews?.ai_sentiment,
})), null, 2)}

Gere: nome do cluster, categoria principal, resumo, causas raiz, recomendações, distribuição de sentimento, tendência, score de impacto e correlação com churn.`;

  const aiResp = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: CLUSTER_ANALYSIS_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY" } },
  });

  const aiJson = await aiResp.json();
  const fc = aiJson?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  if (!fc?.args) return new Response(JSON.stringify({ error: "IA não retornou análise" }), { status: 502, headers: cors });

  const result = fc.args;

  // Calculate aggregate metrics from feedback
  const avgRating = feedbackItems.reduce((s: number, f: any) => s + (f.rating || 0), 0) / feedbackItems.length;
  const avgImportance = feedbackItems.reduce((s: number, f: any) => s + (f.importance || 0), 0) / feedbackItems.length;

  // Upsert cluster
  const { data: cluster, error: ce } = await client.from("feedback_clusters").insert({
    tenant_id: tenantId, cluster_name: result.cluster_name, cluster_type: "ai_generated",
    primary_category: result.primary_category, feedback_count: feedbackItems.length,
    avg_rating: Math.round(avgRating * 100) / 100,
    avg_importance: Math.round(avgImportance * 100) / 100,
    sentiment_distribution: result.sentiment_distribution || {},
    trend: result.trend || "new",
    impact_score: Math.min(100, Math.max(0, result.impact_score || 50)),
    churn_correlation: Math.min(1, Math.max(0, result.churn_correlation || 0.5)),
    ai_summary: result.ai_summary, ai_root_causes: result.ai_root_causes || [],
    ai_recommendations: result.ai_recommendations || [],
    feedback_ids, is_active: true,
  }).select("*").single();
  if (ce) return new Response(JSON.stringify({ error: ce.message }), { status: 500, headers: cors });

  logInteraction({ tenantId, userId, functionKey: "feedback_intelligence_ai", inputSummary: `analyze_feedback: ${feedbackItems.length} items`, outputSummary: `cluster=${result.cluster_name}, impact=${result.impact_score}`, responseTimeMs: Date.now() - t0 });

  return new Response(JSON.stringify({ data: { cluster, analysis: result } }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleDetectPatterns(client: any, tenantId: string, userId: string, body: any, cors: any) {
  const t0 = Date.now();

  // Fetch active clusters
  const { data: clusters, error: ce } = await client.from("feedback_clusters")
    .select("*").eq("tenant_id", tenantId).eq("is_active", true).order("impact_score", { ascending: false }).limit(20);
  if (ce) return new Response(JSON.stringify({ error: ce.message }), { status: 500, headers: cors });
  if (!clusters?.length) return new Response(JSON.stringify({ error: "Nenhum cluster ativo encontrado" }), { status: 404, headers: cors });

  const persona = await resolvePersona("feedback_intelligence_ai", tenantId);
  const prompt = `Analise estes ${clusters.length} clusters de feedback e detecte padrões recorrentes, sazonais, escalatórios ou emergentes.

CLUSTERS ATIVOS:
${JSON.stringify(clusters.map((c: any) => ({
  id: c.id, name: c.cluster_name, category: c.primary_category,
  feedback_count: c.feedback_count, avg_rating: c.avg_rating,
  trend: c.trend, impact_score: c.impact_score,
  churn_correlation: c.churn_correlation, summary: c.ai_summary,
  root_causes: c.ai_root_causes, created_at: c.created_at,
})), null, 2)}

Detecte padrões: tipo, descrição, severidade, prioridade, análise, previsão, solução sugerida e categorias afetadas.`;

  const aiResp = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: PATTERN_DETECTION_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY" } },
  });

  const aiJson = await aiResp.json();
  const fc = aiJson?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  if (!fc?.args?.patterns) return new Response(JSON.stringify({ error: "IA não retornou padrões" }), { status: 502, headers: cors });

  const patterns = fc.args.patterns;

  // Insert detected patterns
  const patternRows = patterns.map((p: any) => ({
    tenant_id: tenantId, pattern_type: p.pattern_type || "recurring",
    detection_method: "ai", description: p.description || "",
    severity: p.severity || "medium",
    priority_score: Math.min(100, Math.max(0, p.priority_score || 50)),
    occurrences: 1, first_detected_at: new Date().toISOString(),
    last_detected_at: new Date().toISOString(),
    related_clusters: clusters.map((c: any) => c.id),
    affected_categories: p.affected_categories || [],
    ai_analysis: p.ai_analysis || null, ai_prediction: p.ai_prediction || null,
    ai_suggested_fix: p.ai_suggested_fix || null, is_active: true,
  }));

  const { data: inserted, error: pe } = await client.from("feedback_patterns").insert(patternRows).select("*");
  if (pe) return new Response(JSON.stringify({ error: pe.message }), { status: 500, headers: cors });

  logInteraction({ tenantId, userId, functionKey: "feedback_intelligence_ai", inputSummary: `detect_patterns: ${clusters.length} clusters`, outputSummary: `${patterns.length} patterns detected`, responseTimeMs: Date.now() - t0 });

  return new Response(JSON.stringify({ data: inserted || [] }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleGenerateActions(client: any, tenantId: string, userId: string, body: any, cors: any) {
  const t0 = Date.now();

  // Fetch active clusters + patterns
  const [clustersRes, patternsRes] = await Promise.all([
    client.from("feedback_clusters").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("impact_score", { ascending: false }).limit(15),
    client.from("feedback_patterns").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("priority_score", { ascending: false }).limit(10),
  ]);
  if (clustersRes.error) return new Response(JSON.stringify({ error: clustersRes.error.message }), { status: 500, headers: cors });

  const clusters = clustersRes.data || [];
  const patterns = patternsRes.data || [];
  if (!clusters.length && !patterns.length) return new Response(JSON.stringify({ error: "Nenhum cluster ou padrão ativo" }), { status: 404, headers: cors });

  const persona = await resolvePersona("feedback_intelligence_ai", tenantId);
  const prompt = `Com base nos clusters e padrões de feedback, gere ações corretivas prioritárias para a empresa imobiliária.

CLUSTERS (${clusters.length}):
${JSON.stringify(clusters.map((c: any) => ({
  name: c.cluster_name, category: c.primary_category, impact: c.impact_score,
  churn: c.churn_correlation, trend: c.trend, summary: c.ai_summary,
  recommendations: c.ai_recommendations,
})), null, 2)}

PADRÕES (${patterns.length}):
${JSON.stringify(patterns.map((p: any) => ({
  type: p.pattern_type, severity: p.severity, priority: p.priority_score,
  description: p.description, analysis: p.ai_analysis,
  suggested_fix: p.ai_suggested_fix,
})), null, 2)}

Gere ações: título, descrição, tipo, prioridade, estimativa de esforço, score de impacto, clientes afetados e justificativa.`;

  const aiResp = await callGemini({
    persona,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: ACTION_GENERATION_TOOL,
    toolConfig: { functionCallingConfig: { mode: "ANY" } },
  });

  const aiJson = await aiResp.json();
  const fc = aiJson?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  if (!fc?.args?.actions) return new Response(JSON.stringify({ error: "IA não gerou ações" }), { status: 502, headers: cors });

  const actions = fc.args.actions;

  // Insert action items
  const actionRows = actions.map((a: any) => ({
    tenant_id: tenantId, title: a.title || "Ação sem título",
    description: a.description || null,
    action_type: a.action_type || "improvement",
    action_status: "open", priority: a.priority || "medium",
    effort_estimate: a.effort_estimate || null,
    impact_score: Math.min(100, Math.max(0, a.impact_score || 50)),
    affected_clients_estimate: a.affected_clients_estimate || null,
    ai_generated: true, ai_rationale: a.ai_rationale || null,
    source_cluster_id: clusters[0]?.id || null,
    source_pattern_id: patterns[0]?.id || null,
  }));

  const { data: inserted, error: ae } = await client.from("feedback_action_items").insert(actionRows).select("*");
  if (ae) return new Response(JSON.stringify({ error: ae.message }), { status: 500, headers: cors });

  logInteraction({ tenantId, userId, functionKey: "feedback_intelligence_ai", inputSummary: `generate_actions: ${clusters.length}c/${patterns.length}p`, outputSummary: `${actions.length} actions generated`, responseTimeMs: Date.now() - t0 });

  return new Response(JSON.stringify({ data: inserted || [] }), { headers: { ...cors, "Content-Type": "application/json" } });
}

// ── Stats / Dashboard ───────────────────────────────────────

async function handleGetDashboard(client: any, tenantId: string, cors: any) {
  const [clustersRes, patternsRes, actionsRes] = await Promise.all([
    client.from("feedback_clusters").select("id, impact_score, primary_category, is_active, trend").eq("tenant_id", tenantId),
    client.from("feedback_patterns").select("id, severity, is_active, pattern_type").eq("tenant_id", tenantId),
    client.from("feedback_action_items").select("id, action_status, priority, impact_score, completed_at").eq("tenant_id", tenantId),
  ]);

  const clusters = clustersRes.data || [];
  const patterns = patternsRes.data || [];
  const actions = actionsRes.data || [];

  const activeClusters = clusters.filter((c: any) => c.is_active);
  const activePatterns = patterns.filter((p: any) => p.is_active);
  const completedActions = actions.filter((a: any) => a.action_status === "completed");
  const openActions = actions.filter((a: any) => a.action_status === "open" || a.action_status === "in_progress");

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  activeClusters.forEach((c: any) => { categoryMap[c.primary_category] = (categoryMap[c.primary_category] || 0) + 1; });

  // Severity breakdown
  const severityMap: Record<string, number> = {};
  activePatterns.forEach((p: any) => { severityMap[p.severity] = (severityMap[p.severity] || 0) + 1; });

  const stats = {
    total_clusters: clusters.length,
    active_clusters: activeClusters.length,
    total_patterns: patterns.length,
    active_patterns: activePatterns.length,
    total_actions: actions.length,
    open_actions: openActions.length,
    completed_actions: completedActions.length,
    completion_rate: actions.length > 0 ? Math.round((completedActions.length / actions.length) * 100) : 0,
    avg_impact: activeClusters.length > 0
      ? Math.round(activeClusters.reduce((s: number, c: any) => s + (c.impact_score || 0), 0) / activeClusters.length)
      : 0,
    declining_clusters: activeClusters.filter((c: any) => c.trend === "declining").length,
    critical_patterns: activePatterns.filter((p: any) => p.severity === "critical").length,
    top_categories: Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, count]) => ({ category: cat, count })),
    severity_distribution: severityMap,
  };

  return new Response(JSON.stringify({ data: stats }), { headers: { ...cors, "Content-Type": "application/json" } });
}

async function handleGetTrendAnalysis(client: any, tenantId: string, body: any, cors: any) {
  const days = body.days || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [clustersRes, patternsRes, actionsRes] = await Promise.all([
    client.from("feedback_clusters").select("id, cluster_name, primary_category, impact_score, trend, created_at").eq("tenant_id", tenantId).gte("created_at", since).order("created_at"),
    client.from("feedback_patterns").select("id, pattern_type, severity, priority_score, created_at").eq("tenant_id", tenantId).gte("created_at", since).order("created_at"),
    client.from("feedback_action_items").select("id, action_status, priority, created_at, completed_at").eq("tenant_id", tenantId).gte("created_at", since).order("created_at"),
  ]);

  return new Response(JSON.stringify({
    data: {
      period_days: days,
      clusters_timeline: clustersRes.data || [],
      patterns_timeline: patternsRes.data || [],
      actions_timeline: actionsRes.data || [],
    },
  }), { headers: { ...cors, "Content-Type": "application/json" } });
}

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: cors });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const { data: profile } = await supabase.from("profiles")
      .select("id, tenant_id").eq("user_id", user.id).maybeSingle();
    if (!profile?.tenant_id) return new Response(JSON.stringify({ error: "Perfil não encontrado" }), { status: 403, headers: cors });

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    switch (action) {
      case "get_clusters": return handleGetClusters(supabase, profile.tenant_id, body, cors);
      case "add_cluster": return handleAddCluster(supabase, profile.tenant_id, body, cors);
      case "update_cluster": return handleUpdateCluster(supabase, profile.tenant_id, body, cors);
      case "get_patterns": return handleGetPatterns(supabase, profile.tenant_id, body, cors);
      case "get_action_items": return handleGetActionItems(supabase, profile.tenant_id, body, cors);
      case "add_action_item": return handleAddActionItem(supabase, profile.tenant_id, body, cors);
      case "update_action_item": return handleUpdateActionItem(supabase, profile.tenant_id, body, cors);
      case "analyze_feedback": return handleAnalyzeFeedback(supabase, profile.tenant_id, user.id, body, cors);
      case "detect_patterns": return handleDetectPatterns(supabase, profile.tenant_id, user.id, body, cors);
      case "generate_actions": return handleGenerateActions(supabase, profile.tenant_id, user.id, body, cors);
      case "get_dashboard": return handleGetDashboard(supabase, profile.tenant_id, cors);
      case "get_trend_analysis": return handleGetTrendAnalysis(supabase, profile.tenant_id, body, cors);
      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}`, available: ["get_clusters","add_cluster","update_cluster","get_patterns","get_action_items","add_action_item","update_action_item","analyze_feedback","detect_patterns","generate_actions","get_dashboard","get_trend_analysis"] }), { status: 400, headers: cors });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), { status: 500, headers: cors });
  }
});
