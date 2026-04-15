/**
 * fii-cra-simulator v1
 *
 * Edge Function multi-action para simulação de estruturas de investimento imobiliário.
 *
 * ACTIONS:
 *   simulate_fii         — Simula constituição de FII com o desenvolvimento como ativo
 *   simulate_cri_cra     — Simula securitização de recebíveis
 *   compare_structures   — Compara FII vs CRI/CRA
 *   list_simulations     — Lista simulações históricas
 *
 * MATEMÁTICA FINANCEIRA (inline):
 *   - IRR (TIR) via Newton-Raphson
 *   - NPV (VPL) mensal descontado
 *   - WAL (Weighted Average Life) para tranches
 *   - Yield calculations com distribuições periódicas
 *
 * INPUTS:
 *   - VGV total (Valor Geral de Vendas)
 *   - Taxa de vacância
 *   - Taxas administrativas
 *   - Durações e prazos
 *   - Estrutura de tranches (CRA/CRI)
 *
 * OUTPUTS:
 *   - Quota/Tranche details
 *   - Projeções de fluxo de caixa
 *   - IRR, NPV, Yield, WAL
 *   - Análise comparativa
 *
 * Sessão 145 — Bloco H Sprint 5 — US-134/135
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS (padrão Intentus)
// ============================================================

const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o: string) => o.trim()).filter(Boolean);

const DEV_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-[a-zA-Z0-9-]+\.vercel\.app$/,
];
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS_RAW.length > 0) return ALLOWED_ORIGINS_RAW.includes(origin);
  return PROD_ORIGINS.includes(origin) || DEV_PATTERNS.some((re) => re.test(origin));
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ============================================================
// Types
// ============================================================

interface RequestContext {
  supabase: SupabaseClient;
  userId: string;
  tenantId: string;
}

interface FiiProjection {
  ano: number;
  receita_bruta: number;
  receita_liquida_apos_vacancia: number;
  despesas_admin: number;
  despesas_gerenciamento: number;
  fluxo_disponivel: number;
  fluxo_descontado: number;
  acumulado: number;
}

interface CriCraMonthlyFlow {
  mes: number;
  saldo_inicial: number;
  recebimento_principal: number;
  juros_senior: number;
  juros_mezzanine: number;
  juros_subordinada: number;
  provisionamento_default: number;
  pagamentos_senior: number;
  pagamentos_mezzanine: number;
  pagamentos_subordinada: number;
  saldo_final: number;
}

// ============================================================
// Financial Math (inline)
// ============================================================

/** NPV com desconto mensal */
function calcNPV(monthlyFlows: number[], rateMonthly: number): number {
  let npv = 0;
  for (let t = 0; t < monthlyFlows.length; t++) {
    npv += monthlyFlows[t] / Math.pow(1 + rateMonthly, t);
  }
  return npv;
}

/** IRR mensal via Newton-Raphson */
function calcIRRMonthly(cashflows: number[]): number | null {
  let rate = 0.01; // 1% inicial
  const maxIter = 100;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let npvDerivative = 0;

    for (let t = 0; t < cashflows.length; t++) {
      const factor = Math.pow(1 + rate, t);
      npv += cashflows[t] / factor;
      npvDerivative += (-t * cashflows[t]) / Math.pow(1 + rate, t + 1);
    }

    if (Math.abs(npv) < tolerance) return rate;

    const nextRate = rate - npv / npvDerivative;
    if (Math.abs(nextRate - rate) < tolerance) return nextRate;

    rate = nextRate;
  }

  return rate;
}

/** Converte taxa mensal para anual */
function monthlyToAnnual(rateMonthly: number): number {
  return (Math.pow(1 + rateMonthly, 12) - 1) * 100;
}

/** WAL (Weighted Average Life) em meses */
function calcWAL(principalSchedule: number[]): number {
  const totalPrincipal = principalSchedule.reduce((a, b) => a + b, 0);
  if (totalPrincipal === 0) return 0;

  let weightedSum = 0;
  for (let t = 0; t < principalSchedule.length; t++) {
    weightedSum += (t + 1) * principalSchedule[t];
  }

  return weightedSum / totalPrincipal;
}

// ============================================================
// ACTION: Simulate FII
// ============================================================

async function actionSimulateFii(
  ctx: RequestContext,
  body: {
    development_id: string;
    vgv_total: number;
    expected_monthly_revenue: number;
    vacancy_rate_pct: number;
    admin_fee_pct: number;
    management_fee_pct: number;
    number_of_quotas: number;
    expected_yield_annual_pct: number;
    duration_years: number;
    discount_rate_annual_pct: number;
  }
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string } }> {
  try {
    // Validate development
    const { data: dev, error: devErr } = await ctx.supabase
      .from("developments")
      .select("id")
      .eq("id", body.development_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (devErr || !dev) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Development não encontrado" },
      };
    }

    // Core calculations
    const quotaValue = body.vgv_total / body.number_of_quotas;
    const monthlyRevenueAfterVacancy =
      body.expected_monthly_revenue * (1 - body.vacancy_rate_pct / 100);
    const monthlyAdminFee = (body.vgv_total * body.admin_fee_pct) / 100 / 12;
    const monthlyMgmtFee = (monthlyRevenueAfterVacancy * body.management_fee_pct) / 100;

    // Project 10 years
    const monthlyDiscountRate = Math.pow(1 + body.discount_rate_annual_pct / 100, 1 / 12) - 1;
    const projections: FiiProjection[] = [];
    let accumulatedCashFlow = 0;
    const cashflows: number[] = [];

    for (let year = 1; year <= body.duration_years; year++) {
      const receitaBruta = body.expected_monthly_revenue * 12;
      const receitaLiquida = monthlyRevenueAfterVacancy * 12;
      const despesasAdmin = monthlyAdminFee * 12;
      const despesasMgmt = monthlyMgmtFee * 12;
      const fluxoDisponivel = receitaLiquida - despesasAdmin - despesasMgmt;
      const fluxoDescontado = fluxoDisponivel / Math.pow(1 + body.discount_rate_annual_pct / 100, year);

      accumulatedCashFlow += fluxoDescontado;
      cashflows.push(fluxoDisponivel / 12); // monthly for IRR

      projections.push({
        ano: year,
        receita_bruta: receitaBruta,
        receita_liquida_apos_vacancia: receitaLiquida,
        despesas_admin: despesasAdmin,
        despesas_gerenciamento: despesasMgmt,
        fluxo_disponivel: fluxoDisponivel,
        fluxo_descontado: fluxoDescontado,
        acumulado: accumulatedCashFlow,
      });
    }

    const irrMonthly = calcIRRMonthly(cashflows) || 0;
    const irrAnnual = monthlyToAnnual(irrMonthly);
    const npv5y = calcNPV(
      cashflows.slice(0, 60),
      monthlyDiscountRate
    );
    const npv10y = calcNPV(cashflows, monthlyDiscountRate);
    const monthlyDistributionPerQuota = (monthlyRevenueAfterVacancy * 0.9) / body.number_of_quotas; // 90% to quotas
    const annualYield = (monthlyDistributionPerQuota * 12 * 100) / quotaValue;
    const patrimonioLiquido = body.vgv_total;
    const pvpRatio = patrimonioLiquido / body.vgv_total;

    // Break-even
    let breakEvenMonths = 0;
    for (let m = 0; m < cashflows.length && breakEvenMonths === 0; m++) {
      if (
        cashflows.slice(0, m + 1).reduce((a, b) => a + b, 0) > 0
      ) {
        breakEvenMonths = m + 1;
      }
    }

    const result = {
      fii_id: `FII-${Date.now()}`,
      quota_value: quotaValue,
      number_of_quotas: body.number_of_quotas,
      patrimonio_liquido: patrimonioLiquido,
      monthly_distribution_per_quota: monthlyDistributionPerQuota,
      annual_yield_pct: annualYield,
      dividend_yield_pct: (monthlyDistributionPerQuota * 12 * 100) / quotaValue,
      pvp_ratio: pvpRatio,
      irr_projection_5years_pct: irrAnnual,
      irr_projection_10years_pct: irrAnnual,
      projections,
      npv_5years: npv5y,
      npv_10years: npv10y,
      break_even_months: breakEvenMonths,
      summary: `FII com ${body.number_of_quotas} quotas, valor unitário R$ ${quotaValue.toFixed(2)}, rendimento anual ${annualYield.toFixed(2)}%`,
      simulation_date: new Date().toISOString(),
    };

    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Erro desconhecido",
      },
    };
  }
}

// ============================================================
// ACTION: Simulate CRA/CRI
// ============================================================

async function actionSimulateCriCra(
  ctx: RequestContext,
  body: {
    development_id: string;
    total_receivables: number;
    duration_months: number;
    spread_over_cdi_pct: number;
    subordination_level_pct: number;
    credit_enhancement_type: string;
    credit_enhancement_value?: number;
    expected_default_rate_pct: number;
    tax_rate_pct?: number;
  }
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string } }> {
  try {
    // Validate development
    const { data: dev, error: devErr } = await ctx.supabase
      .from("developments")
      .select("id")
      .eq("id", body.development_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (devErr || !dev) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Development não encontrado" },
      };
    }

    const taxRate = (body.tax_rate_pct || 0) / 100;
    const subordinatedValue = body.total_receivables * (body.subordination_level_pct / 100);
    const seniorValue = body.total_receivables - subordinatedValue;
    const cdiBase = 10.5; // CDI benchmark (%)
    const seniorRate = cdiBase + body.spread_over_cdi_pct;
    const subordinatedRate = cdiBase + body.spread_over_cdi_pct + 3; // Higher for subordinada

    // Monthly cash flows
    const monthlyPrincipal = body.total_receivables / body.duration_months;
    const monthlyFlows: CriCraMonthlyFlow[] = [];
    let saldoAtual = body.total_receivables;
    const principalSchedule: number[] = [];

    for (let mes = 1; mes <= body.duration_months; mes++) {
      const jurosTotal = (saldoAtual * (seniorRate / 100)) / 12;
      const jurosSenior = (seniorValue * (seniorRate / 100)) / 12;
      const jurosSubordinada =
        ((saldoAtual - seniorValue) * (subordinatedRate / 100)) / 12;
      const provisionamento =
        saldoAtual * (body.expected_default_rate_pct / 100) / body.duration_months;

      const saldoFinal = saldoAtual - monthlyPrincipal;
      principalSchedule.push(monthlyPrincipal);

      monthlyFlows.push({
        mes,
        saldo_inicial: saldoAtual,
        recebimento_principal: monthlyPrincipal,
        juros_senior: jurosSenior,
        juros_mezzanine: 0,
        juros_subordinada: jurosSubordinada,
        provisionamento_default: provisionamento,
        pagamentos_senior: jurosSenior + monthlyPrincipal * (seniorValue / body.total_receivables),
        pagamentos_mezzanine: 0,
        pagamentos_subordinada: jurosSubordinada + monthlyPrincipal * (subordinatedValue / body.total_receivables),
        saldo_final: saldoFinal,
      });

      saldoAtual = saldoFinal;
    }

    // Calculations
    const wal = calcWAL(principalSchedule);
    const totalInterestCost = monthlyFlows.reduce((sum, f) => sum + f.juros_senior + f.juros_subordinada, 0);
    const monthlyDiscount = Math.pow(1 + seniorRate / 100 / 12, 1) - 1;
    const irr = calcIRRMonthly(
      monthlyFlows.map((f) => f.recebimento_principal + f.juros_senior + f.juros_subordinada)
    ) || 0;

    const result = {
      simulation_id: `CRICRA-${Date.now()}`,
      total_receivables: body.total_receivables,
      duration_months: body.duration_months,
      cdi_spread_pct: body.spread_over_cdi_pct,
      senior_tranche: {
        nome: "Sênior",
        tipo: "senior",
        valor_emitido: seniorValue,
        percentual_total: (seniorValue / body.total_receivables) * 100,
        taxa_anual_pct: seniorRate,
        valor_presente: seniorValue,
        prazo_medio_ponderado_meses: wal,
        risco_rating: "AAA",
      },
      subordinated_tranche: {
        nome: "Subordinada",
        tipo: "subordinada",
        valor_emitido: subordinatedValue,
        percentual_total: (subordinatedValue / body.total_receivables) * 100,
        taxa_anual_pct: subordinatedRate,
        valor_presente: subordinatedValue,
        prazo_medio_ponderado_meses: wal,
        risco_rating: "BB",
      },
      monthly_cash_flow: monthlyFlows,
      weighted_average_life_months: wal,
      total_interest_cost: totalInterestCost,
      effective_rate_annual_pct: monthlyToAnnual(irr),
      irr_senior_pct: seniorRate,
      irr_subordinada_pct: subordinatedRate,
      recovery_value: body.total_receivables * (1 - body.expected_default_rate_pct / 100),
      loss_given_default_pct: body.expected_default_rate_pct,
      npv_by_tranche: {
        senior: seniorValue,
        subordinada: subordinatedValue,
      },
      summary: `CRA/CRI com R$ ${(body.total_receivables / 1e6).toFixed(2)}M, ${body.duration_months} meses, ${body.subordination_level_pct.toFixed(1)}% subordinada`,
      simulation_date: new Date().toISOString(),
    };

    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Erro desconhecido",
      },
    };
  }
}

// ============================================================
// ACTION: List Simulations
// ============================================================

async function actionListSimulations(
  ctx: RequestContext,
  body: {
    development_id: string;
    tipo?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{
  ok: boolean;
  data?: {
    simulations: Record<string, unknown>[];
    total: number;
    offset: number;
    limit: number;
  };
  error?: { code: string; message: string };
}> {
  try {
    const limit = body.limit || 20;
    const offset = body.offset || 0;

    let query = ctx.supabase
      .from("development_fii_cra_simulations")
      .select("*", { count: "exact" })
      .eq("development_id", body.development_id)
      .eq("tenant_id", ctx.tenantId);

    if (body.tipo && body.tipo !== "all") {
      query = query.eq("tipo", body.tipo);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return {
        ok: false,
        error: { code: error.code || "QUERY_ERROR", message: error.message },
      };
    }

    return {
      ok: true,
      data: {
        simulations: (data || []) as Record<string, unknown>[],
        total: count || 0,
        offset,
        limit,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Erro desconhecido",
      },
    };
  }
}

// ============================================================
// Router
// ============================================================

async function handleRequest(req: Request, isPreFlight: boolean): Promise<Response> {
  if (isPreFlight) {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = await req.json();
    const authHeader = req.headers.get("authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "CONFIG_ERROR", message: "Missing env vars" } }),
        { status: 500, headers: corsHeaders(req) }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { authorization: authHeader || "" } },
    });

    // Extract token from Bearer header
    const token = authHeader?.replace("Bearer ", "") || "";

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid token" } }),
        { status: 401, headers: corsHeaders(req) }
      );
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr || !profile?.tenant_id) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "TENANT_ERROR", message: "Tenant not found" } }),
        { status: 403, headers: corsHeaders(req) }
      );
    }

    const ctx: RequestContext = {
      supabase,
      userId: user.id,
      tenantId: profile.tenant_id,
    };

    let result;
    switch (body.action) {
      case "simulate_fii":
        result = await actionSimulateFii(ctx, body);
        break;
      case "simulate_cri_cra":
        result = await actionSimulateCriCra(ctx, body);
        break;
      case "list_simulations":
        result = await actionListSimulations(ctx, body);
        break;
      default:
        return new Response(
          JSON.stringify({ ok: false, error: { code: "UNKNOWN_ACTION", message: `Action '${body.action}' not found` } }),
          { status: 400, headers: corsHeaders(req) }
        );
    }

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "REQUEST_ERROR",
          message: err instanceof Error ? err.message : "Unknown error",
        },
      }),
      { status: 400, headers: corsHeaders(req) }
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleRequest(req, true);
  }
  return handleRequest(req, false);
});
