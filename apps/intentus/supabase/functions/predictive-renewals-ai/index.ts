/**
 * predictive-renewals-ai — Predictive Analytics para Renovações
 * F2 Item #3 — Sessão 60
 *
 * Score de probabilidade de renovação (0-100) por contrato via IA
 * Fatores de risco: inadimplência, histórico, mercado, obrigações
 * Recomendações proativas via Gemini 2.0 Flash
 * Self-contained (inline CORS/auth/RBAC)
 *
 * Actions:
 *   predict_contract  — score individual + fatores + recomendações
 *   predict_portfolio — top N contratos em risco + visão agregada
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── CORS ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS_RAW = Deno.env.get("ALLOWED_ORIGINS") ?? "";
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_RAW.split(",").map((s) => s.trim()).filter(Boolean);
const DEV_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PREVIEW_PATTERN = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

const PROD_ORIGINS = ["https://intentus-plataform.vercel.app", "https://app.intentusrealestate.com.br"];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (DEV_PATTERN.test(origin)) return true;
  if (PREVIEW_PATTERN.test(origin)) return true;
  return false;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isOriginAllowed(origin) ? origin : PROD_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ── RBAC ────────────────────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: ["predict_contract", "predict_portfolio"],
  admin: ["predict_contract", "predict_portfolio"],
  gerente: ["predict_contract", "predict_portfolio"],
  juridico: ["predict_contract", "predict_portfolio"],
  financeiro: ["predict_contract", "predict_portfolio"],
  corretor: ["predict_contract"],
};

// ── Types ───────────────────────────────────────────────────────────────
interface RiskFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  weight: number; // 0-100
  description: string;
}

interface Recommendation {
  action: string;
  priority: "alta" | "media" | "baixa";
  deadline_days: number | null;
  rationale: string;
}

interface PredictionResult {
  contract_id: string;
  contract_title: string;
  renewal_probability: number; // 0-100
  risk_level: "low" | "medium" | "high" | "critical";
  risk_factors: RiskFactor[];
  recommendations: Recommendation[];
  days_to_expiry: number | null;
  monthly_value: number | null;
  payment_health: number; // 0-100
  obligation_compliance: number; // 0-100
  renewal_history_count: number;
  model_used: string;
  predicted_at: string;
}

interface PortfolioSummary {
  total_active: number;
  expiring_90d: number;
  avg_renewal_probability: number;
  at_risk_count: number; // probability < 50
  high_risk_count: number; // probability < 30
  total_value_at_risk: number;
  predictions: PredictionResult[];
  model_used: string;
  predicted_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function daysBetween(a: string | null, b: Date): number | null {
  if (!a) return null;
  const d = new Date(a);
  return Math.ceil((d.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function riskLevelFromScore(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 70) return "low";
  if (score >= 50) return "medium";
  if (score >= 30) return "high";
  return "critical";
}

// ── Rule-based scoring engine ───────────────────────────────────────────

function computeRuleBasedScore(contract: any, context: {
  installments: any[];
  obligations: any[];
  renewals: any[];
  termination: any | null;
}): { score: number; factors: RiskFactor[]; paymentHealth: number; obligationCompliance: number } {
  const factors: RiskFactor[] = [];
  let score = 60; // base score
  const now = new Date();

  // ── 1. Days to expiry ──
  const daysToExpiry = daysBetween(contract.end_date, now);
  if (daysToExpiry !== null) {
    if (daysToExpiry < 0) {
      score -= 15;
      factors.push({ factor: "Contrato expirado", impact: "negative", weight: 15, description: `Expirou há ${Math.abs(daysToExpiry)} dias sem renovação` });
    } else if (daysToExpiry <= 30) {
      score -= 10;
      factors.push({ factor: "Vencimento iminente", impact: "negative", weight: 10, description: `Expira em ${daysToExpiry} dias — pouco tempo para negociação` });
    } else if (daysToExpiry <= 90) {
      score -= 3;
      factors.push({ factor: "Vencimento próximo", impact: "negative", weight: 3, description: `Expira em ${daysToExpiry} dias` });
    } else {
      score += 5;
      factors.push({ factor: "Prazo confortável", impact: "positive", weight: 5, description: `Mais de ${daysToExpiry} dias até o vencimento` });
    }
  }

  // ── 2. Payment health ──
  const totalInstallments = context.installments.length;
  const paidOnTime = context.installments.filter((i: any) => {
    if (i.status !== "pago" && i.status !== "paid") return false;
    if (!i.due_date || !i.paid_at) return true; // assume on-time if no paid_at
    return new Date(i.paid_at) <= new Date(i.due_date);
  }).length;
  const overdue = context.installments.filter((i: any) =>
    (i.status === "pendente" || i.status === "pending" || i.status === "atrasado" || i.status === "overdue") &&
    i.due_date && new Date(i.due_date) < now
  ).length;
  const paymentHealth = totalInstallments > 0
    ? Math.round(((paidOnTime + (totalInstallments - overdue - paidOnTime) * 0.5) / totalInstallments) * 100)
    : 50; // no data = neutral

  if (paymentHealth >= 90) {
    score += 15;
    factors.push({ factor: "Pagamentos exemplares", impact: "positive", weight: 15, description: `${paymentHealth}% de adimplência — excelente histórico` });
  } else if (paymentHealth >= 70) {
    score += 5;
    factors.push({ factor: "Pagamentos regulares", impact: "positive", weight: 5, description: `${paymentHealth}% de adimplência` });
  } else if (paymentHealth >= 50) {
    score -= 10;
    factors.push({ factor: "Atrasos frequentes", impact: "negative", weight: 10, description: `${paymentHealth}% de adimplência — atrasos recorrentes` });
  } else {
    score -= 20;
    factors.push({ factor: "Inadimplência grave", impact: "negative", weight: 20, description: `${paymentHealth}% de adimplência — alto risco financeiro` });
  }

  if (overdue > 0) {
    const penalty = Math.min(overdue * 5, 15);
    score -= penalty;
    factors.push({ factor: "Parcelas vencidas", impact: "negative", weight: penalty, description: `${overdue} parcela(s) em atraso atualmente` });
  }

  // ── 3. Obligation compliance ──
  const totalObligations = context.obligations.length;
  const completedObligations = context.obligations.filter((o: any) => o.status === "completed" || o.status === "concluida").length;
  const overdueObligations = context.obligations.filter((o: any) =>
    (o.status === "pending" || o.status === "pendente" || o.status === "active") &&
    o.due_date && new Date(o.due_date) < now
  ).length;
  const obligationCompliance = totalObligations > 0
    ? Math.round((completedObligations / totalObligations) * 100)
    : 50;

  if (obligationCompliance >= 90) {
    score += 10;
    factors.push({ factor: "Obrigações cumpridas", impact: "positive", weight: 10, description: `${obligationCompliance}% de compliance — inquilino responsável` });
  } else if (obligationCompliance >= 60) {
    score += 2;
    factors.push({ factor: "Obrigações parciais", impact: "neutral", weight: 2, description: `${obligationCompliance}% das obrigações cumpridas` });
  } else if (totalObligations > 0) {
    score -= 10;
    factors.push({ factor: "Obrigações descumpridas", impact: "negative", weight: 10, description: `Apenas ${obligationCompliance}% das obrigações cumpridas` });
  }

  if (overdueObligations > 0) {
    score -= Math.min(overdueObligations * 3, 10);
    factors.push({ factor: "Obrigações vencidas", impact: "negative", weight: Math.min(overdueObligations * 3, 10), description: `${overdueObligations} obrigação(ões) vencida(s)` });
  }

  // ── 4. Renewal history ──
  const pastRenewals = context.renewals.filter((r: any) => r.status === "formalizada");
  if (pastRenewals.length >= 2) {
    score += 15;
    factors.push({ factor: "Histórico de renovações", impact: "positive", weight: 15, description: `${pastRenewals.length} renovações anteriores formalizadas — forte tendência de permanência` });
  } else if (pastRenewals.length === 1) {
    score += 8;
    factors.push({ factor: "Renovação anterior", impact: "positive", weight: 8, description: "1 renovação anterior formalizada" });
  } else {
    factors.push({ factor: "Primeira renovação", impact: "neutral", weight: 0, description: "Sem histórico de renovações — incerteza maior" });
  }

  // Cancelled renewals are a bad sign
  const cancelledRenewals = context.renewals.filter((r: any) => r.status === "cancelada");
  if (cancelledRenewals.length > 0) {
    score -= 10;
    factors.push({ factor: "Renovações canceladas", impact: "negative", weight: 10, description: `${cancelledRenewals.length} renovação(ões) cancelada(s) no passado` });
  }

  // ── 5. Active termination process ──
  if (context.termination) {
    const tStatus = context.termination.status;
    if (tStatus !== "cancelado") {
      score -= 30;
      factors.push({ factor: "Processo de rescisão ativo", impact: "negative", weight: 30, description: `Rescisão em andamento (status: ${tStatus}) — renovação improvável` });
    }
  }

  // ── 6. Contract duration (tenure) ──
  if (contract.start_date) {
    const tenureMonths = Math.floor((now.getTime() - new Date(contract.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (tenureMonths >= 36) {
      score += 10;
      factors.push({ factor: "Inquilino de longa data", impact: "positive", weight: 10, description: `${tenureMonths} meses de contrato — forte vínculo` });
    } else if (tenureMonths >= 12) {
      score += 3;
      factors.push({ factor: "Inquilino estabelecido", impact: "positive", weight: 3, description: `${tenureMonths} meses de contrato` });
    } else {
      factors.push({ factor: "Contrato recente", impact: "neutral", weight: 0, description: `${tenureMonths} meses — pouco histórico` });
    }
  }

  // ── 7. Contract value (higher value = more negotiation) ──
  const mv = contract.monthly_value ?? 0;
  if (mv > 10000) {
    score -= 3;
    factors.push({ factor: "Valor alto", impact: "negative", weight: 3, description: `R$ ${mv.toLocaleString("pt-BR")}/mês — maior poder de barganha do inquilino` });
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  return { score, factors, paymentHealth, obligationCompliance };
}

// ── AI Recommendations ──────────────────────────────────────────────────

async function generateAIRecommendations(
  contract: any,
  score: number,
  factors: RiskFactor[],
  context: { paymentHealth: number; obligationCompliance: number; daysToExpiry: number | null; renewalCount: number },
): Promise<{ recommendations: Recommendation[]; model: string }> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return { recommendations: generateFallbackRecommendations(score, factors, context), model: "rule_engine_v1" };
  }

  const factorsSummary = factors.map((f) => `- ${f.factor} (${f.impact}): ${f.description}`).join("\n");

  const prompt = `Você é um consultor especialista em gestão imobiliária no Brasil.

Analise o contrato abaixo e gere recomendações PROATIVAS para maximizar a probabilidade de renovação.

## Dados do Contrato
- Título: ${contract.title || "Sem título"}
- Tipo: ${contract.contract_type || "N/A"}
- Valor mensal: R$ ${(contract.monthly_value ?? 0).toLocaleString("pt-BR")}
- Dias até vencimento: ${context.daysToExpiry ?? "N/A"}
- Score de renovação: ${score}/100 (${riskLevelFromScore(score)})
- Saúde pagamentos: ${context.paymentHealth}%
- Compliance obrigações: ${context.obligationCompliance}%
- Renovações anteriores: ${context.renewalCount}

## Fatores de Risco
${factorsSummary}

## Instruções
Gere exatamente 3-5 recomendações acionáveis. Para cada uma:
- action: frase curta imperativa (ex: "Agendar reunião de renovação")
- priority: "alta", "media" ou "baixa"
- deadline_days: prazo sugerido em dias (null se não aplicável)
- rationale: justificativa em 1-2 frases

Responda APENAS em JSON válido no formato:
{ "recommendations": [{ "action": "", "priority": "", "deadline_days": null, "rationale": "" }] }`;

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!resp.ok) {
      console.error("OpenRouter error:", resp.status, await resp.text());
      return { recommendations: generateFallbackRecommendations(score, factors, context), model: "rule_engine_v1" };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { recommendations: generateFallbackRecommendations(score, factors, context), model: "rule_engine_v1" };
    }

    const parsed = JSON.parse(content);
    const recs = (parsed.recommendations || []).map((r: any) => ({
      action: String(r.action || "").slice(0, 200),
      priority: ["alta", "media", "baixa"].includes(r.priority) ? r.priority : "media",
      deadline_days: typeof r.deadline_days === "number" ? r.deadline_days : null,
      rationale: String(r.rationale || "").slice(0, 500),
    }));

    return { recommendations: recs.length > 0 ? recs : generateFallbackRecommendations(score, factors, context), model: "gemini-2.0-flash" };
  } catch (err) {
    console.error("AI recommendation error:", err);
    return { recommendations: generateFallbackRecommendations(score, factors, context), model: "rule_engine_v1" };
  }
}

function generateFallbackRecommendations(
  score: number,
  factors: RiskFactor[],
  ctx: { paymentHealth: number; obligationCompliance: number; daysToExpiry: number | null; renewalCount: number },
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (ctx.daysToExpiry !== null && ctx.daysToExpiry <= 90 && ctx.daysToExpiry > 0) {
    recs.push({
      action: "Iniciar negociação de renovação",
      priority: ctx.daysToExpiry <= 30 ? "alta" : "media",
      deadline_days: Math.max(ctx.daysToExpiry - 15, 7),
      rationale: `Contrato expira em ${ctx.daysToExpiry} dias. Iniciar conversas para evitar vacância.`,
    });
  }

  if (ctx.paymentHealth < 70) {
    recs.push({
      action: "Verificar situação financeira do inquilino",
      priority: "alta",
      deadline_days: 7,
      rationale: `Adimplência de ${ctx.paymentHealth}% indica risco financeiro. Avaliar capacidade de pagamento antes de propor renovação.`,
    });
  }

  if (ctx.obligationCompliance < 60) {
    recs.push({
      action: "Revisar cumprimento de obrigações contratuais",
      priority: "media",
      deadline_days: 14,
      rationale: `Apenas ${ctx.obligationCompliance}% das obrigações cumpridas. Discutir pendências antes da renovação.`,
    });
  }

  if (score < 30) {
    recs.push({
      action: "Preparar plano de contingência para vacância",
      priority: "alta",
      deadline_days: 30,
      rationale: "Probabilidade de renovação baixa. Iniciar busca por novos inquilinos paralelamente.",
    });
  }

  if (score >= 70 && ctx.renewalCount === 0) {
    recs.push({
      action: "Propor renovação com condições favoráveis",
      priority: "media",
      deadline_days: 30,
      rationale: "Bom histórico sem renovações anteriores. Oferecer incentivo para primeira renovação.",
    });
  }

  if (recs.length === 0) {
    recs.push({
      action: "Monitorar contrato normalmente",
      priority: "baixa",
      deadline_days: null,
      rationale: "Contrato sem riscos significativos identificados. Manter acompanhamento regular.",
    });
  }

  return recs;
}

// ── Action Handlers ─────────────────────────────────────────────────────

async function handlePredictContract(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  body: any,
): Promise<PredictionResult> {
  const contractId = body.contract_id;
  if (!contractId) throw new Error("contract_id é obrigatório");

  // Fetch contract
  const { data: contract, error: cErr } = await supabase
    .from("contracts")
    .select("id, title, contract_type, status, start_date, end_date, monthly_value, property_id")
    .eq("id", contractId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (cErr) throw new Error("Erro ao buscar contrato");
  if (!contract) throw new Error("Contrato não encontrado");

  // Fetch context in parallel
  const [installmentsRes, obligationsRes, renewalsRes, terminationRes] = await Promise.all([
    supabase.from("contract_installments").select("id, status, due_date, paid_at, amount").eq("contract_id", contractId),
    supabase.from("contract_obligations").select("id, status, due_date, title").eq("contract_id", contractId),
    supabase.from("contract_renewals").select("id, status, new_end_date, new_value, created_at").eq("contract_id", contractId),
    supabase.from("contract_terminations").select("id, status, created_at").eq("contract_id", contractId).neq("status", "cancelado").maybeSingle(),
  ]);

  const installments = installmentsRes.data ?? [];
  const obligations = obligationsRes.data ?? [];
  const renewals = renewalsRes.data ?? [];
  const termination = terminationRes.data;

  // Compute rule-based score
  const { score, factors, paymentHealth, obligationCompliance } = computeRuleBasedScore(contract, {
    installments, obligations, renewals, termination,
  });

  const daysToExpiry = daysBetween(contract.end_date, new Date());
  const renewalCount = renewals.filter((r: any) => r.status === "formalizada").length;

  // Generate AI recommendations
  const { recommendations, model } = await generateAIRecommendations(
    contract, score, factors,
    { paymentHealth, obligationCompliance, daysToExpiry, renewalCount },
  );

  return {
    contract_id: contract.id,
    contract_title: contract.title || `Contrato ${contract.id.slice(0, 8)}`,
    renewal_probability: score,
    risk_level: riskLevelFromScore(score),
    risk_factors: factors,
    recommendations,
    days_to_expiry: daysToExpiry,
    monthly_value: contract.monthly_value,
    payment_health: paymentHealth,
    obligation_compliance: obligationCompliance,
    renewal_history_count: renewalCount,
    model_used: model,
    predicted_at: new Date().toISOString(),
  };
}

async function handlePredictPortfolio(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  body: any,
): Promise<PortfolioSummary> {
  const limit = Math.min(body.limit ?? 20, 50);
  const daysAhead = body.days_ahead ?? 180;

  // Fetch active/expiring contracts
  const now = new Date();
  const cutoffDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: contracts, error: cErr } = await supabase
    .from("contracts")
    .select("id, title, contract_type, status, start_date, end_date, monthly_value, property_id")
    .eq("tenant_id", tenantId)
    .in("status", ["ativo", "vigencia_pendente", "em_alteracao"])
    .not("end_date", "is", null)
    .lte("end_date", cutoffDate)
    .order("end_date", { ascending: true });

  if (cErr) throw new Error("Erro ao buscar contratos");
  const contractList = contracts ?? [];

  if (contractList.length === 0) {
    return {
      total_active: 0, expiring_90d: 0, avg_renewal_probability: 0,
      at_risk_count: 0, high_risk_count: 0, total_value_at_risk: 0,
      predictions: [], model_used: "rule_engine_v1", predicted_at: new Date().toISOString(),
    };
  }

  const contractIds = contractList.map((c: any) => c.id);

  // Batch fetch all context data
  const [installmentsRes, obligationsRes, renewalsRes, terminationsRes] = await Promise.all([
    supabase.from("contract_installments").select("id, contract_id, status, due_date, paid_at, amount").in("contract_id", contractIds),
    supabase.from("contract_obligations").select("id, contract_id, status, due_date, title").in("contract_id", contractIds),
    supabase.from("contract_renewals").select("id, contract_id, status, new_end_date, new_value, created_at").in("contract_id", contractIds),
    supabase.from("contract_terminations").select("id, contract_id, status, created_at").in("contract_id", contractIds).neq("status", "cancelado"),
  ]);

  // Group by contract_id
  const installmentsByContract = new Map<string, any[]>();
  const obligationsByContract = new Map<string, any[]>();
  const renewalsByContract = new Map<string, any[]>();
  const terminationByContract = new Map<string, any>();

  for (const i of (installmentsRes.data ?? [])) { const arr = installmentsByContract.get(i.contract_id) ?? []; arr.push(i); installmentsByContract.set(i.contract_id, arr); }
  for (const o of (obligationsRes.data ?? [])) { const arr = obligationsByContract.get(o.contract_id) ?? []; arr.push(o); obligationsByContract.set(o.contract_id, arr); }
  for (const r of (renewalsRes.data ?? [])) { const arr = renewalsByContract.get(r.contract_id) ?? []; arr.push(r); renewalsByContract.set(r.contract_id, arr); }
  for (const t of (terminationsRes.data ?? [])) { terminationByContract.set(t.contract_id, t); }

  // Score each contract
  const predictions: PredictionResult[] = [];
  let aiModel = "rule_engine_v1";

  for (const contract of contractList) {
    const installments = installmentsByContract.get(contract.id) ?? [];
    const obligations = obligationsByContract.get(contract.id) ?? [];
    const renewals = renewalsByContract.get(contract.id) ?? [];
    const termination = terminationByContract.get(contract.id) ?? null;

    const { score, factors, paymentHealth, obligationCompliance } = computeRuleBasedScore(contract, {
      installments, obligations, renewals, termination,
    });

    const daysToExpiry = daysBetween(contract.end_date, now);
    const renewalCount = renewals.filter((r: any) => r.status === "formalizada").length;

    // Only generate AI recommendations for at-risk contracts (score < 70)
    let recommendations: Recommendation[];
    let model: string;
    if (score < 70) {
      const aiResult = await generateAIRecommendations(
        contract, score, factors,
        { paymentHealth, obligationCompliance, daysToExpiry, renewalCount },
      );
      recommendations = aiResult.recommendations;
      model = aiResult.model;
      if (model !== "rule_engine_v1") aiModel = model;
    } else {
      recommendations = generateFallbackRecommendations(score, factors, { paymentHealth, obligationCompliance, daysToExpiry, renewalCount });
      model = "rule_engine_v1";
    }

    predictions.push({
      contract_id: contract.id,
      contract_title: contract.title || `Contrato ${contract.id.slice(0, 8)}`,
      renewal_probability: score,
      risk_level: riskLevelFromScore(score),
      risk_factors: factors,
      recommendations,
      days_to_expiry: daysToExpiry,
      monthly_value: contract.monthly_value,
      payment_health: paymentHealth,
      obligation_compliance: obligationCompliance,
      renewal_history_count: renewalCount,
      model_used: model,
      predicted_at: new Date().toISOString(),
    });
  }

  // Sort by score ascending (most at-risk first), limit
  predictions.sort((a, b) => a.renewal_probability - b.renewal_probability);
  const limited = predictions.slice(0, limit);

  const expiring90d = contractList.filter((c: any) => {
    const d = daysBetween(c.end_date, now);
    return d !== null && d >= 0 && d <= 90;
  }).length;

  const atRisk = predictions.filter((p) => p.renewal_probability < 50);
  const highRisk = predictions.filter((p) => p.renewal_probability < 30);
  const totalValueAtRisk = atRisk.reduce((sum, p) => sum + (p.monthly_value ?? 0), 0);
  const avgProb = predictions.length > 0
    ? Math.round(predictions.reduce((sum, p) => sum + p.renewal_probability, 0) / predictions.length)
    : 0;

  return {
    total_active: contractList.length,
    expiring_90d: expiring90d,
    avg_renewal_probability: avgProb,
    at_risk_count: atRisk.length,
    high_risk_count: highRisk.length,
    total_value_at_risk: totalValueAtRisk,
    predictions: limited,
    model_used: aiModel,
    predicted_at: new Date().toISOString(),
  };
}

// ── Main Handler ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Auth
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });

    // Tenant
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return new Response(JSON.stringify({ error: "Tenant não encontrado" }), { status: 403, headers: { ...headers, "Content-Type": "application/json" } });

    // RBAC
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("tenant_id", tenantId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (roles.length === 0) roles.push("corretor"); // default

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "predict_contract";

    // Check RBAC
    const allowed = roles.some((role: string) => (ROLE_PERMISSIONS[role] ?? []).includes(action));
    if (!allowed) return new Response(JSON.stringify({ error: "Permissão insuficiente" }), { status: 403, headers: { ...headers, "Content-Type": "application/json" } });

    let result: any;

    switch (action) {
      case "predict_contract":
        result = await handlePredictContract(supabase, tenantId, body);
        break;
      case "predict_portfolio":
        result = await handlePredictPortfolio(supabase, tenantId, body);
        break;
      default:
        return new Response(JSON.stringify({ error: `Action desconhecida: ${action}` }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("predictive-renewals-ai error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
