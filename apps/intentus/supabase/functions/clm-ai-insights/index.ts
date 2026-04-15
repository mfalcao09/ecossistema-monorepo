/**
 * clm-ai-insights v7 — Contract Analytics Avançado
 *
 * Actions:
 *   analyze_contract  — Análise individual de contrato com IA real (Gemini 2.0 Flash via OpenRouter)
 *   portfolio_health  — Score de saúde do portfólio agregado
 *   advanced_metrics  — KPIs avançados server-side (lifecycle, renewal, compliance)
 *
 * Sessão 54 — F1 Item #2: Contract Analytics Avançado
 * Migrado de Lovable AI Gateway → OpenRouter (Gemini 2.0 Flash)
 * Compliance monitoring BR imobiliário
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// Inline CORS + Auth (same pattern as _shared/middleware.ts)
// ============================================================

const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((o: string) => o.trim())
  .filter(Boolean);

const DEV_ORIGIN_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-.+\.vercel\.app$/,
];

const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS_RAW.length > 0) return ALLOWED_ORIGINS_RAW.includes(origin);
  return PROD_ORIGINS.includes(origin) || DEV_ORIGIN_PATTERNS.some((re) => re.test(origin));
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
// RBAC — inline permission check (mirrors _shared/clmPermissions.ts)
// ============================================================

type AppRole = "superadmin" | "admin" | "gerente" | "corretor" | "financeiro" | "juridico" | "manutencao";

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["clm.contract.read", "clm.dashboard.view"],
  gerente: ["clm.contract.read", "clm.dashboard.view"],
  corretor: ["clm.contract.read", "clm.dashboard.view"],
  financeiro: ["clm.contract.read", "clm.dashboard.view"],
  juridico: ["clm.contract.read", "clm.dashboard.view"],
  manutencao: ["clm.contract.read"],
};

function hasPermission(roles: string[], action: string): boolean {
  if (roles.includes("superadmin")) return true;
  return roles.some((role) => {
    const perms = ROLE_PERMISSIONS[role];
    return perms ? perms.includes(action) : false;
  });
}

const ACTION_PERMISSIONS: Record<string, string> = {
  analyze_contract: "clm.contract.read",
  portfolio_health: "clm.dashboard.view",
  advanced_metrics: "clm.dashboard.view",
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
// AI Call Helper
// ============================================================

async function callGemini(systemPrompt: string, userMessage: string): Promise<string> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://intentus-plataform.vercel.app",
      "X-Title": "Intentus CLM AI Insights",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("INSUFFICIENT_CREDITS");
    throw new Error(`OpenRouter error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ============================================================
// System Prompts
// ============================================================

const CONTRACT_ANALYSIS_PROMPT = `Você é um especialista em CLM (Contract Lifecycle Management) e direito imobiliário brasileiro.
Analise o contrato fornecido e retorne um JSON com esta estrutura EXATA:

{
  "risk_score": <número 0-100>,
  "risk_factors": [
    { "category": "<string>", "description": "<string>", "severity": "<low|medium|high|critical>" }
  ],
  "missing_clauses": ["<string>"],
  "suggestions": [
    { "type": "<string>", "description": "<string>", "priority": "<low|medium|high>" }
  ],
  "key_obligations": [
    { "party": "<string>", "obligation": "<string>", "deadline": "<string ou null>" }
  ],
  "key_dates": [
    { "label": "<string>", "date": "<string>", "type": "<start|end|renewal|payment|other>" }
  ],
  "flagged_clauses": [
    { "clause_number": "<string>", "content_preview": "<string até 100 chars>", "reason": "<string>", "risk_level": "<low|medium|high>" }
  ],
  "compliance_gaps": [
    { "requirement": "<string>", "status": "<compliant|non_compliant|partial|not_applicable>", "detail": "<string>" }
  ],
  "summary": "<string resumo 2-3 frases>"
}

REGRAS DE COMPLIANCE IMOBILIÁRIO BRASILEIRO (verificar SEMPRE):
1. Cláusula de reajuste com índice definido (IGPM, IPCA, INPC) — obrigatória em locações > 12 meses
2. Garantia locatícia (caução, fiador, seguro fiança, título capitalização) — Lei 8.245/91
3. Qualificação completa das partes (CPF/CNPJ, endereço, estado civil, nacionalidade)
4. Prazo de vigência explícito com datas de início e término
5. Valor do aluguel/venda e forma de pagamento
6. Multa por rescisão antecipada (proporcional ao tempo restante — Lei 8.245/91 Art. 4)
7. Vistoria de entrada e saída documentada
8. Responsabilidade por IPTU, condomínio, taxas
9. Cláusula de foro eleito
10. Condições de renovação e denúncia

Seja rigoroso na análise. Atribua risk_score > 60 se faltar garantia ou reajuste.
Retorne APENAS o JSON, sem texto adicional.`;

const PORTFOLIO_HEALTH_PROMPT = `Você é um analista de portfólio CLM especializado no mercado imobiliário brasileiro.
Analise os dados agregados do portfólio e retorne um JSON:

{
  "health_score": <0-100>,
  "critical_risks": [
    { "risk": "<string>", "impact": "<string>", "urgency": "<alta|média|baixa>" }
  ],
  "opportunities": [
    { "insight": "<string>", "potential_impact": "<string>" }
  ],
  "recommended_actions": [
    { "action": "<string>", "priority": "<alta|média|baixa>", "estimated_effort": "<string>" }
  ],
  "compliance_overview": {
    "score": <0-100>,
    "gaps_count": <number>,
    "top_gaps": ["<string>"]
  },
  "summary": "<string resumo executivo 3-5 frases>"
}

BENCHMARKS DE SAÚDE:
- SLA de análise: < 5 dias úteis (locação), < 15 (comercial)
- Revenue Leakage tolerável: 0% (reajuste não aplicado = perda direta)
- Taxa de contratos com obrigações cadastradas: > 90%
- Taxa de contratos analisados por IA: > 80%
- Contratos sem garantia locatícia: 0% (locações)
- Contratos sem cláusula de reajuste: 0% (locações > 12m)

Retorne APENAS o JSON.`;

// ============================================================
// Action: analyze_contract
// ============================================================

async function handleAnalyzeContract(ctx: AuthContext, body: Record<string, unknown>, json: Function, error: Function): Promise<Response> {
  const contract_id = body.contract_id as string;
  if (!contract_id) return error("contract_id é obrigatório", 400) as Response;

  const startMs = Date.now();

  const { data: contract, error: cErr } = await ctx.supabase
    .from("contracts")
    .select("*, contract_parties(*), contract_installments(*), contract_obligations(*)")
    .eq("id", contract_id)
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (cErr || !contract) return error("Contrato não encontrado", 404) as Response;

  const overdueInstallments = (contract.contract_installments ?? []).filter(
    (i: any) => i.status === "atrasado" || (i.status === "pendente" && i.due_date < new Date().toISOString().split("T")[0])
  );

  const contractSummary = {
    titulo: contract.title,
    tipo: contract.contract_type,
    status: contract.status,
    valor_total: contract.total_value,
    valor_mensal: contract.monthly_value,
    inicio: contract.start_date,
    termino: contract.end_date,
    partes: (contract.contract_parties ?? []).map((p: any) => ({
      nome: p.name, tipo: p.party_type, documento: p.document_number ? "Presente" : "Ausente",
    })),
    parcelas_total: (contract.contract_installments ?? []).length,
    parcelas_atrasadas: overdueInstallments.length,
    obrigacoes: (contract.contract_obligations ?? []).map((o: any) => ({
      titulo: o.title, tipo: o.obligation_type, responsavel: o.responsible_party, vencimento: o.due_date, status: o.status,
    })),
    conteudo_html: contract.content ? contract.content.slice(0, 8000) : null,
  };

  const userMessage = `Analise este contrato imobiliário:\n\n${JSON.stringify(contractSummary, null, 2)}`;

  let analysisResult: any;
  let modelUsed = "gemini-2.0-flash-openrouter";

  try {
    const rawResponse = await callGemini(CONTRACT_ANALYSIS_PROMPT, userMessage);
    const cleaned = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    analysisResult = JSON.parse(cleaned);
  } catch (aiErr: any) {
    console.error("AI analysis failed, falling back to rule engine:", aiErr.message);
    analysisResult = generateRuleBasedAnalysis(contract);
    modelUsed = "rule_engine_v1";
  }

  const processingMs = Date.now() - startMs;

  const { data: saved, error: saveErr } = await ctx.supabase
    .from("contract_ai_analysis")
    .insert({
      contract_id, analysis_type: "risk_assessment",
      risk_score: analysisResult.risk_score ?? 50,
      risk_factors: analysisResult.risk_factors ?? [],
      missing_clauses: analysisResult.missing_clauses ?? [],
      suggestions: analysisResult.suggestions ?? [],
      summary: analysisResult.summary ?? "",
      key_obligations: analysisResult.key_obligations ?? [],
      key_dates: analysisResult.key_dates ?? [],
      parties_extracted: [],
      flagged_clauses: analysisResult.flagged_clauses ?? [],
      model_used: modelUsed, tokens_used: null, processing_ms: processingMs,
      analyzed_by: ctx.user.id, tenant_id: ctx.tenantId,
    })
    .select().single();

  if (saveErr) {
    console.error("Failed to save analysis:", saveErr.message);
    return error("Erro ao salvar análise", 500) as Response;
  }

  return json({ analysis: saved, compliance_gaps: analysisResult.compliance_gaps ?? [], model_used: modelUsed, processing_ms: processingMs }) as Response;
}

// ============================================================
// Rule-based fallback (rule_engine_v1)
// ============================================================

function generateRuleBasedAnalysis(contract: any): any {
  const hasParties = (contract.contract_parties?.length ?? 0) > 0;
  const overdueCount = (contract.contract_installments ?? []).filter((i: any) => i.status === "atrasado").length;
  const hasObligations = (contract.contract_obligations?.length ?? 0) > 0;
  const isLocacao = ["locacao", "administracao"].includes(contract.contract_type);

  const riskFactors: any[] = [];
  const missingClauses: string[] = [];
  const suggestions: any[] = [];
  const complianceGaps: any[] = [];
  let riskScore = 15;

  if (!hasParties) {
    riskFactors.push({ category: "Partes", description: "Contrato sem partes vinculadas", severity: "high" });
    missingClauses.push("Qualificação das partes (CPF/CNPJ, endereço)");
    riskScore += 20;
    complianceGaps.push({ requirement: "Qualificação das partes", status: "non_compliant", detail: "Nenhuma parte cadastrada" });
  } else {
    complianceGaps.push({ requirement: "Qualificação das partes", status: "compliant", detail: `${contract.contract_parties.length} parte(s)` });
  }

  if (overdueCount > 0) {
    riskFactors.push({ category: "Financeiro", description: `${overdueCount} parcela(s) em atraso`, severity: overdueCount > 2 ? "critical" : "medium" });
    riskScore += overdueCount * 10;
  }

  if (!contract.end_date) {
    missingClauses.push("Data de término definida");
    riskScore += 10;
    complianceGaps.push({ requirement: "Prazo de vigência explícito", status: "non_compliant", detail: "Data de término ausente" });
  } else {
    complianceGaps.push({ requirement: "Prazo de vigência explícito", status: "compliant", detail: `Término: ${contract.end_date}` });
  }

  if (!contract.value && !contract.total_value) {
    riskFactors.push({ category: "Financeiro", description: "Contrato sem valor definido", severity: "medium" });
    riskScore += 15;
    complianceGaps.push({ requirement: "Valor e forma de pagamento", status: "non_compliant", detail: "Valor não definido" });
  } else {
    complianceGaps.push({ requirement: "Valor e forma de pagamento", status: "compliant", detail: `R$ ${contract.total_value || contract.value}` });
  }

  if (isLocacao) {
    complianceGaps.push({ requirement: "Cláusula de reajuste (IGPM/IPCA)", status: "partial", detail: "Não verificável sem conteúdo do contrato (rule engine)" });
    complianceGaps.push({ requirement: "Garantia locatícia (Lei 8.245/91)", status: "partial", detail: "Não verificável sem conteúdo do contrato (rule engine)" });
    complianceGaps.push({ requirement: "Multa por rescisão antecipada (Art. 4)", status: "partial", detail: "Não verificável sem conteúdo do contrato (rule engine)" });
    complianceGaps.push({ requirement: "Vistoria de entrada/saída", status: "partial", detail: "Não verificável sem conteúdo do contrato (rule engine)" });
  }

  complianceGaps.push({ requirement: "Cláusula de foro eleito", status: "partial", detail: "Não verificável sem conteúdo (rule engine)" });
  complianceGaps.push({ requirement: "Responsabilidade IPTU/condomínio", status: isLocacao ? "partial" : "not_applicable", detail: isLocacao ? "Não verificável (rule engine)" : "N/A para este tipo" });

  if (!hasObligations) suggestions.push({ type: "completude", description: "Cadastrar obrigações contratuais para monitoramento", priority: "high" });
  if (contract.status === "rascunho") suggestions.push({ type: "workflow", description: "Enviar para revisão antes de ativar", priority: "high" });
  suggestions.push({ type: "compliance", description: "Executar análise com IA para verificar cláusulas obrigatórias", priority: "medium" });

  riskScore = Math.min(riskScore, 100);

  return {
    risk_score: riskScore, risk_factors: riskFactors, missing_clauses: missingClauses, suggestions,
    key_obligations: [],
    key_dates: contract.start_date ? [{ label: "Início", date: contract.start_date, type: "start" }] : [],
    flagged_clauses: [], compliance_gaps: complianceGaps,
    summary: `Contrato "${contract.title ?? "sem título"}" (${contract.contract_type}) — Risk Score: ${riskScore}/100. ${riskFactors.length} fator(es) de risco, ${missingClauses.length} cláusula(s) ausente(s). Análise por regras locais (fallback).`,
  };
}

// ============================================================
// Action: portfolio_health
// ============================================================

async function handlePortfolioHealth(ctx: AuthContext, body: Record<string, unknown>, json: Function, error: Function): Promise<Response> {
  const { data: contracts, error: cErr } = await ctx.supabase
    .from("contracts")
    .select("id, title, contract_type, status, total_value, monthly_value, start_date, end_date, created_at")
    .eq("tenant_id", ctx.tenantId).is("deleted_at", null);

  if (cErr) return error("Erro ao buscar contratos", 500) as Response;

  const { data: analyses } = await ctx.supabase
    .from("contract_ai_analysis")
    .select("contract_id, risk_score, risk_factors, missing_clauses, model_used, created_at")
    .eq("tenant_id", ctx.tenantId).order("created_at", { ascending: false });

  const { data: obligations } = await ctx.supabase
    .from("contract_obligations").select("id, contract_id, status, due_date").eq("tenant_id", ctx.tenantId);

  const { data: installments } = await ctx.supabase
    .from("contract_installments").select("id, contract_id, status, amount, due_date")
    .in("contract_id", (contracts ?? []).map((c: any) => c.id));

  const today = new Date().toISOString().split("T")[0];
  const activeContracts = (contracts ?? []).filter((c: any) =>
    ["ativo", "em_revisao", "em_aprovacao", "aguardando_assinatura", "vigencia_pendente"].includes(c.status)
  );

  const latestAnalysis = new Map<string, any>();
  for (const a of (analyses ?? [])) { if (!latestAnalysis.has(a.contract_id)) latestAnalysis.set(a.contract_id, a); }

  const analyzedCount = [...latestAnalysis.keys()].filter(cid => activeContracts.some((c: any) => c.id === cid)).length;
  const overdueObligations = (obligations ?? []).filter((o: any) => o.status !== "completed" && o.due_date && o.due_date < today);
  const overdueInstallments = (installments ?? []).filter((i: any) => i.status === "atrasado" || (i.status === "pendente" && i.due_date < today));

  const expiringIn30 = activeContracts.filter((c: any) => {
    if (!c.end_date) return false;
    const daysLeft = (new Date(c.end_date).getTime() - Date.now()) / 86400000;
    return daysLeft >= 0 && daysLeft <= 30;
  });

  const portfolioData = {
    total_contratos: (contracts ?? []).length, contratos_ativos: activeContracts.length,
    contratos_analisados: analyzedCount,
    cobertura_analise_pct: activeContracts.length > 0 ? Math.round((analyzedCount / activeContracts.length) * 100) : 0,
    valor_total_carteira: activeContracts.reduce((s: number, c: any) => s + Number(c.total_value || 0), 0),
    obrigacoes_vencidas: overdueObligations.length, parcelas_atrasadas: overdueInstallments.length,
    valor_inadimplente: overdueInstallments.reduce((s: number, i: any) => s + Number(i.amount || 0), 0),
    contratos_expirando_30d: expiringIn30.length,
    risk_scores: [...latestAnalysis.values()].filter(a => a.risk_score != null).map(a => a.risk_score),
    distribuicao_tipos: activeContracts.reduce((acc: any, c: any) => { acc[c.contract_type] = (acc[c.contract_type] || 0) + 1; return acc; }, {}),
    contratos_sem_analise: activeContracts.length - analyzedCount,
  };

  let healthResult: any;
  let modelUsed = "gemini-2.0-flash-openrouter";

  try {
    const userMessage = `Analise a saúde deste portfólio CLM:\n\n${JSON.stringify(portfolioData, null, 2)}`;
    const rawResponse = await callGemini(PORTFOLIO_HEALTH_PROMPT, userMessage);
    const cleaned = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    healthResult = JSON.parse(cleaned);
  } catch (aiErr: any) {
    console.error("Portfolio health AI failed, using fallback:", aiErr.message);
    modelUsed = "rule_engine_v1";
    let score = 80;
    if (portfolioData.cobertura_analise_pct < 50) score -= 20;
    if (portfolioData.obrigacoes_vencidas > 5) score -= 15;
    if (portfolioData.parcelas_atrasadas > 3) score -= 15;
    if (portfolioData.contratos_expirando_30d > 3) score -= 10;
    score = Math.max(0, score);

    healthResult = {
      health_score: score,
      critical_risks: overdueInstallments.length > 0
        ? [{ risk: `${overdueInstallments.length} parcelas em atraso`, impact: `R$ ${portfolioData.valor_inadimplente.toFixed(2)} inadimplente`, urgency: "alta" }]
        : [],
      opportunities: [{ insight: "Aumentar cobertura de análise IA para identificar riscos ocultos", potential_impact: "Redução de riscos não mapeados" }],
      recommended_actions: [{ action: "Analisar contratos pendentes com IA", priority: "alta", estimated_effort: "30 min" }],
      compliance_overview: { score: portfolioData.cobertura_analise_pct, gaps_count: portfolioData.contratos_sem_analise, top_gaps: ["Cobertura de análise insuficiente"] },
      summary: `Portfólio com ${portfolioData.total_contratos} contratos (${portfolioData.contratos_ativos} ativos). Score: ${score}/100. Análise por regras locais (fallback).`,
    };
  }

  return json({ ...healthResult, portfolio_data: portfolioData, model_used: modelUsed, is_simulated: modelUsed === "rule_engine_v1" }) as Response;
}

// ============================================================
// Action: advanced_metrics
// ============================================================

async function handleAdvancedMetrics(ctx: AuthContext, body: Record<string, unknown>, json: Function, error: Function): Promise<Response> {
  const { data: contracts } = await ctx.supabase
    .from("contracts")
    .select("id, title, contract_type, status, total_value, monthly_value, start_date, end_date, created_at, updated_at")
    .eq("tenant_id", ctx.tenantId).is("deleted_at", null);

  const allContracts = contracts ?? [];

  const { data: installments } = await ctx.supabase
    .from("contract_installments")
    .select("id, contract_id, status, amount, paid_amount, due_date, paid_at")
    .in("contract_id", allContracts.map(c => c.id));

  const { data: obligations } = await ctx.supabase
    .from("contract_obligations").select("id, contract_id, status, due_date, completed_at").eq("tenant_id", ctx.tenantId);

  const { data: lifecycleEvents } = await ctx.supabase
    .from("contract_lifecycle_events")
    .select("id, contract_id, event_type, from_status, to_status, created_at")
    .eq("tenant_id", ctx.tenantId).order("created_at", { ascending: false }).limit(500);

  const allInstallments = installments ?? [];
  const allObligations = obligations ?? [];
  const allEvents = lifecycleEvents ?? [];
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // 1. Avg lifecycle days
  const activatedContracts = allEvents.filter((e: any) => e.to_status === "ativo");
  const lifecycleDays: number[] = [];
  for (const event of activatedContracts) {
    const contract = allContracts.find(c => c.id === event.contract_id);
    if (contract?.created_at) {
      const days = (new Date(event.created_at).getTime() - new Date(contract.created_at).getTime()) / 86400000;
      if (days >= 0 && days < 365) lifecycleDays.push(days);
    }
  }
  const avgLifecycleDays = lifecycleDays.length > 0 ? Math.round(lifecycleDays.reduce((s, d) => s + d, 0) / lifecycleDays.length) : null;

  // 2. Renewal rate
  const renewedContracts = allContracts.filter(c => c.status === "renovado").length;
  const encerradosOrRenovados = allContracts.filter(c => ["encerrado", "renovado", "cancelado"].includes(c.status)).length;
  const renewalRate = encerradosOrRenovados > 0 ? Math.round((renewedContracts / encerradosOrRenovados) * 100) : null;

  // 3. Cancellation rate
  const cancelados = allContracts.filter(c => c.status === "cancelado").length;
  const cancellationRate = encerradosOrRenovados > 0 ? Math.round((cancelados / encerradosOrRenovados) * 100) : null;

  // 4. Collection rate
  const totalBilled = allInstallments.reduce((s, i: any) => s + Number(i.amount || 0), 0);
  const totalPaid = allInstallments.filter((i: any) => i.status === "pago").reduce((s, i: any) => s + Number(i.paid_amount || i.amount || 0), 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : null;

  // 5. Overdue amount
  const overdueInstallments = allInstallments.filter((i: any) => i.status === "atrasado" || (i.status === "pendente" && i.due_date < todayStr));
  const overdueAmount = overdueInstallments.reduce((s, i: any) => s + Number(i.amount || 0), 0);

  // 6. Obligation compliance rate
  const completedObligations = allObligations.filter((o: any) => o.status === "completed").length;
  const totalObligationsWithDeadline = allObligations.filter((o: any) => o.due_date).length;
  const obligationComplianceRate = totalObligationsWithDeadline > 0 ? Math.round((completedObligations / totalObligationsWithDeadline) * 100) : null;

  // 7. Avg payment delay
  const paidInstallments = allInstallments.filter((i: any) => i.status === "pago" && i.due_date && i.paid_at);
  const paymentDelays: number[] = [];
  for (const inst of paidInstallments) {
    const delay = (new Date(inst.paid_at).getTime() - new Date(inst.due_date).getTime()) / 86400000;
    if (Math.abs(delay) < 365) paymentDelays.push(delay);
  }
  const avgPaymentDelay = paymentDelays.length > 0 ? Math.round(paymentDelays.reduce((s, d) => s + d, 0) / paymentDelays.length) : null;

  // 8. Expiring by month (next 6)
  const expiringByMonth: Record<string, number> = {};
  for (let m = 0; m < 6; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    expiringByMonth[key] = 0;
  }
  for (const c of allContracts) {
    if (!c.end_date || !["ativo", "vigencia_pendente"].includes(c.status)) continue;
    const monthKey = c.end_date.slice(0, 7);
    if (monthKey in expiringByMonth) expiringByMonth[monthKey]++;
  }

  // 9. MoM growth (last 12m)
  const monthlyNew: Record<string, number> = {};
  for (const c of allContracts) {
    if (!c.created_at) continue;
    const monthKey = c.created_at.slice(0, 7);
    monthlyNew[monthKey] = (monthlyNew[monthKey] || 0) + 1;
  }
  const sortedMonths = Object.entries(monthlyNew).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  const momGrowth: { month: string; count: number; growth_pct: number | null }[] = [];
  for (let i = 0; i < sortedMonths.length; i++) {
    const [month, count] = sortedMonths[i];
    const prevCount = i > 0 ? sortedMonths[i - 1][1] : null;
    momGrowth.push({ month, count, growth_pct: prevCount && prevCount > 0 ? Math.round(((count - prevCount) / prevCount) * 100) : null });
  }

  // 10. Value by type (active)
  const activeContracts = allContracts.filter(c => ["ativo", "vigencia_pendente"].includes(c.status));
  const valueByType: Record<string, { count: number; total: number; monthly: number }> = {};
  for (const c of activeContracts) {
    if (!valueByType[c.contract_type]) valueByType[c.contract_type] = { count: 0, total: 0, monthly: 0 };
    valueByType[c.contract_type].count++;
    valueByType[c.contract_type].total += Number(c.total_value || 0);
    valueByType[c.contract_type].monthly += Number(c.monthly_value || 0);
  }

  return json({
    kpis: {
      total_contracts: allContracts.length, active_contracts: activeContracts.length,
      avg_lifecycle_days: avgLifecycleDays, renewal_rate_pct: renewalRate,
      cancellation_rate_pct: cancellationRate, collection_rate_pct: collectionRate,
      overdue_amount: overdueAmount, overdue_installments: overdueInstallments.length,
      obligation_compliance_rate_pct: obligationComplianceRate,
      avg_payment_delay_days: avgPaymentDelay,
      total_portfolio_value: activeContracts.reduce((s, c) => s + Number(c.total_value || 0), 0),
      monthly_recurring_value: activeContracts.reduce((s, c) => s + Number(c.monthly_value || 0), 0),
    },
    expiring_by_month: Object.entries(expiringByMonth).map(([month, count]) => ({ month, count })),
    mom_growth: momGrowth,
    value_by_type: Object.entries(valueByType).map(([type, data]) => ({ type, ...data })),
    generated_at: new Date().toISOString(),
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
    try { body = await req.json(); } catch { return errorResponse("Invalid JSON body", 400); }

    const { action } = body;
    if (!action || typeof action !== "string") return errorResponse("Missing or invalid 'action' field", 400);

    // Auth
    const auth = await resolveAuth(req);

    // RBAC check
    const requiredPermission = ACTION_PERMISSIONS[action];
    if (requiredPermission && !hasPermission(auth.userRoles, requiredPermission)) {
      return errorResponse("Permissão insuficiente para esta ação", 403);
    }

    // Route action
    switch (action) {
      case "analyze_contract":
        return await handleAnalyzeContract(auth, body, json, errorResponse);
      case "portfolio_health":
        return await handlePortfolioHealth(auth, body, json, errorResponse);
      case "advanced_metrics":
        return await handleAdvancedMetrics(auth, body, json, errorResponse);
      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (err: any) {
    if (err.status === 401 || err.status === 403) return errorResponse(err.message, err.status);
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] Unhandled error:`, err);
    return errorResponse("Erro interno do servidor", 500);
  }
});
