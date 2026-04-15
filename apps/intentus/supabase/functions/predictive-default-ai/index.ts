/**
 * predictive-default-ai — Predictive Analytics para Inadimplência
 * F2 Item #4 — Sessão 61
 *
 * Score de risco de inadimplência (0-100) por inquilino via IA
 * Fatores: histórico pagamentos, atrasos, tickets, tenure, valor contrato
 * Recomendações proativas via Gemini 2.0 Flash
 * Self-contained (inline CORS/auth/RBAC)
 *
 * Actions:
 *   predict_tenant    — score individual + fatores + recomendações
 *   predict_portfolio — top N inquilinos em risco + visão agregada
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
  superadmin: ["predict_tenant", "predict_portfolio"],
  admin: ["predict_tenant", "predict_portfolio"],
  gerente: ["predict_tenant", "predict_portfolio"],
  juridico: ["predict_tenant", "predict_portfolio"],
  financeiro: ["predict_tenant", "predict_portfolio"],
  corretor: ["predict_tenant"],
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

interface DefaultPrediction {
  person_id: string;
  person_name: string;
  person_type: string;
  default_risk_score: number; // 0-100 (0=sem risco, 100=risco máximo)
  risk_level: "baixo" | "medio" | "alto" | "critico";
  risk_factors: RiskFactor[];
  recommendations: Recommendation[];
  overdue_amount: number;
  overdue_count: number;
  total_contracts: number;
  active_contracts: number;
  payment_health: number; // 0-100
  avg_delay_days: number;
  monthly_exposure: number; // soma dos valores mensais dos contratos ativos
  model_used: string;
  predicted_at: string;
}

interface PortfolioDefaultSummary {
  total_tenants: number;
  at_risk_count: number; // score > 50
  high_risk_count: number; // score > 70
  critical_count: number; // score > 85
  total_overdue_amount: number;
  total_monthly_exposure: number;
  avg_risk_score: number;
  predictions: DefaultPrediction[];
  model_used: string;
  predicted_at: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function riskLevelFromScore(score: number): "baixo" | "medio" | "alto" | "critico" {
  if (score <= 25) return "baixo";
  if (score <= 50) return "medio";
  if (score <= 75) return "alto";
  return "critico";
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  return Math.max(0, Math.ceil((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

// ── Rule-based scoring engine ───────────────────────────────────────────

function computeDefaultRiskScore(
  person: any,
  installments: any[],
  contracts: any[],
  tickets: any[],
): { score: number; factors: RiskFactor[]; paymentHealth: number; avgDelayDays: number; overdueAmount: number; overdueCount: number } {
  const factors: RiskFactor[] = [];
  let score = 20; // base score (low risk)
  const now = new Date();

  // ── 1. Payment health (biggest weight) ──
  const total = installments.length;
  const paidOnTime = installments.filter((i: any) => {
    if (i.status !== "pago" && i.status !== "paid") return false;
    if (!i.due_date || !i.paid_at) return true;
    return new Date(i.paid_at) <= new Date(i.due_date);
  }).length;
  const paidLate = installments.filter((i: any) => {
    if (i.status !== "pago" && i.status !== "paid") return false;
    if (!i.due_date || !i.paid_at) return false;
    return new Date(i.paid_at) > new Date(i.due_date);
  }).length;
  const overdue = installments.filter((i: any) =>
    (i.status === "pendente" || i.status === "pending" || i.status === "atrasado" || i.status === "overdue") &&
    i.due_date && new Date(i.due_date) < now
  );
  const overdueCount = overdue.length;
  const overdueAmount = overdue.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0);

  const paymentHealth = total > 0
    ? Math.round((paidOnTime / total) * 100)
    : 50;
  const lateRate = total > 0 ? ((paidLate + overdueCount) / total) * 100 : 0;

  if (paymentHealth >= 90) {
    factors.push({ factor: "Pagamentos exemplares", impact: "positive", weight: 20, description: `${paymentHealth}% pagos em dia — excelente hist\u00f3rico` });
  } else if (paymentHealth >= 70) {
    score += 10;
    factors.push({ factor: "Pagamentos regulares", impact: "positive", weight: 10, description: `${paymentHealth}% pagos em dia` });
  } else if (paymentHealth >= 50) {
    score += 25;
    factors.push({ factor: "Atrasos frequentes", impact: "negative", weight: 25, description: `Apenas ${paymentHealth}% pagos em dia — padr\u00e3o preocupante` });
  } else if (total > 0) {
    score += 40;
    factors.push({ factor: "Inadimpl\u00eancia grave", impact: "negative", weight: 40, description: `${paymentHealth}% pagos em dia — risco cr\u00edtico financeiro` });
  }

  // ── 2. Currently overdue ──
  if (overdueCount === 0) {
    factors.push({ factor: "Sem parcelas vencidas", impact: "positive", weight: 10, description: "Nenhuma parcela em atraso atualmente" });
  } else if (overdueCount <= 2) {
    score += 15;
    factors.push({ factor: "Parcelas vencidas", impact: "negative", weight: 15, description: `${overdueCount} parcela(s) em atraso (R$ ${overdueAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})` });
  } else {
    score += 25;
    factors.push({ factor: "M\u00faltiplas parcelas vencidas", impact: "negative", weight: 25, description: `${overdueCount} parcelas em atraso totalizando R$ ${overdueAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` });
  }

  // ── 3. Average delay days ──
  const delays: number[] = [];
  for (const inst of installments) {
    if ((inst.status === "pago" || inst.status === "paid") && inst.paid_at && inst.due_date) {
      const delay = Math.max(0, (new Date(inst.paid_at).getTime() - new Date(inst.due_date).getTime()) / (1000 * 60 * 60 * 24));
      if (delay > 0) delays.push(delay);
    }
  }
  // Add current overdue delays
  for (const inst of overdue) {
    if (inst.due_date) {
      delays.push((now.getTime() - new Date(inst.due_date).getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  const avgDelayDays = delays.length > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;

  if (avgDelayDays === 0) {
    // no delay, already accounted above
  } else if (avgDelayDays <= 5) {
    score += 3;
    factors.push({ factor: "Atrasos leves", impact: "neutral", weight: 3, description: `M\u00e9dia de ${avgDelayDays} dias de atraso — toler\u00e1vel` });
  } else if (avgDelayDays <= 15) {
    score += 8;
    factors.push({ factor: "Atrasos moderados", impact: "negative", weight: 8, description: `M\u00e9dia de ${avgDelayDays} dias de atraso` });
  } else if (avgDelayDays <= 30) {
    score += 12;
    factors.push({ factor: "Atrasos significativos", impact: "negative", weight: 12, description: `M\u00e9dia de ${avgDelayDays} dias de atraso — padr\u00e3o recorrente` });
  } else {
    score += 18;
    factors.push({ factor: "Atrasos cr\u00f4nicos", impact: "negative", weight: 18, description: `M\u00e9dia de ${avgDelayDays} dias de atraso — inadimpl\u00eancia estrutural` });
  }

  // ── 4. Trend: Recent vs older payments ──
  if (total >= 6) {
    const recent = installments.slice(0, Math.ceil(total / 2));
    const older = installments.slice(Math.ceil(total / 2));
    const recentLateRate = recent.filter((i: any) =>
      (i.status === "atrasado" || i.status === "overdue") ||
      ((i.status === "pago" || i.status === "paid") && i.paid_at && i.due_date && new Date(i.paid_at) > new Date(i.due_date))
    ).length / recent.length;
    const olderLateRate = older.filter((i: any) =>
      (i.status === "atrasado" || i.status === "overdue") ||
      ((i.status === "pago" || i.status === "paid") && i.paid_at && i.due_date && new Date(i.paid_at) > new Date(i.due_date))
    ).length / older.length;

    if (recentLateRate < olderLateRate - 0.15) {
      score -= 5;
      factors.push({ factor: "Tend\u00eancia de melhora", impact: "positive", weight: 5, description: "Pagamentos recentes mais pontuais que hist\u00f3rico anterior" });
    } else if (recentLateRate > olderLateRate + 0.15) {
      score += 8;
      factors.push({ factor: "Tend\u00eancia de piora", impact: "negative", weight: 8, description: "Atrasos mais frequentes nos meses recentes" });
    }
  }

  // ── 5. Tenure (longer = more data, slightly better) ──
  const activeContracts = contracts.filter((c: any) => c.status === "ativo" || c.status === "vigencia_pendente");
  const oldestStart = contracts.reduce((oldest: string | null, c: any) => {
    if (!c.start_date) return oldest;
    if (!oldest || c.start_date < oldest) return c.start_date;
    return oldest;
  }, null);
  const tenureMonths = oldestStart ? Math.floor(daysSince(oldestStart) / 30) : 0;

  if (tenureMonths >= 36) {
    score -= 5;
    factors.push({ factor: "Inquilino de longa data", impact: "positive", weight: 5, description: `${tenureMonths} meses de relacionamento — hist\u00f3rico extenso` });
  } else if (tenureMonths >= 12) {
    score -= 2;
    factors.push({ factor: "Inquilino estabelecido", impact: "positive", weight: 2, description: `${tenureMonths} meses de contrato` });
  } else if (tenureMonths < 6 && total < 4) {
    score += 5;
    factors.push({ factor: "Pouco hist\u00f3rico", impact: "neutral", weight: 5, description: `Apenas ${tenureMonths} meses e ${total} parcelas — dados insuficientes para previs\u00e3o precisa` });
  }

  // ── 6. Support tickets (open tickets can signal disputes) ──
  const openTickets = tickets.filter((t: any) => t.status === "aberto" || t.status === "open" || t.status === "em_andamento");
  if (openTickets.length >= 3) {
    score += 8;
    factors.push({ factor: "M\u00faltiplos chamados abertos", impact: "negative", weight: 8, description: `${openTickets.length} chamados de suporte em aberto — poss\u00edvel insatisfa\u00e7\u00e3o` });
  } else if (openTickets.length > 0) {
    score += 3;
    factors.push({ factor: "Chamados abertos", impact: "neutral", weight: 3, description: `${openTickets.length} chamado(s) em aberto` });
  }

  // ── 7. Monthly exposure (higher = more impact) ──
  const monthlyExposure = activeContracts.reduce((sum: number, c: any) => sum + (Number(c.monthly_value) || 0), 0);
  if (monthlyExposure > 15000) {
    score += 3;
    factors.push({ factor: "Exposi\u00e7\u00e3o alta", impact: "negative", weight: 3, description: `R$ ${monthlyExposure.toLocaleString("pt-BR")}/m\u00eas — impacto financeiro significativo em caso de inadimpl\u00eancia` });
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  return { score, factors, paymentHealth, avgDelayDays, overdueAmount, overdueCount };
}

// ── AI Recommendations ──────────────────────────────────────────────────

async function generateAIRecommendations(
  person: any,
  score: number,
  factors: RiskFactor[],
  context: { paymentHealth: number; avgDelayDays: number; overdueAmount: number; overdueCount: number; monthlyExposure: number; activeContracts: number },
): Promise<{ recommendations: Recommendation[]; model: string }> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    return { recommendations: generateFallbackRecommendations(score, context), model: "rule_engine_v1" };
  }

  const factorsSummary = factors.map((f) => `- ${f.factor} (${f.impact}): ${f.description}`).join("\n");

  const prompt = `Voc\u00ea \u00e9 um especialista em gest\u00e3o de inadimpl\u00eancia imobili\u00e1ria no Brasil.

Analise o inquilino abaixo e gere recomenda\u00e7\u00f5es PROATIVAS para reduzir o risco de inadimpl\u00eancia.

## Dados do Inquilino
- Nome: ${person.name || "N/A"}
- Tipo: ${person.person_type === "pf" ? "Pessoa F\u00edsica" : "Pessoa Jur\u00eddica"}
- Score de risco: ${score}/100 (${riskLevelFromScore(score)})
- Sa\u00fade pagamentos: ${context.paymentHealth}%
- Atraso m\u00e9dio: ${context.avgDelayDays} dias
- Parcelas em atraso: ${context.overdueCount} (R$ ${context.overdueAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
- Contratos ativos: ${context.activeContracts}
- Exposi\u00e7\u00e3o mensal: R$ ${context.monthlyExposure.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

## Fatores de Risco
${factorsSummary}

## Instru\u00e7\u00f5es
Gere exatamente 3-5 recomenda\u00e7\u00f5es acion\u00e1veis. Para cada uma:
- action: frase curta imperativa (ex: "Enviar notifica\u00e7\u00e3o extrajudicial")
- priority: "alta", "media" ou "baixa"
- deadline_days: prazo sugerido em dias (null se n\u00e3o aplic\u00e1vel)
- rationale: justificativa em 1-2 frases

Considere as a\u00e7\u00f5es t\u00edpicas: monitorar, contato preventivo, acordo amig\u00e1vel, notifica\u00e7\u00e3o formal, encaminhar jur\u00eddico, r\u00e9gua de cobran\u00e7a.

Responda APENAS em JSON v\u00e1lido no formato:
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
      return { recommendations: generateFallbackRecommendations(score, context), model: "rule_engine_v1" };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { recommendations: generateFallbackRecommendations(score, context), model: "rule_engine_v1" };
    }

    const parsed = JSON.parse(content);
    const recs = (parsed.recommendations || []).map((r: any) => ({
      action: String(r.action || "").slice(0, 200),
      priority: ["alta", "media", "baixa"].includes(r.priority) ? r.priority : "media",
      deadline_days: typeof r.deadline_days === "number" ? r.deadline_days : null,
      rationale: String(r.rationale || "").slice(0, 500),
    }));

    return { recommendations: recs.length > 0 ? recs : generateFallbackRecommendations(score, context), model: "gemini-2.0-flash" };
  } catch (err) {
    console.error("AI recommendation error:", err);
    return { recommendations: generateFallbackRecommendations(score, context), model: "rule_engine_v1" };
  }
}

function generateFallbackRecommendations(
  score: number,
  ctx: { paymentHealth: number; avgDelayDays: number; overdueAmount: number; overdueCount: number; monthlyExposure: number; activeContracts: number },
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (ctx.overdueCount > 0 && ctx.overdueAmount > 5000) {
    recs.push({
      action: "Enviar notifica\u00e7\u00e3o formal de cobran\u00e7a",
      priority: "alta",
      deadline_days: 5,
      rationale: `R$ ${ctx.overdueAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em atraso. A\u00e7\u00e3o imediata para evitar acumula\u00e7\u00e3o.`,
    });
  } else if (ctx.overdueCount > 0) {
    recs.push({
      action: "Realizar contato preventivo por telefone",
      priority: "alta",
      deadline_days: 3,
      rationale: `${ctx.overdueCount} parcela(s) em atraso. Contato direto para entender a situa\u00e7\u00e3o.`,
    });
  }

  if (score > 70) {
    recs.push({
      action: "Avaliar proposta de acordo amig\u00e1vel",
      priority: "alta",
      deadline_days: 10,
      rationale: "Risco alto de inadimpl\u00eancia. Acordo pode preservar o relacionamento e garantir recebimento parcial.",
    });
  }

  if (ctx.avgDelayDays > 15) {
    recs.push({
      action: "Ativar r\u00e9gua de cobran\u00e7a autom\u00e1tica",
      priority: "media",
      deadline_days: 7,
      rationale: `Atraso m\u00e9dio de ${ctx.avgDelayDays} dias. Automa\u00e7\u00e3o de cobran\u00e7a pode reduzir atrasos.`,
    });
  }

  if (ctx.paymentHealth < 50) {
    recs.push({
      action: "Solicitar garantias adicionais",
      priority: "media",
      deadline_days: 30,
      rationale: `Adimpl\u00eancia de ${ctx.paymentHealth}%. Garantias reduzem exposi\u00e7\u00e3o ao risco.`,
    });
  }

  if (score > 85) {
    recs.push({
      action: "Encaminhar caso ao jur\u00eddico",
      priority: "alta",
      deadline_days: 7,
      rationale: "Risco cr\u00edtico de inadimpl\u00eancia. Assessoria jur\u00eddica necess\u00e1ria para preparar a\u00e7\u00f5es.",
    });
  }

  if (recs.length === 0) {
    recs.push({
      action: "Monitorar normalmente",
      priority: "baixa",
      deadline_days: null,
      rationale: "Inquilino sem riscos significativos. Manter acompanhamento regular.",
    });
  }

  return recs;
}

// ── Action Handlers ─────────────────────────────────────────────────────

async function handlePredictTenant(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  body: any,
): Promise<DefaultPrediction> {
  const personId = body.person_id;
  if (!personId) throw new Error("person_id \u00e9 obrigat\u00f3rio");

  // Fetch person
  const { data: person, error: pErr } = await supabase
    .from("people")
    .select("id, name, person_type, cpf_cnpj, created_at")
    .eq("id", personId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (pErr) throw new Error("Erro ao buscar pessoa");
  if (!person) throw new Error("Pessoa n\u00e3o encontrada");

  // Get contracts this person is party to
  const { data: partyRows } = await supabase
    .from("contract_parties")
    .select("contract_id")
    .eq("person_id", personId);

  const contractIds = (partyRows ?? []).map((p: any) => p.contract_id);

  if (contractIds.length === 0) {
    return {
      person_id: personId,
      person_name: person.name || "Sem nome",
      person_type: person.person_type || "pf",
      default_risk_score: 10,
      risk_level: "baixo",
      risk_factors: [{ factor: "Sem contratos", impact: "neutral", weight: 0, description: "Pessoa sem contratos vinculados" }],
      recommendations: [{ action: "Nenhuma a\u00e7\u00e3o necess\u00e1ria", priority: "baixa", deadline_days: null, rationale: "Sem contratos para avaliar" }],
      overdue_amount: 0, overdue_count: 0, total_contracts: 0, active_contracts: 0,
      payment_health: 100, avg_delay_days: 0, monthly_exposure: 0,
      model_used: "rule_engine_v1", predicted_at: new Date().toISOString(),
    };
  }

  // Fetch context in parallel
  const [contractsRes, installmentsRes, ticketsRes] = await Promise.all([
    supabase.from("contracts").select("id, status, start_date, end_date, monthly_value, contract_type").in("id", contractIds).eq("tenant_id", tenantId),
    supabase.from("contract_installments").select("id, contract_id, status, due_date, paid_at, amount").in("contract_id", contractIds).order("due_date", { ascending: false }).limit(60),
    supabase.from("support_tickets").select("id, status, priority, category, created_at").eq("person_id", personId).order("created_at", { ascending: false }).limit(20),
  ]);

  const contracts = contractsRes.data ?? [];
  const installments = installmentsRes.data ?? [];
  const tickets = ticketsRes.data ?? [];

  // Compute rule-based score
  const { score, factors, paymentHealth, avgDelayDays, overdueAmount, overdueCount } = computeDefaultRiskScore(person, installments, contracts, tickets);

  const activeContracts = contracts.filter((c: any) => c.status === "ativo" || c.status === "vigencia_pendente");
  const monthlyExposure = activeContracts.reduce((sum: number, c: any) => sum + (Number(c.monthly_value) || 0), 0);

  // AI recommendations for at-risk tenants (score > 40)
  let recommendations: Recommendation[];
  let model: string;
  if (score > 40) {
    const aiResult = await generateAIRecommendations(person, score, factors, {
      paymentHealth, avgDelayDays, overdueAmount, overdueCount, monthlyExposure, activeContracts: activeContracts.length,
    });
    recommendations = aiResult.recommendations;
    model = aiResult.model;
  } else {
    recommendations = generateFallbackRecommendations(score, {
      paymentHealth, avgDelayDays, overdueAmount, overdueCount, monthlyExposure, activeContracts: activeContracts.length,
    });
    model = "rule_engine_v1";
  }

  return {
    person_id: personId,
    person_name: person.name || "Sem nome",
    person_type: person.person_type || "pf",
    default_risk_score: score,
    risk_level: riskLevelFromScore(score),
    risk_factors: factors,
    recommendations,
    overdue_amount: overdueAmount,
    overdue_count: overdueCount,
    total_contracts: contracts.length,
    active_contracts: activeContracts.length,
    payment_health: paymentHealth,
    avg_delay_days: avgDelayDays,
    monthly_exposure: monthlyExposure,
    model_used: model,
    predicted_at: new Date().toISOString(),
  };
}

async function handlePredictPortfolio(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  body: any,
): Promise<PortfolioDefaultSummary> {
  const limit = Math.min(body.limit ?? 20, 50);

  // Get all people who are parties to contracts of this tenant
  const { data: activeContracts } = await supabase
    .from("contracts")
    .select("id, status, monthly_value, start_date, end_date, contract_type")
    .eq("tenant_id", tenantId)
    .in("status", ["ativo", "vigencia_pendente", "em_alteracao"]);

  const contractList = activeContracts ?? [];
  if (contractList.length === 0) {
    return {
      total_tenants: 0, at_risk_count: 0, high_risk_count: 0, critical_count: 0,
      total_overdue_amount: 0, total_monthly_exposure: 0, avg_risk_score: 0,
      predictions: [], model_used: "rule_engine_v1", predicted_at: new Date().toISOString(),
    };
  }

  const contractIds = contractList.map((c: any) => c.id);

  // Get all people linked to these contracts (inquilinos only)
  const { data: partyRows } = await supabase
    .from("contract_parties")
    .select("person_id, contract_id, role")
    .in("contract_id", contractIds)
    .in("role", ["inquilino", "tenant", "locatario", "locatário", "comprador", "buyer"]);

  if (!partyRows || partyRows.length === 0) {
    return {
      total_tenants: 0, at_risk_count: 0, high_risk_count: 0, critical_count: 0,
      total_overdue_amount: 0, total_monthly_exposure: 0, avg_risk_score: 0,
      predictions: [], model_used: "rule_engine_v1", predicted_at: new Date().toISOString(),
    };
  }

  // Unique person IDs
  const personIds = [...new Set(partyRows.map((p: any) => p.person_id))];

  // Batch fetch all data
  const [peopleRes, installmentsRes, ticketsRes] = await Promise.all([
    supabase.from("people").select("id, name, person_type, cpf_cnpj, created_at").in("id", personIds).eq("tenant_id", tenantId),
    supabase.from("contract_installments").select("id, contract_id, status, due_date, paid_at, amount").in("contract_id", contractIds).order("due_date", { ascending: false }),
    supabase.from("support_tickets").select("id, person_id, status, priority, category, created_at").in("person_id", personIds).order("created_at", { ascending: false }),
  ]);

  const people = peopleRes.data ?? [];
  const allInstallments = installmentsRes.data ?? [];
  const allTickets = ticketsRes.data ?? [];

  // Group by person_id
  const contractsByPerson = new Map<string, any[]>();
  for (const pr of partyRows) {
    const contract = contractList.find((c: any) => c.id === pr.contract_id);
    if (!contract) continue;
    const arr = contractsByPerson.get(pr.person_id) ?? [];
    arr.push(contract);
    contractsByPerson.set(pr.person_id, arr);
  }

  // Group installments by person via contract_parties mapping
  const contractToPersons = new Map<string, Set<string>>();
  for (const pr of partyRows) {
    const set = contractToPersons.get(pr.contract_id) ?? new Set();
    set.add(pr.person_id);
    contractToPersons.set(pr.contract_id, set);
  }

  const installmentsByPerson = new Map<string, any[]>();
  for (const inst of allInstallments) {
    const persons = contractToPersons.get(inst.contract_id);
    if (!persons) continue;
    for (const pid of persons) {
      const arr = installmentsByPerson.get(pid) ?? [];
      arr.push(inst);
      installmentsByPerson.set(pid, arr);
    }
  }

  const ticketsByPerson = new Map<string, any[]>();
  for (const t of allTickets) {
    if (!t.person_id) continue;
    const arr = ticketsByPerson.get(t.person_id) ?? [];
    arr.push(t);
    ticketsByPerson.set(t.person_id, arr);
  }

  // Score each person
  const predictions: DefaultPrediction[] = [];
  let aiModel = "rule_engine_v1";

  for (const person of people) {
    const personContracts = contractsByPerson.get(person.id) ?? [];
    const installments = (installmentsByPerson.get(person.id) ?? []).slice(0, 60);
    const tickets = ticketsByPerson.get(person.id) ?? [];

    const { score, factors, paymentHealth, avgDelayDays, overdueAmount, overdueCount } = computeDefaultRiskScore(person, installments, personContracts, tickets);

    const personActiveContracts = personContracts.filter((c: any) => c.status === "ativo" || c.status === "vigencia_pendente");
    const monthlyExposure = personActiveContracts.reduce((sum: number, c: any) => sum + (Number(c.monthly_value) || 0), 0);

    // AI recommendations only for at-risk (score > 50)
    let recommendations: Recommendation[];
    let model: string;
    if (score > 50) {
      const aiResult = await generateAIRecommendations(person, score, factors, {
        paymentHealth, avgDelayDays, overdueAmount, overdueCount, monthlyExposure, activeContracts: personActiveContracts.length,
      });
      recommendations = aiResult.recommendations;
      model = aiResult.model;
      if (model !== "rule_engine_v1") aiModel = model;
    } else {
      recommendations = generateFallbackRecommendations(score, {
        paymentHealth, avgDelayDays, overdueAmount, overdueCount, monthlyExposure, activeContracts: personActiveContracts.length,
      });
      model = "rule_engine_v1";
    }

    predictions.push({
      person_id: person.id,
      person_name: person.name || "Sem nome",
      person_type: person.person_type || "pf",
      default_risk_score: score,
      risk_level: riskLevelFromScore(score),
      risk_factors: factors,
      recommendations,
      overdue_amount: overdueAmount,
      overdue_count: overdueCount,
      total_contracts: personContracts.length,
      active_contracts: personActiveContracts.length,
      payment_health: paymentHealth,
      avg_delay_days: avgDelayDays,
      monthly_exposure: monthlyExposure,
      model_used: model,
      predicted_at: new Date().toISOString(),
    });
  }

  // Sort by score descending (highest risk first), limit
  predictions.sort((a, b) => b.default_risk_score - a.default_risk_score);
  const limited = predictions.slice(0, limit);

  const atRisk = predictions.filter((p) => p.default_risk_score > 50);
  const highRisk = predictions.filter((p) => p.default_risk_score > 70);
  const critical = predictions.filter((p) => p.default_risk_score > 85);
  const totalOverdue = predictions.reduce((sum, p) => sum + p.overdue_amount, 0);
  const totalExposure = predictions.reduce((sum, p) => sum + p.monthly_exposure, 0);
  const avgScore = predictions.length > 0
    ? Math.round(predictions.reduce((sum, p) => sum + p.default_risk_score, 0) / predictions.length)
    : 0;

  return {
    total_tenants: predictions.length,
    at_risk_count: atRisk.length,
    high_risk_count: highRisk.length,
    critical_count: critical.length,
    total_overdue_amount: totalOverdue,
    total_monthly_exposure: totalExposure,
    avg_risk_score: avgScore,
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
    if (!authHeader) return new Response(JSON.stringify({ error: "N\u00e3o autorizado" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // Extract token from Bearer header
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: authHeader } },
    });

    // Auth
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "N\u00e3o autorizado" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });

    // Tenant
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
    const tenantId = profile?.tenant_id || user.id;
    if (!tenantId) return new Response(JSON.stringify({ error: "Tenant n\u00e3o encontrado" }), { status: 403, headers: { ...headers, "Content-Type": "application/json" } });

    // RBAC
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("tenant_id", tenantId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (roles.length === 0) roles.push("corretor"); // default

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "predict_tenant";

    // Check RBAC
    const allowed = roles.some((role: string) => (ROLE_PERMISSIONS[role] ?? []).includes(action));
    if (!allowed) return new Response(JSON.stringify({ error: "Permiss\u00e3o insuficiente" }), { status: 403, headers: { ...headers, "Content-Type": "application/json" } });

    let result: any;

    switch (action) {
      case "predict_tenant":
        result = await handlePredictTenant(supabase, tenantId, body);
        break;
      case "predict_portfolio":
        result = await handlePredictPortfolio(supabase, tenantId, body);
        break;
      default:
        return new Response(JSON.stringify({ error: `Action desconhecida: ${action}` }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("predictive-default-ai error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
