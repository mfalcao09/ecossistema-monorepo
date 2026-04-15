/**
 * redlining-ai v1 — AI-Powered Redlining Suggestions
 *
 * Actions:
 *   suggest_redlines    — Analisa cláusula(s) e sugere alterações com base em legislação BR + imobiliário
 *   analyze_clause      — Analisa uma cláusula individual e retorna sugestões detalhadas com confidence score
 *
 * Sessão 56 — F1 Item #4: AI-Powered Redlining Suggestions
 * Self-contained (inline CORS/auth/RBAC)
 * OpenRouter → Gemini 2.0 Flash
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// Inline CORS (same pattern as extract-clauses-ai v6)
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
  admin: ["clm.redlining.suggest", "clm.redlining.read"],
  gerente: ["clm.redlining.suggest", "clm.redlining.read"],
  corretor: ["clm.redlining.read"],
  financeiro: ["clm.redlining.read"],
  juridico: ["clm.redlining.suggest", "clm.redlining.read"],
  manutencao: ["clm.redlining.read"],
};

const ACTION_PERMISSIONS: Record<string, string> = {
  suggest_redlines: "clm.redlining.suggest",
  analyze_clause: "clm.redlining.suggest",
};

// ============================================================
// AI Helper — OpenRouter → Gemini 2.0 Flash
// ============================================================

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

interface AIMessage {
  role: "system" | "user";
  content: string;
}

async function callAI(messages: AIMessage[], jsonMode = true): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

  const body: Record<string, unknown> = {
    model: "google/gemini-2.0-flash-001",
    messages,
    temperature: 0.3,
    max_tokens: 4096,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://intentus-plataform.vercel.app",
      "X-Title": "Intentus CLM Redlining AI",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "unknown");
    throw new Error(`OpenRouter error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

// ============================================================
// Auth + Tenant Resolution
// ============================================================

interface AuthContext {
  supabase: SupabaseClient;
  userId: string;
  tenantId: string;
  userRoles: string[];
}

async function resolveAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

  // Fetch user roles
  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", profile.tenant_id);

  const userRoles = (rolesData || []).map((r: { role: string }) => r.role);

  return { supabase, userId: user.id, tenantId: profile.tenant_id, userRoles };
}

function hasPermission(roles: string[], requiredPerm: string): boolean {
  // superadmin always allowed
  if (roles.includes("superadmin")) return true;
  return roles.some((role) => (ROLE_PERMISSIONS[role] || []).includes(requiredPerm));
}

// ============================================================
// Types
// ============================================================

interface RedlineSuggestion {
  clause_name: string;
  original_text: string;
  proposed_text: string;
  reason: string;
  category: "legal_compliance" | "risk_mitigation" | "clarity" | "fairness" | "market_practice" | "missing_clause";
  confidence: number; // 0-100
  priority: "alta" | "media" | "baixa";
  legal_basis?: string;
  risk_if_unchanged?: string;
}

interface AnalyzeClauseResult {
  suggestions: RedlineSuggestion[];
  overall_risk: "low" | "medium" | "high" | "critical";
  summary: string;
  compliance_notes: string[];
}

// ============================================================
// Action Handlers
// ============================================================

async function handleSuggestRedlines(
  ctx: AuthContext,
  body: Record<string, unknown>
): Promise<Response> {
  const corsH = {} as Record<string, string>; // will be merged later
  const contractId = body.contract_id as string;
  if (!contractId) {
    return new Response(JSON.stringify({ error: "contract_id obrigatório" }), { status: 400 });
  }

  // 1. Fetch contract data
  const { data: contract, error: cErr } = await ctx.supabase
    .from("contracts")
    .select("id, title, contract_type, status, start_date, end_date, monthly_rent, content")
    .eq("id", contractId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (cErr || !contract) {
    return new Response(JSON.stringify({ error: "Contrato não encontrado" }), { status: 404 });
  }

  // 2. Fetch existing clauses from Clause Library (if any)
  const { data: clauses } = await ctx.supabase
    .from("contract_clauses")
    .select("id, title, content, category, risk_level, risk_score, risk_factors")
    .eq("contract_id", contractId)
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  // 3. Fetch existing redlining entries (to avoid duplicates)
  const { data: existingRedlines } = await ctx.supabase
    .from("contract_redlining")
    .select("clause_name, proposed_text, status")
    .eq("contract_id", contractId)
    .eq("tenant_id", ctx.tenantId);

  // 4. Build AI prompt
  const contractInfo = [
    `Tipo: ${contract.contract_type || "não especificado"}`,
    `Status: ${contract.status}`,
    `Início: ${contract.start_date || "N/A"}`,
    `Término: ${contract.end_date || "N/A"}`,
    contract.monthly_rent ? `Aluguel mensal: R$ ${contract.monthly_rent}` : null,
  ].filter(Boolean).join("\n");

  const clausesList = (clauses || []).map((c, i) => {
    const riskInfo = c.risk_level && c.risk_level !== "low"
      ? ` [RISCO: ${c.risk_level.toUpperCase()}, score: ${c.risk_score}/100]`
      : "";
    return `${i + 1}. **${c.title}**${riskInfo}\nCategoria: ${c.category || "geral"}\nConteúdo: ${c.content}`;
  }).join("\n\n");

  const existingRedlinesList = (existingRedlines || [])
    .filter((r) => r.status !== "recusado")
    .map((r) => `- ${r.clause_name}: "${r.proposed_text?.substring(0, 100)}..."`)
    .join("\n");

  const hasContent = contract.content && contract.content.length > 50;
  const contentSection = hasContent
    ? `\n\n## Conteúdo Completo do Contrato (HTML):\n${(contract.content as string).substring(0, 8000)}`
    : "";

  const systemPrompt = `Você é um advogado especialista em direito imobiliário brasileiro com profundo conhecimento da Lei 8.245/91 (Lei do Inquilinato), Código Civil, e práticas de mercado imobiliário.

Sua tarefa é analisar as cláusulas de um contrato e sugerir alterações (redlining) para:
1. Garantir conformidade legal (Lei 8.245/91, Código Civil, CDC quando aplicável)
2. Mitigar riscos para o proprietário/administrador
3. Melhorar clareza e precisão jurídica
4. Garantir equilíbrio contratual (fairness)
5. Alinhar com práticas de mercado imobiliário brasileiro
6. Identificar cláusulas ausentes essenciais

Para cada sugestão, forneça:
- clause_name: Nome da cláusula afetada
- original_text: Texto original (ou "CLÁUSULA AUSENTE" se for nova)
- proposed_text: Texto proposto com a alteração
- reason: Explicação clara do motivo da alteração
- category: Uma de [legal_compliance, risk_mitigation, clarity, fairness, market_practice, missing_clause]
- confidence: Score 0-100 de confiança na sugestão
- priority: "alta" (risco legal/financeiro), "media" (melhoria importante), "baixa" (otimização)
- legal_basis: Base legal (ex: "Art. 37 Lei 8.245/91")
- risk_if_unchanged: Risco de manter o texto atual

REGRAS:
- Priorize conformidade legal (Lei 8.245/91 para locações)
- Para locações: verifique cláusula de reajuste (índice, periodicidade), garantias (máximo 1 modalidade Art. 37), multa por rescisão antecipada, prazo de vistoria, responsabilidades (Art. 22-26)
- Para vendas: verifique cláusula de evicção, vícios redibitórios, condições suspensivas, forma de pagamento
- NÃO sugira alterações para cláusulas que já estão em conformidade e bem redigidas
- Foque em riscos REAIS, não teóricos
- Se não houver cláusulas para analisar mas houver conteúdo do contrato, extraia e analise do conteúdo

Responda em JSON com o formato:
{
  "suggestions": [RedlineSuggestion...],
  "overall_risk": "low|medium|high|critical",
  "summary": "Resumo executivo da análise",
  "compliance_notes": ["Nota de conformidade 1", ...]
}`;

  const userPrompt = `## Informações do Contrato
${contractInfo}

## Cláusulas Existentes (da Clause Library)
${clausesList || "Nenhuma cláusula cadastrada na Clause Library."}
${contentSection}

${existingRedlinesList ? `\n## Redlining já existente (NÃO duplicar):\n${existingRedlinesList}` : ""}

Analise as cláusulas acima e sugira alterações de redlining. Se não há cláusulas cadastradas mas há conteúdo do contrato, extraia as cláusulas relevantes do conteúdo e analise-as.`;

  // 5. Call AI
  const aiResponse = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  let result: AnalyzeClauseResult;
  try {
    result = JSON.parse(aiResponse);
  } catch {
    console.error("Failed to parse AI response:", aiResponse.substring(0, 500));
    return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA" }), { status: 500 });
  }

  // 6. Filter out suggestions that duplicate existing redlines
  if (existingRedlines && existingRedlines.length > 0) {
    const existingNames = new Set(
      existingRedlines
        .filter((r) => r.status !== "recusado")
        .map((r) => r.clause_name.toLowerCase().trim())
    );
    result.suggestions = (result.suggestions || []).filter(
      (s) => !existingNames.has(s.clause_name.toLowerCase().trim())
    );
  }

  // 7. Sort by priority then confidence
  const priorityOrder: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  result.suggestions = (result.suggestions || []).sort((a, b) => {
    const pDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    if (pDiff !== 0) return pDiff;
    return (b.confidence || 0) - (a.confidence || 0);
  });

  return new Response(JSON.stringify({
    ...result,
    contract_id: contractId,
    contract_type: contract.contract_type,
    clauses_analyzed: (clauses || []).length,
    model_used: "gemini-2.0-flash",
  }), { status: 200 });
}

async function handleAnalyzeClause(
  ctx: AuthContext,
  body: Record<string, unknown>
): Promise<Response> {
  const clauseText = body.clause_text as string;
  const clauseName = body.clause_name as string;
  const contractType = (body.contract_type as string) || "locacao";
  const contractContext = (body.contract_context as string) || "";

  if (!clauseText || !clauseName) {
    return new Response(JSON.stringify({ error: "clause_text e clause_name obrigatórios" }), { status: 400 });
  }

  const systemPrompt = `Você é um advogado especialista em direito imobiliário brasileiro.
Analise a cláusula contratual fornecida e sugira melhorias específicas.

Contexto do contrato: ${contractType === "locacao" || contractType === "administracao" ? "Locação imobiliária (Lei 8.245/91)" : "Venda/Compra de imóvel (Código Civil)"}

Para cada sugestão de alteração:
- proposed_text: O texto completo da cláusula reescrita
- reason: Por que a alteração é necessária
- category: Uma de [legal_compliance, risk_mitigation, clarity, fairness, market_practice]
- confidence: Score 0-100
- priority: "alta", "media" ou "baixa"
- legal_basis: Artigo de lei relevante (se aplicável)
- risk_if_unchanged: Risco de manter o texto atual

Responda em JSON:
{
  "suggestions": [{
    "clause_name": "...",
    "original_text": "...",
    "proposed_text": "...",
    "reason": "...",
    "category": "...",
    "confidence": 85,
    "priority": "alta|media|baixa",
    "legal_basis": "...",
    "risk_if_unchanged": "..."
  }],
  "overall_risk": "low|medium|high|critical",
  "summary": "...",
  "compliance_notes": ["..."]
}`;

  const userPrompt = `## Cláusula a Analisar
**Nome:** ${clauseName}
**Texto:**
${clauseText}

${contractContext ? `## Contexto Adicional\n${contractContext}` : ""}

Analise esta cláusula e sugira alterações se necessário. Se a cláusula estiver adequada, retorne suggestions vazio e overall_risk "low".`;

  const aiResponse = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  let result: AnalyzeClauseResult;
  try {
    result = JSON.parse(aiResponse);
  } catch {
    console.error("Failed to parse AI response:", aiResponse.substring(0, 500));
    return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA" }), { status: 500 });
  }

  // Fill in original_text for all suggestions
  result.suggestions = (result.suggestions || []).map((s) => ({
    ...s,
    clause_name: s.clause_name || clauseName,
    original_text: s.original_text || clauseText,
  }));

  return new Response(JSON.stringify({
    ...result,
    model_used: "gemini-2.0-flash",
  }), { status: 200 });
}

// ============================================================
// Main Handler
// ============================================================

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // Auth
    const ctx = await resolveAuth(req);

    // Parse body
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch { /* empty body OK for legacy compat */ }

    const action = (body.action as string) || "suggest_redlines";

    // RBAC check
    const requiredPerm = ACTION_PERMISSIONS[action];
    if (requiredPerm && !hasPermission(ctx.userRoles, requiredPerm)) {
      return new Response(
        JSON.stringify({ error: "Permissão insuficiente", required: requiredPerm }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    let response: Response;

    switch (action) {
      case "suggest_redlines":
        response = await handleSuggestRedlines(ctx, body);
        break;
      case "analyze_clause":
        response = await handleAnalyzeClause(ctx, body);
        break;
      default:
        response = new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          { status: 400 }
        );
    }

    // Merge CORS headers into response
    const resHeaders = new Headers(response.headers);
    Object.entries(cors).forEach(([k, v]) => resHeaders.set(k, v));
    resHeaders.set("Content-Type", "application/json");

    return new Response(response.body, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (err) {
    console.error("redlining-ai error:", err);
    const message = err instanceof Error && (err.message === "Não autenticado" || err.message === "Tenant não encontrado")
      ? err.message
      : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: message }),
      { status: err instanceof Error && err.message === "Não autenticado" ? 401 : 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
