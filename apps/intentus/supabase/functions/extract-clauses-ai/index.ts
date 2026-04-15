/**
 * extract-clauses-ai v5 — Clause Library Inteligente
 *
 * Actions:
 *   extract         — Extrai cláusulas de contratos com risk scoring via IA
 *   evaluate_risk   — Re-avalia risco de cláusulas existentes
 *   suggest         — Sugere cláusulas relevantes para um tipo de contrato/contexto
 *   detect_conflicts — Detecta conflitos entre cláusulas selecionadas
 *
 * Sessão 55 — F1 Item #3: Clause Library Inteligente com risk scoring
 * Self-contained (inline CORS/auth/RBAC)
 * OpenRouter → Gemini 2.0 Flash
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// Inline CORS (same pattern as clm-ai-insights v7)
// ============================================================

const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o: string) => o.trim()).filter(Boolean);

const DEV_ORIGIN_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-.+\.vercel\.app$/,
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS_RAW.length > 0) return ALLOWED_ORIGINS_RAW.includes(origin);
  return ["https://intentus-plataform.vercel.app", "https://app.intentusrealestate.com.br"].includes(origin) || DEV_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, " +
      "x-supabase-client-platform, x-supabase-client-platform-version, " +
      "x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ============================================================
// RBAC — inline permission check
// ============================================================

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["clm.clause.read", "clm.clause.manage", "clm.clause.evaluate"],
  gerente: ["clm.clause.read", "clm.clause.manage", "clm.clause.evaluate"],
  corretor: ["clm.clause.read"],
  financeiro: ["clm.clause.read"],
  juridico: ["clm.clause.read", "clm.clause.manage", "clm.clause.evaluate"],
  manutencao: ["clm.clause.read"],
};

function hasPermission(roles: string[], action: string): boolean {
  if (roles.includes("superadmin")) return true;
  return roles.some((role) => (ROLE_PERMISSIONS[role] ?? []).includes(action));
}

const ACTION_PERMISSIONS: Record<string, string> = {
  extract: "clm.clause.manage",
  evaluate_risk: "clm.clause.evaluate",
  suggest: "clm.clause.read",
  detect_conflicts: "clm.clause.read",
};

// ============================================================
// Auth + Tenant Resolution
// ============================================================

interface AuthContext {
  supabase: SupabaseClient;
  user: { id: string; email: string };
  tenantId: string;
  userRoles: string[];
}

async function resolveAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) throw Object.assign(new Error("Não autorizado"), { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw Object.assign(new Error("Não autorizado"), { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
  const tenantId = profile?.tenant_id;
  if (!tenantId) throw Object.assign(new Error("Tenant não encontrado"), { status: 403 });

  const { data: roleRows } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).eq("tenant_id", tenantId);
  const userRoles = (roleRows ?? []).map((r: any) => r.role);

  return { supabase, user: { id: user.id, email: user.email ?? "" }, tenantId, userRoles };
}

// ============================================================
// AI Call Helper (OpenRouter — Gemini 2.0 Flash)
// ============================================================

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://intentus-plataform.vercel.app",
      "X-Title": "Intentus Clause Library",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`OpenRouter error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parseJSON(raw: string): any {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

// ============================================================
// System Prompts
// ============================================================

const EXTRACT_PROMPT = `Você é um especialista em cláusulas contratuais imobiliárias brasileiras.
Analise os textos fornecidos e extraia cláusulas distintas e reutilizáveis.

Para cada cláusula, avalie o RISCO JURÍDICO considerando:
- Conformidade com a Lei 8.245/91 (Lei do Inquilinato)
- Equilíbrio entre as partes (cláusulas abusivas = risco alto)
- Clareza e completude jurídica
- Presença de variáveis necessárias (valores, datas, identificação)
- Compatibilidade com jurisprudência brasileira

Retorne um JSON com esta estrutura EXATA:
{
  "clauses": [
    {
      "title": "<título descritivo>",
      "content": "<texto completo usando variáveis {{nome_locatario}}, {{valor_aluguel}}, etc.>",
      "category": "<geral|garantia|multa|rescisao|reajuste|entrega|sigilo>",
      "contract_types": ["<locacao|venda|administracao>"],
      "is_mandatory": <true|false>,
      "risk_level": "<low|medium|high|critical>",
      "risk_score": <0-100>,
      "risk_factors": [
        { "factor": "<descrição>", "severity": "<low|medium|high|critical>" }
      ],
      "tags": ["<tag1>", "<tag2>"]
    }
  ]
}

Critérios de risk_score:
- 0-25 (low): Cláusula padrão, juridicamente sólida, equilibrada
- 26-50 (medium): Pequenas lacunas ou ambiguidades, mas aceitável
- 51-75 (high): Problemas significativos, possível nulidade ou abusividade
- 76-100 (critical): Cláusula potencialmente nula, ilegal ou altamente abusiva

Use variáveis dinâmicas como {{nome_locatario}}, {{valor_aluguel}}, {{endereco}}, {{data_inicio}}, etc.
Retorne APENAS o JSON.`;

const EVALUATE_RISK_PROMPT = `Você é um especialista em direito imobiliário brasileiro.
Avalie o risco jurídico de cada cláusula fornecida.

Considere:
1. Conformidade com Lei 8.245/91 e Código Civil
2. Equilíbrio contratual (cláusulas leoninas/abusivas)
3. Clareza jurídica e possibilidade de interpretação dúbia
4. Completude (dados e variáveis necessárias presentes)
5. Compatibilidade com jurisprudência recente

Retorne um JSON:
{
  "evaluations": [
    {
      "clause_id": "<id da cláusula>",
      "risk_level": "<low|medium|high|critical>",
      "risk_score": <0-100>,
      "risk_factors": [
        { "factor": "<descrição do risco>", "severity": "<low|medium|high|critical>" }
      ],
      "suggestions": ["<sugestão de melhoria>"],
      "compliance_notes": "<notas sobre conformidade legal>"
    }
  ]
}

Retorne APENAS o JSON.`;

const SUGGEST_PROMPT = `Você é um especialista em contratos imobiliários brasileiros.
Baseado no contexto do contrato (tipo, partes, valor, etc.), sugira as cláusulas mais relevantes da biblioteca disponível.

Para cada cláusula sugerida, explique brevemente POR QUE ela é relevante para este contrato.

Retorne um JSON:
{
  "suggestions": [
    {
      "clause_id": "<id da cláusula>",
      "relevance_score": <0-100>,
      "reason": "<por que esta cláusula é relevante>",
      "is_mandatory_for_context": <true|false>,
      "priority": "<alta|média|baixa>"
    }
  ]
}

Ordene por relevance_score decrescente. Cláusulas obrigatórias primeiro.
Retorne APENAS o JSON.`;

const CONFLICT_PROMPT = `Você é um especialista em revisão de contratos imobiliários brasileiros.
Analise o conjunto de cláusulas fornecidas e identifique CONFLITOS entre elas.

Tipos de conflito a detectar:
1. Contradição direta (cláusulas dizem coisas opostas)
2. Sobreposição (mesma obrigação definida de formas diferentes)
3. Incompatibilidade legal (combinação viola Lei 8.245/91 ou Código Civil)
4. Ambiguidade cruzada (interpretação de uma anula ou confunde outra)
5. Duplicação com variações (mesma cláusula com termos ligeiramente diferentes)

Retorne um JSON:
{
  "conflicts": [
    {
      "clause_ids": ["<id1>", "<id2>"],
      "conflict_type": "<contradiction|overlap|legal_incompatibility|ambiguity|duplication>",
      "severity": "<low|medium|high|critical>",
      "description": "<descrição do conflito>",
      "resolution": "<sugestão de resolução>"
    }
  ],
  "summary": "<resumo geral da análise de conflitos>"
}

Se não houver conflitos, retorne { "conflicts": [], "summary": "Nenhum conflito detectado." }
Retorne APENAS o JSON.`;

// ============================================================
// Action: extract
// ============================================================

async function handleExtract(ctx: AuthContext, body: Record<string, unknown>, json: Function, error: Function): Promise<Response> {
  // Fetch contract texts
  const { data: contracts } = await ctx.supabase
    .from("contracts").select("id, contract_type, notes, content")
    .eq("tenant_id", ctx.tenantId);

  const contractTexts: string[] = [];
  for (const c of (contracts ?? [])) {
    const text = c.content || c.notes || "";
    if (text.trim().length > 50) {
      contractTexts.push(`--- Contrato (${c.contract_type}) ---\n${text.slice(0, 15000)}`);
    }
  }

  const hasContracts = contractTexts.length > 0;
  const combinedText = contractTexts.join("\n\n").slice(0, 80000);

  const systemPrompt = hasContracts
    ? EXTRACT_PROMPT
    : EXTRACT_PROMPT + "\n\nNão há contratos existentes. Gere uma biblioteca completa de cláusulas-modelo padrão para contratos imobiliários brasileiros (locação, venda, administração). Inclua 15-20 cláusulas essenciais.";

  const userMessage = hasContracts
    ? `Analise os seguintes textos e extraia cláusulas estruturadas com avaliação de risco:\n\n${combinedText}`
    : "Gere a biblioteca completa de cláusulas-modelo padrão para contratos imobiliários brasileiros com avaliação de risco.";

  const rawResponse = await callAI(systemPrompt, userMessage);
  const parsed = parseJSON(rawResponse);
  const clauses = parsed.clauses;

  if (!Array.isArray(clauses) || clauses.length === 0) {
    return error("Nenhuma cláusula foi extraída", 400) as Response;
  }

  const now = new Date().toISOString();
  const rows = clauses.map((c: any) => ({
    title: c.title,
    content: c.content,
    category: c.category || "geral",
    contract_types: c.contract_types || ["locacao"],
    is_mandatory: c.is_mandatory ?? false,
    risk_level: c.risk_level || "low",
    risk_score: typeof c.risk_score === "number" ? Math.min(100, Math.max(0, c.risk_score)) : 0,
    risk_factors: c.risk_factors || [],
    risk_evaluated_at: now,
    risk_model_used: "gemini-2.0-flash-openrouter",
    tags: c.tags || [],
    created_by: ctx.user.id,
    tenant_id: ctx.tenantId,
  }));

  const { error: insertErr } = await ctx.supabase.from("contract_clauses").insert(rows);
  if (insertErr) return error(`Erro ao salvar: ${insertErr.message}`, 500) as Response;

  return json({ success: true, count: clauses.length, from_contracts: hasContracts }) as Response;
}

// ============================================================
// Action: evaluate_risk
// ============================================================

async function handleEvaluateRisk(ctx: AuthContext, body: Record<string, unknown>, json: Function, error: Function): Promise<Response> {
  const clause_ids = body.clause_ids as string[];
  if (!clause_ids || !Array.isArray(clause_ids) || clause_ids.length === 0) {
    return error("clause_ids é obrigatório (array de IDs)", 400) as Response;
  }

  if (clause_ids.length > 50) return error("Máximo 50 cláusulas por avaliação", 400) as Response;

  const { data: clauses, error: qErr } = await ctx.supabase
    .from("contract_clauses")
    .select("id, title, content, category, contract_types, is_mandatory, risk_level, risk_score")
    .in("id", clause_ids)
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true);

  if (qErr || !clauses || clauses.length === 0) {
    return error("Nenhuma cláusula encontrada", 404) as Response;
  }

  const clauseData = clauses.map((c: any) => ({
    clause_id: c.id,
    title: c.title,
    content: c.content.slice(0, 3000),
    category: c.category,
    contract_types: c.contract_types,
    is_mandatory: c.is_mandatory,
  }));

  const rawResponse = await callAI(
    EVALUATE_RISK_PROMPT,
    `Avalie o risco destas ${clauses.length} cláusulas:\n\n${JSON.stringify(clauseData, null, 2)}`
  );
  const parsed = parseJSON(rawResponse);
  const evaluations = parsed.evaluations || [];

  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const ev of evaluations) {
    if (!ev.clause_id) continue;
    const { error: uErr } = await ctx.supabase
      .from("contract_clauses")
      .update({
        risk_level: ev.risk_level || "low",
        risk_score: typeof ev.risk_score === "number" ? Math.min(100, Math.max(0, ev.risk_score)) : 0,
        risk_factors: ev.risk_factors || [],
        risk_evaluated_at: now,
        risk_model_used: "gemini-2.0-flash-openrouter",
      })
      .eq("id", ev.clause_id)
      .eq("tenant_id", ctx.tenantId);

    if (!uErr) updatedCount++;
  }

  return json({ evaluations, updated_count: updatedCount, total: clauses.length }) as Response;
}

// ============================================================
// Action: suggest
// ============================================================

async function handleSuggest(ctx: AuthContext, body: Record<string, unknown>, json: Function, error: Function): Promise<Response> {
  const contract_type = (body.contract_type as string) || "locacao";
  const contract_context = body.contract_context as Record<string, unknown> | undefined;

  // Fetch all active clauses for the tenant
  const { data: clauses } = await ctx.supabase
    .from("contract_clauses")
    .select("id, title, content, category, contract_types, is_mandatory, risk_level, risk_score, tags, usage_count")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .order("usage_count", { ascending: false });

  if (!clauses || clauses.length === 0) {
    return json({ suggestions: [], message: "Nenhuma cláusula na biblioteca" }) as Response;
  }

  const clausesSummary = clauses.map((c: any) => ({
    clause_id: c.id,
    title: c.title,
    content_preview: c.content.slice(0, 500),
    category: c.category,
    contract_types: c.contract_types,
    is_mandatory: c.is_mandatory,
    risk_level: c.risk_level,
    risk_score: c.risk_score,
    tags: c.tags,
    usage_count: c.usage_count,
  }));

  const contextStr = contract_context
    ? `\n\nContexto do contrato:\n${JSON.stringify(contract_context, null, 2)}`
    : "";

  const rawResponse = await callAI(
    SUGGEST_PROMPT,
    `Tipo de contrato: ${contract_type}${contextStr}\n\nCláusulas disponíveis na biblioteca:\n${JSON.stringify(clausesSummary, null, 2)}`
  );
  const parsed = parseJSON(rawResponse);

  return json({ suggestions: parsed.suggestions || [] }) as Response;
}

// ============================================================
// Action: detect_conflicts
// ============================================================

async function handleDetectConflicts(ctx: AuthContext, body: Record<string, unknown>, json: Function, error: Function): Promise<Response> {
  const clause_ids = body.clause_ids as string[];
  if (!clause_ids || !Array.isArray(clause_ids) || clause_ids.length < 2) {
    return error("Mínimo 2 clause_ids para detectar conflitos", 400) as Response;
  }

  if (clause_ids.length > 30) return error("Máximo 30 cláusulas por análise de conflitos", 400) as Response;

  const { data: clauses } = await ctx.supabase
    .from("contract_clauses")
    .select("id, title, content, category, contract_types")
    .in("id", clause_ids)
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true);

  if (!clauses || clauses.length < 2) {
    return error("Menos de 2 cláusulas encontradas", 404) as Response;
  }

  const clauseData = clauses.map((c: any) => ({
    clause_id: c.id,
    title: c.title,
    content: c.content.slice(0, 3000),
    category: c.category,
  }));

  const rawResponse = await callAI(
    CONFLICT_PROMPT,
    `Analise conflitos entre estas ${clauses.length} cláusulas:\n\n${JSON.stringify(clauseData, null, 2)}`
  );
  const parsed = parseJSON(rawResponse);

  return json({
    conflicts: parsed.conflicts || [],
    summary: parsed.summary || "Análise concluída.",
    clauses_analyzed: clauses.length,
  }) as Response;
}

// ============================================================
// Main Handler (Deno.serve)
// ============================================================

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const errorResponse = (message: string, status = 400) => json({ error: message }, status);

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch {
      // Legacy compatibility: extract action without body = "extract"
      body = { action: "extract" };
    }

    const action = (body.action as string) || "extract";

    const auth = await resolveAuth(req);

    // RBAC check
    const requiredPerm = ACTION_PERMISSIONS[action];
    if (requiredPerm && !hasPermission(auth.userRoles, requiredPerm)) {
      return errorResponse("Permissão insuficiente", 403);
    }

    switch (action) {
      case "extract":
        return await handleExtract(auth, body, json, errorResponse);
      case "evaluate_risk":
        return await handleEvaluateRisk(auth, body, json, errorResponse);
      case "suggest":
        return await handleSuggest(auth, body, json, errorResponse);
      case "detect_conflicts":
        return await handleDetectConflicts(auth, body, json, errorResponse);
      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (err: any) {
    if (err.status === 401 || err.status === 403) {
      return errorResponse(err.message, err.status);
    }
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] extract-clauses-ai error:`, err);
    return errorResponse("Erro interno do servidor", 500);
  }
});
