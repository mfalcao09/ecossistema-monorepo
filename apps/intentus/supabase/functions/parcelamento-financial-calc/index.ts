/**
 * parcelamento-financial-calc v1
 *
 * Edge Function única (multi-action) que executa os cálculos financeiros
 * do módulo Parcelamento de Solo (Fase 5 — Bloco A).
 *
 * ACTIONS:
 *   simulate            — Calcula fluxo de caixa + KPIs a partir de um cenário.
 *                         Persiste resultado em development_parcelamento_financial
 *                         e development_parcelamento_cash_flow_rows.
 *   save_scenario       — Persiste (ou atualiza) premissas em
 *                         development_parcelamento_scenarios.
 *   get_financial       — Retorna o último resultado financeiro ativo.
 *   list_scenarios      — Lista todos os cenários ativos do development.
 *   run_monte_carlo     — Monte Carlo N iterações (VPL/TIR/Payback/Margem).
 *   compute_sensitivity — Análise de sensibilidade tornado chart (±variation_pct).
 *   compare_scenarios   — [STUB] Compara N cenários lado a lado.
 *   efficient_frontier  — [STUB] Fronteira eficiente risco × retorno.
 *
 * MATEMÁTICA FINANCEIRA (inline, sem dependências externas):
 *   - VPL (Valor Presente Líquido)
 *   - TIR (Taxa Interna de Retorno) via Newton-Raphson + bissecção como fallback
 *   - Payback simples e descontado
 *   - Amortização SAC e Price
 *   - WACC ponderado (equity + dívida)
 *
 * REGIME TRIBUTÁRIO:
 *   - Se patrimonio_afetacao=true e ret_ativo=true → aplica RET 4% (Lei 10.931/04)
 *   - Senão, usa aliquota_ir_pct do cenário (lucro presumido ~ 5.93%, real variável)
 *
 * PEDAGOGIA:
 *   A resposta inclui kpi_metadata com explicações didáticas de cada número
 *   para que o UI renderize tooltips e "por que isso importa".
 *
 * Sessão 124 — Fase 5 Bloco A Parcelamento de Solo
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS (padrão Intentus)
// ============================================================

const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o: string) => o.trim()).filter(Boolean);

const DEV_PATTERNS = [
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

interface Scenario {
  id: string;
  development_id: string;
  tenant_id: string;
  nome: string;
  prazo_obra_meses: number;
  prazo_comercializacao_meses: number;
  mes_inicio_vendas: number;
  preco_medio_lote: number | null;
  qtd_lotes: number | null;
  velocidade_vendas_pct_mes: number | null;
  inadimplencia_pct: number;
  taxa_desconto_anual_pct: number;
  indice_correcao_mensal_pct: number;
  wacc_pct: number | null;
  equity_pct: number;
  divida_pct: number;
  custo_divida_anual_pct: number;
  aliquota_ir_pct: number | null;
  entrada_pct: number;
  parcelas_qtd: number;
  balao_final_pct: number;
  regime_tributario: "lucro_real" | "lucro_presumido" | "ret_afetacao" | "nao_definido";
  patrimonio_afetacao: boolean;
  ret_ativo: boolean;
}

interface CashFlowRow {
  mes_numero: number;
  entrada_vendas: number;
  entrada_financiamento: number;
  entrada_outras: number;
  saida_terreno: number;
  saida_projeto: number;
  saida_infraestrutura: number;
  saida_legalizacao: number;
  saida_obras_comp: number;
  saida_marketing: number;
  saida_tributos: number;
  saida_administrativo: number;
  saida_contingencia: number;
  saida_financeiro: number;
}

interface CostItem {
  categoria: string;
  valor_total: number;
  mes_inicio: number | null;
  mes_fim: number | null;
}

interface KpiMetadata {
  [key: string]: {
    label: string;
    tooltip: string;
    warning?: string;
  };
}

// ============================================================
// Matemática financeira (pura)
// ============================================================

/** VPL — Valor Presente Líquido. rateMonthly já em decimal (ex: 0.01 = 1%/mês). */
function calcVPL(cashflows: number[], rateMonthly: number): number {
  let vpl = 0;
  for (let t = 0; t < cashflows.length; t++) {
    vpl += cashflows[t] / Math.pow(1 + rateMonthly, t);
  }
  return vpl;
}

/** TIR mensal via Newton-Raphson (com fallback para bissecção). Retorna decimal. */
function calcTIRMensal(cashflows: number[]): number | null {
  if (cashflows.length < 2) return null;
  const hasPositive = cashflows.some((c) => c > 0);
  const hasNegative = cashflows.some((c) => c < 0);
  if (!hasPositive || !hasNegative) return null; // TIR não existe

  // Newton-Raphson
  let rate = 0.01; // chute inicial 1%/mês
  const maxIter = 100;
  const tol = 1e-7;

  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const denom = Math.pow(1 + rate, t);
      npv += cashflows[t] / denom;
      dnpv += (-t * cashflows[t]) / (denom * (1 + rate));
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tol) return newRate;
    rate = newRate;
    if (rate < -0.99 || rate > 10) break; // divergiu
  }

  // Fallback: bissecção entre -0.99 e 10
  // FIX (Buchecha review): npvLo recalculado dentro do loop a cada iteração.
  let lo = -0.99;
  let hi = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = calcVPL(cashflows, mid);
    if (Math.abs(npvMid) < tol) return mid;
    const npvLo = calcVPL(cashflows, lo);
    if ((npvMid < 0 && npvLo < 0) || (npvMid > 0 && npvLo > 0)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Converte TIR mensal em anual: (1+r_m)^12 - 1 */
function tirMensalToAnual(rMensal: number): number {
  return Math.pow(1 + rMensal, 12) - 1;
}

/** Taxa anual → mensal equivalente: (1+r_a)^(1/12) - 1 */
function taxaAnualToMensal(rAnualPct: number): number {
  return Math.pow(1 + rAnualPct / 100, 1 / 12) - 1;
}

/** Payback simples: primeiro mês em que saldo acumulado fica ≥ 0. */
function calcPaybackSimples(cashflows: number[]): number | null {
  let acc = 0;
  for (let t = 0; t < cashflows.length; t++) {
    acc += cashflows[t];
    if (acc >= 0) return t;
  }
  return null;
}

/** Payback descontado: mesmo critério mas com VP dos fluxos. */
function calcPaybackDescontado(cashflows: number[], rateMonthly: number): number | null {
  let acc = 0;
  for (let t = 0; t < cashflows.length; t++) {
    acc += cashflows[t] / Math.pow(1 + rateMonthly, t);
    if (acc >= 0) return t;
  }
  return null;
}

/** WACC = (E/V)*Re + (D/V)*Rd*(1-T). Retorna pct anual. */
function calcWACC(
  equityPct: number,
  custoEquityAnualPct: number,
  dividaPct: number,
  custoDividaAnualPct: number,
  aliquotaIrPct: number
): number {
  // Validação defensiva (Buchecha review): NaN/negativos viram 0
  const safe = (n: number) => (Number.isFinite(n) && n >= 0 ? n : 0);
  const e = safe(equityPct) / 100;
  const d = safe(dividaPct) / 100;
  const re = safe(custoEquityAnualPct) / 100;
  const rd = safe(custoDividaAnualPct) / 100;
  const t = Math.min(1, Math.max(0, safe(aliquotaIrPct) / 100));
  return (e * re + d * rd * (1 - t)) * 100;
}

// ============================================================
// Distribuição temporal de custos (helper)
// ============================================================

/**
 * Distribui um custo total linearmente entre mes_inicio e mes_fim.
 * Se limites forem null, distribui ao longo de prazo_obra_meses a partir do mês 0.
 */
function distributeCost(
  totalValue: number,
  startMonth: number | null,
  endMonth: number | null,
  horizonMonths: number,
  prazoObraMeses: number
): number[] {
  const result = new Array(horizonMonths).fill(0);
  const s = startMonth ?? 0;
  const e = endMonth ?? Math.max(0, prazoObraMeses - 1);
  const nMonths = Math.max(1, e - s + 1);
  const perMonth = totalValue / nMonths;
  for (let m = s; m <= e && m < horizonMonths; m++) {
    if (m >= 0) result[m] += perMonth;
  }
  return result;
}

// ============================================================
// Simulação principal
// ============================================================

interface SimulationInput {
  scenario: Scenario;
  costItems: CostItem[];
  custoTerreno: number;
}

interface SimulationOutput {
  horizonMonths: number;
  rows: CashFlowRow[];
  vgvTotal: number;
  custoObraTotal: number;
  vpl: number;
  vplWacc: number | null;
  tirAnual: number | null;
  paybackMeses: number | null;
  paybackDescontadoMeses: number | null;
  margemLiquidaPct: number;
  waccCalculado: number;
  performanceScore: number;
  capitalStructure: Record<string, number>;
  kpiMetadata: KpiMetadata;
}

function runSimulation(input: SimulationInput): SimulationOutput {
  const { scenario, costItems, custoTerreno } = input;

  // Horizonte = obra + comercialização (ou máx 120 meses por segurança)
  const horizonMonths = Math.min(
    120,
    scenario.prazo_obra_meses + scenario.prazo_comercializacao_meses
  );

  // VGV
  const qtdLotes = scenario.qtd_lotes ?? 0;
  const precoMedio = scenario.preco_medio_lote ?? 0;
  const vgvBruto = qtdLotes * precoMedio;
  const inadimp = (scenario.inadimplencia_pct ?? 0) / 100;
  const vgvLiquido = vgvBruto * (1 - inadimp);

  // ==================
  // Entradas (vendas)
  // ==================
  // Modelo simplificado: vendas começam em `mes_inicio_vendas` e seguem
  // velocidade_vendas_pct_mes (% do VGV vendido por mês). Cada venda se
  // parcela em entrada_pct upfront + parcelas_qtd parcelas iguais + balão final.

  const velocidadeMes = (scenario.velocidade_vendas_pct_mes ?? 5) / 100;
  const entradaPct = (scenario.entrada_pct ?? 20) / 100;
  const balaoPct = (scenario.balao_final_pct ?? 0) / 100;
  const parcelasQtd = Math.max(1, scenario.parcelas_qtd ?? 60);

  // Validação (Buchecha review): se entrada+balão >= 1, não há parcelas mensais
  const restanteParcelado = Math.max(0, 1 - entradaPct - balaoPct);
  const meioParcela = restanteParcelado > 0 ? restanteParcelado / parcelasQtd : 0;

  const entradasMes = new Array(horizonMonths).fill(0);
  let vgvVendidoAcum = 0;

  for (let m = scenario.mes_inicio_vendas; m < horizonMonths; m++) {
    const restante = Math.max(0, vgvLiquido - vgvVendidoAcum);
    if (restante <= 0) break;
    const vendaMes = Math.min(restante, vgvLiquido * velocidadeMes);
    vgvVendidoAcum += vendaMes;

    // Entrada upfront neste mês
    entradasMes[m] += vendaMes * entradaPct;

    // Parcelas mensais (m+1 até m+parcelasQtd)
    // FIX (Buchecha review): se parcelas extrapolam o horizonte, agrega o
    // residual no último mês do horizonte para não perder receita silenciosamente.
    const lastInstallmentMonth = Math.min(m + parcelasQtd, horizonMonths - 1);
    const parcelasCabem = lastInstallmentMonth - m;
    for (let p = 1; p <= parcelasCabem; p++) {
      entradasMes[m + p] += vendaMes * meioParcela;
    }
    if (parcelasCabem < parcelasQtd && parcelasCabem >= 0) {
      const residualParcelas = vendaMes * meioParcela * (parcelasQtd - parcelasCabem);
      entradasMes[Math.max(m, lastInstallmentMonth)] += residualParcelas;
    }

    // Balão final (último mês do parcelamento)
    // FIX (Buchecha review): se balão extrapola, agrega no último mês do horizonte
    if (balaoPct > 0) {
      const balaoMonth = m + parcelasQtd;
      const balaoTarget = Math.min(balaoMonth, horizonMonths - 1);
      entradasMes[balaoTarget] += vendaMes * balaoPct;
    }
  }

  // ==================
  // Saídas (custos)
  // ==================

  let custoObraTotal = 0;
  const saidaProjeto = new Array(horizonMonths).fill(0);
  const saidaInfra = new Array(horizonMonths).fill(0);
  const saidaLegal = new Array(horizonMonths).fill(0);
  const saidaObras = new Array(horizonMonths).fill(0);
  const saidaMkt = new Array(horizonMonths).fill(0);
  const saidaAdm = new Array(horizonMonths).fill(0);
  const saidaContingencia = new Array(horizonMonths).fill(0);

  for (const item of costItems) {
    custoObraTotal += item.valor_total;
    const dist = distributeCost(
      item.valor_total,
      item.mes_inicio,
      item.mes_fim,
      horizonMonths,
      scenario.prazo_obra_meses
    );
    // Roteamento por categoria (categorias esperadas no seed Fase 5)
    const cat = (item.categoria || "").toLowerCase();
    let target = saidaObras;
    if (cat.includes("projeto")) target = saidaProjeto;
    else if (cat.includes("infra")) target = saidaInfra;
    else if (cat.includes("legal") || cat.includes("aprov")) target = saidaLegal;
    else if (cat.includes("mark") || cat.includes("comerc")) target = saidaMkt;
    else if (cat.includes("admin")) target = saidaAdm;
    else if (cat.includes("conting")) target = saidaContingencia;

    for (let m = 0; m < horizonMonths; m++) target[m] += dist[m];
  }

  // Terreno — saída única no mês 0
  const saidaTerreno = new Array(horizonMonths).fill(0);
  saidaTerreno[0] = custoTerreno;

  // Tributos sobre vendas (RET 4% ou IR do cenário)
  // SIMPLIFICAÇÃO IMPORTANTE (Buchecha review): a alíquota é aplicada sobre as
  // entradas brutas mensais, não sobre a base legal exata. RET (Lei 10.931/04)
  // tem regras de receita auferida e deduções; lucro presumido tem base de
  // presunção sobre receita bruta. Para o V1 do simulador, esta aproximação
  // serve como estimativa de caixa — o módulo legal/tributário detalhado virá
  // no Bloco B. Documentado em kpi_metadata.tributos.tooltip para o usuário.
  const saidaTributos = new Array(horizonMonths).fill(0);
  const aliquotaEfetiva = scenario.patrimonio_afetacao && scenario.ret_ativo
    ? 4.0
    : (scenario.aliquota_ir_pct ?? 5.93);
  for (let m = 0; m < horizonMonths; m++) {
    saidaTributos[m] = entradasMes[m] * (aliquotaEfetiva / 100);
  }

  // Financeiro — custo da dívida mensalizado sobre o saldo devedor (aprox. linear)
  const saidaFinanceiro = new Array(horizonMonths).fill(0);
  if (scenario.divida_pct > 0 && scenario.custo_divida_anual_pct > 0) {
    const valorDivida = custoObraTotal * (scenario.divida_pct / 100);
    const taxaMensal = taxaAnualToMensal(scenario.custo_divida_anual_pct);
    // Amortização SAC simplificada durante a obra
    const nParc = Math.max(1, scenario.prazo_obra_meses);
    const amort = valorDivida / nParc;
    let saldo = valorDivida;
    for (let m = 0; m < nParc && m < horizonMonths; m++) {
      const juros = saldo * taxaMensal;
      saidaFinanceiro[m] = juros + amort;
      saldo -= amort;
    }
  }

  // ==================
  // Monta rows
  // ==================
  const rows: CashFlowRow[] = [];
  for (let m = 0; m < horizonMonths; m++) {
    rows.push({
      mes_numero: m,
      entrada_vendas: entradasMes[m],
      entrada_financiamento: 0,
      entrada_outras: 0,
      saida_terreno: saidaTerreno[m],
      saida_projeto: saidaProjeto[m],
      saida_infraestrutura: saidaInfra[m],
      saida_legalizacao: saidaLegal[m],
      saida_obras_comp: saidaObras[m],
      saida_marketing: saidaMkt[m],
      saida_tributos: saidaTributos[m],
      saida_administrativo: saidaAdm[m],
      saida_contingencia: saidaContingencia[m],
      saida_financeiro: saidaFinanceiro[m],
    });
  }

  // ==================
  // Fluxo líquido (net cashflow por mês) para VPL/TIR
  // ==================
  const netCashflows = rows.map((r) =>
    (r.entrada_vendas + r.entrada_financiamento + r.entrada_outras) -
    (r.saida_terreno + r.saida_projeto + r.saida_infraestrutura +
      r.saida_legalizacao + r.saida_obras_comp + r.saida_marketing +
      r.saida_tributos + r.saida_administrativo + r.saida_contingencia +
      r.saida_financeiro)
  );

  // ==================
  // KPIs
  // ==================
  const taxaDescMensal = taxaAnualToMensal(scenario.taxa_desconto_anual_pct);
  const vpl = calcVPL(netCashflows, taxaDescMensal);

  // WACC calculado (ou usa o do cenário se já preenchido)
  const waccCalculado = scenario.wacc_pct ?? calcWACC(
    scenario.equity_pct,
    scenario.taxa_desconto_anual_pct, // custo equity = taxa desconto (simplificação)
    scenario.divida_pct,
    scenario.custo_divida_anual_pct,
    aliquotaEfetiva
  );
  const waccMensal = taxaAnualToMensal(waccCalculado);
  const vplWacc = calcVPL(netCashflows, waccMensal);

  const tirMensal = calcTIRMensal(netCashflows);
  const tirAnual = tirMensal !== null ? tirMensalToAnual(tirMensal) * 100 : null;

  const paybackMeses = calcPaybackSimples(netCashflows);
  const paybackDescontadoMeses = calcPaybackDescontado(netCashflows, taxaDescMensal);

  const custoTotal = custoObraTotal + custoTerreno;
  const lucroLiquido = vgvLiquido - custoTotal;
  const margemLiquidaPct = vgvLiquido > 0 ? (lucroLiquido / vgvLiquido) * 100 : 0;

  // Performance score (0–100): combinação ponderada de TIR, VPL, margem e payback
  let performanceScore = 0;
  if (tirAnual !== null) {
    const tirScore = Math.min(100, Math.max(0, (tirAnual / 30) * 100)); // 30%/ano = 100
    const vplScore = vpl > 0 ? Math.min(100, (vpl / (vgvLiquido * 0.15)) * 100) : 0;
    const margemScore = Math.min(100, Math.max(0, (margemLiquidaPct / 25) * 100));
    const paybackScore = paybackMeses !== null
      ? Math.min(100, Math.max(0, 100 - (paybackMeses / 36) * 100))
      : 0;
    performanceScore = (tirScore * 0.35 + vplScore * 0.25 + margemScore * 0.25 + paybackScore * 0.15);
  }

  const capitalStructure = {
    equity_pct: scenario.equity_pct,
    divida_pct: scenario.divida_pct,
    custo_equity_anual_pct: scenario.taxa_desconto_anual_pct,
    custo_divida_anual_pct: scenario.custo_divida_anual_pct,
    wacc_calculado_pct: waccCalculado,
  };

  const kpiMetadata: KpiMetadata = {
    vpl: {
      label: "Valor Presente Líquido",
      tooltip: `Soma de todos os fluxos futuros descontados a ${scenario.taxa_desconto_anual_pct}% ao ano. VPL > 0 indica que o projeto gera valor acima do custo de oportunidade.`,
    },
    vpl_wacc: {
      label: "VPL @ WACC",
      tooltip: `VPL descontado pelo custo médio ponderado de capital (WACC ${waccCalculado.toFixed(2)}% a.a.). Mais conservador se há dívida no projeto.`,
    },
    tir_anual: {
      label: "TIR Anual",
      tooltip: "Taxa interna de retorno anualizada. Representa o 'rendimento' efetivo do projeto. Compare com seu custo de capital.",
      warning: tirAnual !== null && tirAnual < scenario.taxa_desconto_anual_pct
        ? "TIR abaixo da taxa de desconto — projeto destrói valor"
        : undefined,
    },
    payback_meses: {
      label: "Payback Simples",
      tooltip: "Meses até o saldo acumulado ficar positivo (sem considerar valor do dinheiro no tempo).",
    },
    payback_descontado_meses: {
      label: "Payback Descontado",
      tooltip: "Meses até o saldo acumulado descontado ficar positivo. Mais realista que o payback simples.",
    },
    margem_liquida_pct: {
      label: "Margem Líquida",
      tooltip: "Lucro líquido sobre VGV líquido. Incorporação saudável costuma operar entre 15% e 25%.",
      warning: margemLiquidaPct < 10 ? "Margem abaixo do benchmark do mercado" : undefined,
    },
    performance_score: {
      label: "Score de Performance",
      tooltip: "Índice composto 0–100 (TIR 35%, VPL 25%, Margem 25%, Payback 15%). Ajuda a comparar cenários rapidamente.",
    },
    tributos: {
      label: `Tributos (${aliquotaEfetiva.toFixed(2)}%)`,
      tooltip: scenario.patrimonio_afetacao && scenario.ret_ativo
        ? "Regime RET 4% (Lei 10.931/04 — patrimônio de afetação). SIMULAÇÃO V1: alíquota aplicada sobre entradas mensais brutas. A base legal exata considera receita auferida e deduções (custo do terreno, construção, comercialização) — refinamento virá no Bloco B."
        : "Lucro presumido aproximado. SIMULAÇÃO V1: alíquota aplicada sobre entradas mensais brutas. A base real depende do regime tributário, presunção e adições/exclusões IRPJ/CSLL — refinamento virá no Bloco B.",
      warning: "Estimativa de caixa, não cálculo fiscal exato.",
    },
  };

  return {
    horizonMonths,
    rows,
    vgvTotal: vgvLiquido,
    custoObraTotal,
    vpl,
    vplWacc,
    tirAnual,
    paybackMeses,
    paybackDescontadoMeses,
    margemLiquidaPct,
    waccCalculado,
    performanceScore,
    capitalStructure,
    kpiMetadata,
  };
}

// ============================================================
// Monte Carlo (análise probabilística)
// ============================================================

/**
 * Amostra de distribuição triangular.
 * min/max = limites absolutos, mode = valor mais provável.
 * Fórmula: inverse CDF da triangular.
 */
function sampleTriangular(min: number, mode: number, max: number): number {
  if (min >= max) return mode;
  const u = Math.random();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

/** Percentil via interpolação linear (estilo numpy.percentile). */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  if (sortedArr.length === 1) return sortedArr[0];
  const idx = (p / 100) * (sortedArr.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  const frac = idx - lo;
  return sortedArr[lo] * (1 - frac) + sortedArr[hi] * frac;
}

/** Média aritmética. */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (const v of arr) sum += v;
  return sum / arr.length;
}

/** Desvio padrão amostral (n-1). */
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let acc = 0;
  for (const v of arr) acc += (v - m) ** 2;
  return Math.sqrt(acc / (arr.length - 1));
}

/** Histograma de N buckets entre min e max do array. */
function histogram(arr: number[], buckets: number): Array<{ bin_start: number; bin_end: number; count: number }> {
  if (arr.length === 0 || buckets <= 0) return [];
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  if (min === max) {
    return [{ bin_start: min, bin_end: max, count: arr.length }];
  }
  const width = (max - min) / buckets;
  const bins = new Array(buckets).fill(0);
  for (const v of arr) {
    let idx = Math.floor((v - min) / width);
    if (idx >= buckets) idx = buckets - 1;
    if (idx < 0) idx = 0;
    bins[idx]++;
  }
  return bins.map((count, i) => ({
    bin_start: min + i * width,
    bin_end: min + (i + 1) * width,
    count,
  }));
}

interface MonteCarloConfig {
  iterations: number;
  vgv_variation_pct: number;        // ±pct no preço médio do lote
  custo_variation_pct: number;      // ±pct no custo total de obra
  velocidade_variation_pct: number; // ±pct na velocidade de vendas
}

interface MonteCarloResult {
  iterations: number;
  config: MonteCarloConfig;
  vpl: {
    mean: number;
    std: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
    prob_positive: number;
    histogram: Array<{ bin_start: number; bin_end: number; count: number }>;
  };
  tir_anual: {
    mean: number;
    std: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
    prob_above_desconto: number;
    histogram: Array<{ bin_start: number; bin_end: number; count: number }>;
  };
  payback_meses: {
    mean: number;
    p50: number;
    p95: number;
  };
  margem_liquida_pct: {
    mean: number;
    p5: number;
    p50: number;
    p95: number;
  };
  elapsed_ms: number;
}

function runMonteCarlo(
  baseScenario: Scenario,
  baseCostItems: CostItem[],
  custoTerreno: number,
  config: MonteCarloConfig
): MonteCarloResult {
  const t0 = Date.now();
  const vplResults: number[] = [];
  const tirResults: number[] = [];
  const paybackResults: number[] = [];
  const margemResults: number[] = [];

  const vgvVar = config.vgv_variation_pct / 100;
  const custoVar = config.custo_variation_pct / 100;
  const velVar = config.velocidade_variation_pct / 100;

  const basePreco = baseScenario.preco_medio_lote ?? 0;
  const baseVelocidade = baseScenario.velocidade_vendas_pct_mes ?? 5;

  for (let i = 0; i < config.iterations; i++) {
    // Multiplicadores triangulares (mode=1, ou seja, mais provável fica no valor base)
    const mVgv = sampleTriangular(1 - vgvVar, 1, 1 + vgvVar);
    const mCusto = sampleTriangular(1 - custoVar, 1, 1 + custoVar);
    const mVel = sampleTriangular(1 - velVar, 1, 1 + velVar);

    const iterScenario: Scenario = {
      ...baseScenario,
      preco_medio_lote: basePreco * mVgv,
      velocidade_vendas_pct_mes: baseVelocidade * mVel,
    };

    const iterCostItems: CostItem[] = baseCostItems.map((c) => ({
      ...c,
      valor_total: c.valor_total * mCusto,
    }));

    const sim = runSimulation({
      scenario: iterScenario,
      costItems: iterCostItems,
      custoTerreno: custoTerreno * mCusto, // terreno também varia
    });

    vplResults.push(sim.vpl);
    if (sim.tirAnual !== null && Number.isFinite(sim.tirAnual)) {
      tirResults.push(sim.tirAnual);
    }
    if (sim.paybackMeses !== null) {
      paybackResults.push(sim.paybackMeses);
    }
    margemResults.push(sim.margemLiquidaPct);
  }

  const vplSorted = [...vplResults].sort((a, b) => a - b);
  const tirSorted = [...tirResults].sort((a, b) => a - b);
  const paybackSorted = [...paybackResults].sort((a, b) => a - b);
  const margemSorted = [...margemResults].sort((a, b) => a - b);

  const vplPositivos = vplResults.filter((v) => v > 0).length;
  const tirAcimaDesconto = tirResults.filter((t) => t > baseScenario.taxa_desconto_anual_pct).length;

  return {
    iterations: config.iterations,
    config,
    vpl: {
      mean: mean(vplResults),
      std: stdDev(vplResults),
      p5: percentile(vplSorted, 5),
      p25: percentile(vplSorted, 25),
      p50: percentile(vplSorted, 50),
      p75: percentile(vplSorted, 75),
      p95: percentile(vplSorted, 95),
      prob_positive: vplResults.length > 0 ? vplPositivos / vplResults.length : 0,
      histogram: histogram(vplResults, 20),
    },
    tir_anual: {
      mean: tirResults.length > 0 ? mean(tirResults) : 0,
      std: stdDev(tirResults),
      p5: percentile(tirSorted, 5),
      p25: percentile(tirSorted, 25),
      p50: percentile(tirSorted, 50),
      p75: percentile(tirSorted, 75),
      p95: percentile(tirSorted, 95),
      prob_above_desconto: tirResults.length > 0 ? tirAcimaDesconto / tirResults.length : 0,
      histogram: histogram(tirResults, 20),
    },
    payback_meses: {
      mean: paybackResults.length > 0 ? mean(paybackResults) : 0,
      p50: percentile(paybackSorted, 50),
      p95: percentile(paybackSorted, 95),
    },
    margem_liquida_pct: {
      mean: mean(margemResults),
      p5: percentile(margemSorted, 5),
      p50: percentile(margemSorted, 50),
      p95: percentile(margemSorted, 95),
    },
    elapsed_ms: Date.now() - t0,
  };
}

// ============================================================
// Análise de Sensibilidade (Tornado Chart)
// ============================================================

/**
 * Lista de premissas suportadas pela análise de sensibilidade.
 * Cada uma é variada UMA POR VEZ mantendo todas as outras no valor base.
 * Isso isola a elasticidade de cada variável sobre os KPIs — diferente do
 * Monte Carlo que varia tudo simultaneamente.
 *
 * TIPO DE VARIAÇÃO (Buchecha review — prática padrão em tornado charts):
 *   - MULTIPLICATIVE: variáveis de valor absoluto (preço, custo, quantidade
 *     contínua) — varia em ±variation_pct do valor base.
 *     Ex: preco=1000, var=10% → low=900, high=1100.
 *   - ADDITIVE_PP: variáveis que JÁ são taxas em % — varia em ±variation_pp
 *     pontos percentuais absolutos (NÃO multiplicativo, senão base=0 quebra).
 *     Ex: inadimplencia=5%, variation_pp=2 → low=3%, high=7%.
 *   - INTEGER: variáveis inteiras (qtd_lotes, parcelas_qtd) — tenta variar
 *     multiplicativo mas SKIPS se |base * variation_pct| < 0.5 pra não
 *     distorcer o ranking do tornado com ruído de arredondamento.
 */
type SensitivityVariable =
  | "preco_medio_lote"
  | "qtd_lotes"
  | "velocidade_vendas_pct_mes"
  | "inadimplencia_pct"
  | "entrada_pct"
  | "parcelas_qtd"
  | "taxa_desconto_anual_pct"
  | "custo_divida_anual_pct"
  | "custos_obra_total"
  | "custo_terreno";

type VariationType = "MULTIPLICATIVE" | "ADDITIVE_PP" | "INTEGER";

const SENSITIVITY_META: Record<
  SensitivityVariable,
  { label: string; type: VariationType }
> = {
  preco_medio_lote: { label: "Preço médio do lote", type: "MULTIPLICATIVE" },
  qtd_lotes: { label: "Quantidade de lotes", type: "INTEGER" },
  velocidade_vendas_pct_mes: { label: "Velocidade de vendas (%/mês)", type: "MULTIPLICATIVE" },
  inadimplencia_pct: { label: "Inadimplência (pp)", type: "ADDITIVE_PP" },
  entrada_pct: { label: "Entrada (pp)", type: "ADDITIVE_PP" },
  parcelas_qtd: { label: "Quantidade de parcelas", type: "INTEGER" },
  taxa_desconto_anual_pct: { label: "Taxa de desconto anual (pp)", type: "ADDITIVE_PP" },
  custo_divida_anual_pct: { label: "Custo da dívida anual (pp)", type: "ADDITIVE_PP" },
  custos_obra_total: { label: "Custos de obra (total)", type: "MULTIPLICATIVE" },
  custo_terreno: { label: "Custo do terreno", type: "MULTIPLICATIVE" },
};

interface SensitivityConfig {
  variation_pct: number;   // ±pct para MULTIPLICATIVE/INTEGER (default 10)
  variation_pp: number;    // ±pontos percentuais para ADDITIVE_PP (default 2)
  variables?: SensitivityVariable[]; // subset opcional; default = todas
}

interface SensitivityBarKpi {
  base: number | null;
  low: number | null;    // KPI quando variável é reduzida (-variation_pct)
  high: number | null;   // KPI quando variável é aumentada (+variation_pct)
  delta_low: number | null;   // low - base
  delta_high: number | null;  // high - base
  impact_range: number;       // |high - low| — magnitude no tornado chart
}

interface SensitivityBar {
  variable: SensitivityVariable;
  label: string;
  variation_type: VariationType;
  base_value: number;
  low_value: number;   // valor numérico da variável no cenário low
  high_value: number;  // valor numérico da variável no cenário high
  vpl: SensitivityBarKpi;
  tir_anual: SensitivityBarKpi;
  payback_meses: SensitivityBarKpi;
  margem_liquida_pct: SensitivityBarKpi;
  skipped?: boolean;
  skip_reason?: string;
}

interface SensitivityResult {
  config: SensitivityConfig;
  baseline: {
    vpl: number;
    tir_anual: number | null;
    payback_meses: number | null;
    margem_liquida_pct: number;
  };
  bars: SensitivityBar[];              // ordem original (ordem das variáveis)
  tornado_by_vpl: SensitivityBar[];    // ordenado por |impact_range| do VPL desc
  tornado_by_tir: SensitivityBar[];    // ordenado por |impact_range| da TIR desc
  elapsed_ms: number;
}

/**
 * Calcula o valor variado da premissa com base no tipo de variação.
 *
 *   - MULTIPLICATIVE: baseValue * (1 ± variation_pct/100)
 *   - ADDITIVE_PP:    baseValue ± variation_pp
 *   - INTEGER:        baseValue * (1 ± variation_pct/100), arredondado + clamp mínimo 1
 *
 * Retorna também a flag `skipped` para INTEGER quando o delta é menor que 1
 * (aritmeticamente não há variação — evita bar "chata" no tornado).
 */
function computeVariedValue(
  baseValue: number,
  type: VariationType,
  direction: "low" | "high",
  config: SensitivityConfig
): { value: number; skipped: boolean; skipReason?: string } {
  const sign = direction === "low" ? -1 : 1;

  if (type === "MULTIPLICATIVE") {
    const factor = 1 + sign * (config.variation_pct / 100);
    return { value: baseValue * factor, skipped: false };
  }

  if (type === "ADDITIVE_PP") {
    // Taxas em %: soma/subtrai pontos percentuais e clampa [0, 100]
    const next = baseValue + sign * config.variation_pp;
    return { value: Math.min(100, Math.max(0, next)), skipped: false };
  }

  // INTEGER
  const rawDelta = baseValue * (config.variation_pct / 100);
  if (Math.abs(rawDelta) < 0.5) {
    // Delta arredondaria pra 0 → variação imperceptível, skip
    return {
      value: baseValue,
      skipped: true,
      skipReason: `Variação ±${config.variation_pct}% sobre base=${baseValue} resulta em delta < 1 (arredondamento).`,
    };
  }
  const next = Math.max(1, Math.round(baseValue + sign * rawDelta));
  return { value: next, skipped: false };
}

/**
 * Aplica um valor específico a UMA variável do cenário (ou ao array de custos/terreno)
 * e roda a simulação. Retorna os KPIs. As outras variáveis ficam intactas.
 */
function simulateWithValue(
  baseScenario: Scenario,
  baseCostItems: CostItem[],
  baseCustoTerreno: number,
  variable: SensitivityVariable,
  value: number
): { vpl: number; tir_anual: number | null; payback_meses: number | null; margem_liquida_pct: number } {
  const scenario: Scenario = { ...baseScenario };
  let costItems = baseCostItems;
  let custoTerreno = baseCustoTerreno;
  const baseCustoObraTotal = baseCostItems.reduce((acc, c) => acc + c.valor_total, 0);

  switch (variable) {
    case "preco_medio_lote":
      scenario.preco_medio_lote = value;
      break;
    case "qtd_lotes":
      scenario.qtd_lotes = Math.max(1, Math.round(value));
      break;
    case "velocidade_vendas_pct_mes":
      scenario.velocidade_vendas_pct_mes = value;
      break;
    case "inadimplencia_pct":
      scenario.inadimplencia_pct = Math.min(100, Math.max(0, value));
      break;
    case "entrada_pct":
      scenario.entrada_pct = Math.min(100, Math.max(0, value));
      break;
    case "parcelas_qtd":
      scenario.parcelas_qtd = Math.max(1, Math.round(value));
      break;
    case "taxa_desconto_anual_pct":
      scenario.taxa_desconto_anual_pct = Math.max(0, value);
      break;
    case "custo_divida_anual_pct":
      scenario.custo_divida_anual_pct = Math.max(0, value);
      break;
    case "custos_obra_total": {
      // Escala proporcional: value é o NOVO total; baseCustoObraTotal é o total atual.
      const factor = baseCustoObraTotal > 0 ? value / baseCustoObraTotal : 1;
      costItems = baseCostItems.map((c) => ({ ...c, valor_total: c.valor_total * factor }));
      break;
    }
    case "custo_terreno":
      custoTerreno = Math.max(0, value);
      break;
  }

  const sim = runSimulation({ scenario, costItems, custoTerreno });
  return {
    vpl: sim.vpl,
    tir_anual: sim.tirAnual,
    payback_meses: sim.paybackMeses,
    margem_liquida_pct: sim.margemLiquidaPct,
  };
}

/** Pega o valor base (numérico) da variável no cenário — usado para reportar low/high absolutos. */
function getBaseValue(
  scenario: Scenario,
  baseCustoObraTotal: number,
  custoTerreno: number,
  variable: SensitivityVariable
): number {
  switch (variable) {
    case "preco_medio_lote": return scenario.preco_medio_lote ?? 0;
    case "qtd_lotes": return scenario.qtd_lotes ?? 0;
    case "velocidade_vendas_pct_mes": return scenario.velocidade_vendas_pct_mes ?? 5;
    case "inadimplencia_pct": return scenario.inadimplencia_pct;
    case "entrada_pct": return scenario.entrada_pct;
    case "parcelas_qtd": return scenario.parcelas_qtd;
    case "taxa_desconto_anual_pct": return scenario.taxa_desconto_anual_pct;
    case "custo_divida_anual_pct": return scenario.custo_divida_anual_pct;
    case "custos_obra_total": return baseCustoObraTotal;
    case "custo_terreno": return custoTerreno;
  }
}

/** Constrói o SensitivityBarKpi a partir dos KPIs base/low/high. */
function buildBarKpi(
  base: number | null,
  low: number | null,
  high: number | null
): SensitivityBarKpi {
  const deltaLow = base !== null && low !== null ? low - base : null;
  const deltaHigh = base !== null && high !== null ? high - base : null;
  // impact_range nunca é null — se algum lado for null, usa 0 como neutro pra ordenação
  const lowVal = low ?? base ?? 0;
  const highVal = high ?? base ?? 0;
  const impactRange = Math.abs(highVal - lowVal);
  return { base, low, high, delta_low: deltaLow, delta_high: deltaHigh, impact_range: impactRange };
}

function computeSensitivity(
  baseScenario: Scenario,
  baseCostItems: CostItem[],
  custoTerreno: number,
  config: SensitivityConfig
): SensitivityResult {
  const t0 = Date.now();

  // Baseline (uma vez só)
  const baseSim = runSimulation({
    scenario: baseScenario,
    costItems: baseCostItems,
    custoTerreno,
  });

  const baseCustoObraTotal = baseCostItems.reduce((acc, c) => acc + c.valor_total, 0);

  const variables: SensitivityVariable[] = config.variables && config.variables.length > 0
    ? config.variables
    : (Object.keys(SENSITIVITY_META) as SensitivityVariable[]);

  const bars: SensitivityBar[] = [];

  for (const variable of variables) {
    const meta = SENSITIVITY_META[variable];
    const baseValue = getBaseValue(baseScenario, baseCustoObraTotal, custoTerreno, variable);

    const low = computeVariedValue(baseValue, meta.type, "low", config);
    const high = computeVariedValue(baseValue, meta.type, "high", config);

    // Se ambos os lados skipped → bar informativa sem simular
    if (low.skipped && high.skipped) {
      bars.push({
        variable,
        label: meta.label,
        variation_type: meta.type,
        base_value: baseValue,
        low_value: baseValue,
        high_value: baseValue,
        vpl: buildBarKpi(baseSim.vpl, baseSim.vpl, baseSim.vpl),
        tir_anual: buildBarKpi(baseSim.tirAnual, baseSim.tirAnual, baseSim.tirAnual),
        payback_meses: buildBarKpi(baseSim.paybackMeses, baseSim.paybackMeses, baseSim.paybackMeses),
        margem_liquida_pct: buildBarKpi(baseSim.margemLiquidaPct, baseSim.margemLiquidaPct, baseSim.margemLiquidaPct),
        skipped: true,
        skip_reason: low.skipReason ?? high.skipReason,
      });
      continue;
    }

    const lowSim = simulateWithValue(baseScenario, baseCostItems, custoTerreno, variable, low.value);
    const highSim = simulateWithValue(baseScenario, baseCostItems, custoTerreno, variable, high.value);

    bars.push({
      variable,
      label: meta.label,
      variation_type: meta.type,
      base_value: baseValue,
      low_value: low.value,
      high_value: high.value,
      vpl: buildBarKpi(baseSim.vpl, lowSim.vpl, highSim.vpl),
      tir_anual: buildBarKpi(baseSim.tirAnual, lowSim.tir_anual, highSim.tir_anual),
      payback_meses: buildBarKpi(baseSim.paybackMeses, lowSim.payback_meses, highSim.payback_meses),
      margem_liquida_pct: buildBarKpi(baseSim.margemLiquidaPct, lowSim.margem_liquida_pct, highSim.margem_liquida_pct),
    });
  }

  // Tornado charts: ordenados por magnitude desc (maior impacto no topo)
  // Skipped bars ficam no fim (impact_range = 0)
  const tornadoByVpl = [...bars].sort((a, b) => b.vpl.impact_range - a.vpl.impact_range);
  const tornadoByTir = [...bars].sort((a, b) => b.tir_anual.impact_range - a.tir_anual.impact_range);

  return {
    config,
    baseline: {
      vpl: baseSim.vpl,
      tir_anual: baseSim.tirAnual,
      payback_meses: baseSim.paybackMeses,
      margem_liquida_pct: baseSim.margemLiquidaPct,
    },
    bars,
    tornado_by_vpl: tornadoByVpl,
    tornado_by_tir: tornadoByTir,
    elapsed_ms: Date.now() - t0,
  };
}

// ============================================================
// Fronteira Eficiente (Risco × Retorno)
// ============================================================

/**
 * A "fronteira eficiente" no contexto de incorporação imobiliária varia a
 * estrutura de capital (mix equity × dívida) e mede como cada combinação
 * impacta retorno e custo de capital.
 *
 * - Eixo X (custo/risco): WACC calculado (quanto menor, melhor)
 * - Eixo Y (retorno):     VPL @ WACC e TIR anual (frontend escolhe qual plotar)
 *
 * Um ponto é "Pareto-eficiente" se NENHUM outro ponto tem ao mesmo tempo:
 *   maior_retorno  AND  menor_ou_igual_wacc
 *
 * Pontos dominados ficam visíveis na curva mas marcados como `dominated:true`.
 * Pontos com alavancagem irrealista (divida_pct > realistic_max_divida_pct,
 * default 85%) são marcados como `realistic:false` — em incorporação, LTV
 * bancário típico é 70-85%, então 100% dívida é matematicamente possível mas
 * impraticável. O frontend tipicamente desenha a fronteira ligando apenas os
 * pontos não-dominados E realistas.
 *
 * LIMITAÇÃO CONHECIDA (Buchecha review): este modelo mantém o custo do equity
 * CONSTANTE conforme a alavancagem aumenta. A teoria do trade-off (Modigliani-
 * Miller com risco de default) prevê que custo_equity sobe com mais dívida,
 * compensando parte do tax shield. Aqui, mais dívida sempre reduz WACC — se
 * for um ponto-chave de decisão, considere variar custo_divida_anual_pct ou
 * taxa_desconto_anual_pct manualmente para simular esse efeito.
 */
interface EfficientFrontierConfig {
  equity_min_pct: number;          // padrão 0
  equity_max_pct: number;          // padrão 100
  step_pct: number;                // padrão 10 → 11 pontos
  realistic_max_divida_pct: number; // padrão 85 — pontos acima são marcados como irrealistas
}

interface EfficientFrontierPoint {
  equity_pct: number;
  divida_pct: number;
  vpl: number;
  vpl_wacc: number | null;
  tir_anual: number | null;
  payback_meses: number | null;
  margem_liquida_pct: number;
  wacc_pct: number;
  performance_score: number;
  dominated: boolean;       // true se outro ponto domina (>= retorno @ <= wacc)
  realistic: boolean;       // false se divida_pct > realistic_max_divida_pct
}

interface EfficientFrontierResult {
  config: EfficientFrontierConfig;
  points: EfficientFrontierPoint[];
  optimal: {
    // Considera TODOS os pontos (mesmo irrealistas)
    by_vpl_wacc: EfficientFrontierPoint | null;     // maior VPL @ WACC
    by_tir: EfficientFrontierPoint | null;          // maior TIR anual
    by_min_wacc: EfficientFrontierPoint | null;     // menor WACC
    by_performance_score: EfficientFrontierPoint | null; // maior score consolidado
  };
  optimal_realistic: {
    // Mesmo, mas restrito a divida_pct ≤ realistic_max_divida_pct
    by_vpl_wacc: EfficientFrontierPoint | null;
    by_tir: EfficientFrontierPoint | null;
    by_min_wacc: EfficientFrontierPoint | null;
    by_performance_score: EfficientFrontierPoint | null;
  };
  elapsed_ms: number;
}

/** Roda a simulação substituindo equity_pct/divida_pct (que sempre somam 100). */
function simulateWithCapitalStructure(
  baseScenario: Scenario,
  baseCostItems: CostItem[],
  custoTerreno: number,
  equityPct: number
): SimulationOutput {
  const equity = Math.min(100, Math.max(0, equityPct));
  const divida = 100 - equity;
  const scenario: Scenario = {
    ...baseScenario,
    equity_pct: equity,
    divida_pct: divida,
    // Limpa wacc_pct fixo pra forçar recalculo via calcWACC()
    wacc_pct: null,
  };
  return runSimulation({ scenario, costItems: baseCostItems, custoTerreno });
}

/**
 * Marca pontos dominados. Definição Pareto:
 *   p é dominado ⇔ ∃ q ≠ p tal que (q.vpl_wacc ≥ p.vpl_wacc) ∧ (q.wacc ≤ p.wacc)
 *                                    ∧ (q.vpl_wacc > p.vpl_wacc ∨ q.wacc < p.wacc)
 * O(n²) — n máx ~ 21 pontos, irrelevante.
 */
function markDominated(points: EfficientFrontierPoint[]): void {
  for (const p of points) {
    const pRet = p.vpl_wacc ?? p.vpl;
    let dominated = false;
    for (const q of points) {
      if (q === p) continue;
      const qRet = q.vpl_wacc ?? q.vpl;
      const better = qRet >= pRet && q.wacc_pct <= p.wacc_pct;
      const strict = qRet > pRet || q.wacc_pct < p.wacc_pct;
      if (better && strict) {
        dominated = true;
        break;
      }
    }
    p.dominated = dominated;
  }
}

function pickOptimal(pts: EfficientFrontierPoint[]): EfficientFrontierResult["optimal"] {
  if (pts.length === 0) return { by_vpl_wacc: null, by_tir: null, by_min_wacc: null, by_performance_score: null };
  return {
    by_vpl_wacc: [...pts].sort((a, b) => (b.vpl_wacc ?? -Infinity) - (a.vpl_wacc ?? -Infinity))[0] ?? null,
    by_tir: [...pts].sort((a, b) => (b.tir_anual ?? -Infinity) - (a.tir_anual ?? -Infinity))[0] ?? null,
    by_min_wacc: [...pts].sort((a, b) => a.wacc_pct - b.wacc_pct)[0] ?? null,
    by_performance_score: [...pts].sort((a, b) => b.performance_score - a.performance_score)[0] ?? null,
  };
}

function runEfficientFrontier(
  baseScenario: Scenario,
  baseCostItems: CostItem[],
  custoTerreno: number,
  config: EfficientFrontierConfig
): EfficientFrontierResult {
  const t0 = Date.now();
  const points: EfficientFrontierPoint[] = [];

  const min = Math.min(100, Math.max(0, config.equity_min_pct));
  const max = Math.min(100, Math.max(min, config.equity_max_pct));
  const step = Math.max(1, config.step_pct);
  const realisticMaxDivida = config.realistic_max_divida_pct;

  for (let eq = min; eq <= max + 1e-9; eq += step) {
    const equityPct = Math.min(max, eq);
    const dividaPct = 100 - equityPct;
    const sim = simulateWithCapitalStructure(
      baseScenario,
      baseCostItems,
      custoTerreno,
      equityPct
    );
    points.push({
      equity_pct: equityPct,
      divida_pct: dividaPct,
      vpl: sim.vpl,
      vpl_wacc: sim.vplWacc,
      tir_anual: sim.tirAnual,
      payback_meses: sim.paybackMeses,
      margem_liquida_pct: sim.margemLiquidaPct,
      wacc_pct: sim.waccCalculado,
      performance_score: sim.performanceScore,
      dominated: false,
      realistic: dividaPct <= realisticMaxDivida,
    });
  }

  markDominated(points);

  const realisticPoints = points.filter((p) => p.realistic);

  return {
    config: { equity_min_pct: min, equity_max_pct: max, step_pct: step, realistic_max_divida_pct: realisticMaxDivida },
    points,
    optimal: pickOptimal(points),
    optimal_realistic: pickOptimal(realisticPoints),
    elapsed_ms: Date.now() - t0,
  };
}

// ============================================================
// Persistência
// ============================================================

async function persistSimulation(
  supabase: SupabaseClient,
  scenario: Scenario,
  sim: SimulationOutput,
  userId: string,
  scenarioType: "otimista" | "realista" | "pessimista" = "realista"
): Promise<{ financial_id: string }> {
  // 1) Soft-delete previous active financials for this scenario
  await supabase
    .from("development_parcelamento_financial")
    .update({ is_active: false })
    .eq("development_id", scenario.development_id)
    .eq("is_active", true);

  // 2) Determina próxima versão
  const { data: lastVer } = await supabase
    .from("development_parcelamento_financial")
    .select("version")
    .eq("development_id", scenario.development_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((lastVer?.version as number) ?? 0) + 1;

  // 3) Insere financial header
  const { data: fin, error: finErr } = await supabase
    .from("development_parcelamento_financial")
    .insert({
      development_id: scenario.development_id,
      tenant_id: scenario.tenant_id,
      version: nextVersion,
      vgv_total: sim.vgvTotal,
      custo_obra_total: sim.custoObraTotal,
      prazo_obra_meses: scenario.prazo_obra_meses,
      vpl: sim.vpl,
      vpl_wacc: sim.vplWacc,
      tir_anual: sim.tirAnual,
      payback_meses: sim.paybackMeses,
      payback_descontado_meses: sim.paybackDescontadoMeses,
      margem_liquida_pct: sim.margemLiquidaPct,
      wacc_pct: sim.waccCalculado,
      performance_score: sim.performanceScore,
      capital_structure: sim.capitalStructure,
      kpi_metadata: sim.kpiMetadata,
      scenario_type: scenarioType,
      scenario_label: scenario.nome,
      is_calculated: true,
      calculated_at: new Date().toISOString(),
      created_by: userId,
      is_active: true,
    })
    .select("id")
    .maybeSingle();

  if (finErr || !fin) {
    throw new Error(`Failed to persist financial: ${finErr?.message}`);
  }

  const financialId = fin.id as string;

  // 4) Insere cash flow rows em batch
  const cashFlowRows = sim.rows.map((r) => ({
    scenario_id: scenario.id,
    financial_id: financialId,
    tenant_id: scenario.tenant_id,
    mes_numero: r.mes_numero,
    entrada_vendas: r.entrada_vendas,
    entrada_financiamento: r.entrada_financiamento,
    entrada_outras: r.entrada_outras,
    saida_terreno: r.saida_terreno,
    saida_projeto: r.saida_projeto,
    saida_infraestrutura: r.saida_infraestrutura,
    saida_legalizacao: r.saida_legalizacao,
    saida_obras_comp: r.saida_obras_comp,
    saida_marketing: r.saida_marketing,
    saida_tributos: r.saida_tributos,
    saida_administrativo: r.saida_administrativo,
    saida_contingencia: r.saida_contingencia,
    saida_financeiro: r.saida_financeiro,
  }));

  const { error: cfErr } = await supabase
    .from("development_parcelamento_cash_flow_rows")
    .insert(cashFlowRows);

  if (cfErr) {
    console.error("Cash flow insert error:", cfErr);
    // Não falha a request — header já foi salvo
  }

  return { financial_id: financialId };
}

// ============================================================
// Handler
// ============================================================

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const action = (body.action as string) || "simulate";

  try {
    // ────────────────────────
    // ACTION: list_scenarios
    // ────────────────────────
    if (action === "list_scenarios") {
      const { development_id } = body as { development_id: string };
      if (!development_id) throw new Error("development_id required");

      const { data, error } = await supabase
        .from("development_parcelamento_scenarios")
        .select("*")
        .eq("development_id", development_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ────────────────────────
    // ACTION: save_scenario
    // ────────────────────────
    if (action === "save_scenario") {
      const payload = body.scenario as Partial<Scenario>;
      if (!payload?.development_id || !payload?.nome) {
        throw new Error("scenario.development_id and scenario.nome required");
      }

      const insertRow = {
        ...payload,
        created_by: user.id,
        is_active: true,
      };

      const { data, error } = await supabase
        .from("development_parcelamento_scenarios")
        .insert(insertRow)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ────────────────────────
    // ACTION: get_financial
    // ────────────────────────
    if (action === "get_financial") {
      const { development_id } = body as { development_id: string };
      if (!development_id) throw new Error("development_id required");

      const { data: fin, error: finErr } = await supabase
        .from("development_parcelamento_financial")
        .select("*")
        .eq("development_id", development_id)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (finErr) throw finErr;
      if (!fin) {
        return new Response(JSON.stringify({ data: null }), {
          status: 200, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: rows, error: rowsErr } = await supabase
        .from("development_parcelamento_cash_flow_rows")
        .select("*")
        .eq("financial_id", fin.id)
        .order("mes_numero", { ascending: true });

      if (rowsErr) throw rowsErr;
      return new Response(JSON.stringify({ data: { financial: fin, cash_flow: rows } }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ────────────────────────
    // ACTION: simulate
    // ────────────────────────
    if (action === "simulate") {
      const { scenario_id, scenario_type } = body as {
        scenario_id: string;
        scenario_type?: "otimista" | "realista" | "pessimista";
      };
      if (!scenario_id) throw new Error("scenario_id required");

      // Load scenario
      const { data: scenario, error: scErr } = await supabase
        .from("development_parcelamento_scenarios")
        .select("*")
        .eq("id", scenario_id)
        .maybeSingle();

      if (scErr || !scenario) throw new Error(scErr?.message ?? "Scenario not found");

      // Load cost items
      const { data: costItems } = await supabase
        .from("development_parcelamento_cost_items")
        .select("categoria, valor_total, mes_inicio, mes_fim")
        .eq("development_id", scenario.development_id)
        .eq("is_active", true);

      // Load development to get custo_terreno (if tracked)
      const { data: dev } = await supabase
        .from("developments")
        .select("metadata")
        .eq("id", scenario.development_id)
        .maybeSingle();

      const custoTerreno =
        ((dev?.metadata as Record<string, unknown> | null)?.custo_terreno as number) ?? 0;

      // Run simulation
      const sim = runSimulation({
        scenario: scenario as Scenario,
        costItems: (costItems ?? []) as CostItem[],
        custoTerreno,
      });

      // Persist
      const { financial_id } = await persistSimulation(
        supabase,
        scenario as Scenario,
        sim,
        user.id,
        scenario_type ?? "realista"
      );

      return new Response(
        JSON.stringify({
          ok: true,
          financial_id,
          kpis: {
            vgv_total: sim.vgvTotal,
            custo_obra_total: sim.custoObraTotal,
            vpl: sim.vpl,
            vpl_wacc: sim.vplWacc,
            tir_anual: sim.tirAnual,
            payback_meses: sim.paybackMeses,
            payback_descontado_meses: sim.paybackDescontadoMeses,
            margem_liquida_pct: sim.margemLiquidaPct,
            wacc_pct: sim.waccCalculado,
            performance_score: sim.performanceScore,
          },
          capital_structure: sim.capitalStructure,
          kpi_metadata: sim.kpiMetadata,
          cash_flow_months: sim.rows.length,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ────────────────────────
    // ACTION: run_monte_carlo
    // ────────────────────────
    if (action === "run_monte_carlo") {
      const {
        scenario_id,
        financial_id,
        iterations,
        vgv_variation_pct,
        custo_variation_pct,
        velocidade_variation_pct,
      } = body as {
        scenario_id: string;
        financial_id?: string;
        iterations?: number;
        vgv_variation_pct?: number;
        custo_variation_pct?: number;
        velocidade_variation_pct?: number;
      };

      if (!scenario_id) throw new Error("scenario_id required");

      // Load scenario
      const { data: scenario, error: scErr } = await supabase
        .from("development_parcelamento_scenarios")
        .select("*")
        .eq("id", scenario_id)
        .maybeSingle();

      if (scErr || !scenario) throw new Error(scErr?.message ?? "Scenario not found");

      // Load cost items
      const { data: costItems } = await supabase
        .from("development_parcelamento_cost_items")
        .select("categoria, valor_total, mes_inicio, mes_fim")
        .eq("development_id", scenario.development_id)
        .eq("is_active", true);

      // Load custo terreno
      const { data: dev } = await supabase
        .from("developments")
        .select("metadata")
        .eq("id", scenario.development_id)
        .maybeSingle();

      const custoTerreno =
        ((dev?.metadata as Record<string, unknown> | null)?.custo_terreno as number) ?? 0;

      // Config com defaults e clamps de segurança
      const config: MonteCarloConfig = {
        iterations: Math.min(10000, Math.max(500, iterations ?? 5000)),
        vgv_variation_pct: Math.min(50, Math.max(0, vgv_variation_pct ?? 15)),
        custo_variation_pct: Math.min(50, Math.max(0, custo_variation_pct ?? 20)),
        velocidade_variation_pct: Math.min(80, Math.max(0, velocidade_variation_pct ?? 30)),
      };

      const mcResult = runMonteCarlo(
        scenario as Scenario,
        (costItems ?? []) as CostItem[],
        custoTerreno,
        config
      );

      // Persiste no financial record (se informado) — campo monte_carlo jsonb já existe
      let persistedTo: string | null = null;
      if (financial_id) {
        const { error: upErr } = await supabase
          .from("development_parcelamento_financial")
          .update({ monte_carlo: mcResult })
          .eq("id", financial_id);
        if (!upErr) persistedTo = financial_id;
      } else {
        // Tenta pegar o financial ativo do development e atualizar
        const { data: activeFin } = await supabase
          .from("development_parcelamento_financial")
          .select("id")
          .eq("development_id", scenario.development_id)
          .eq("is_active", true)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeFin?.id) {
          const { error: upErr } = await supabase
            .from("development_parcelamento_financial")
            .update({ monte_carlo: mcResult })
            .eq("id", activeFin.id);
          if (!upErr) persistedTo = activeFin.id as string;
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          monte_carlo: mcResult,
          persisted_to_financial_id: persistedTo,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ────────────────────────
    // ACTION: compute_sensitivity
    // ────────────────────────
    if (action === "compute_sensitivity") {
      const {
        scenario_id,
        financial_id,
        variation_pct,
        variation_pp,
        variables,
      } = body as {
        scenario_id: string;
        financial_id?: string;
        variation_pct?: number;
        variation_pp?: number;
        variables?: SensitivityVariable[];
      };

      if (!scenario_id) throw new Error("scenario_id required");

      // Load scenario
      const { data: scenario, error: scErr } = await supabase
        .from("development_parcelamento_scenarios")
        .select("*")
        .eq("id", scenario_id)
        .maybeSingle();

      if (scErr || !scenario) throw new Error(scErr?.message ?? "Scenario not found");

      // Load cost items
      const { data: costItems } = await supabase
        .from("development_parcelamento_cost_items")
        .select("categoria, valor_total, mes_inicio, mes_fim")
        .eq("development_id", scenario.development_id)
        .eq("is_active", true);

      // Load custo terreno
      const { data: dev } = await supabase
        .from("developments")
        .select("metadata")
        .eq("id", scenario.development_id)
        .maybeSingle();

      const custoTerreno =
        ((dev?.metadata as Record<string, unknown> | null)?.custo_terreno as number) ?? 0;

      // Config com clamps de segurança
      const config: SensitivityConfig = {
        variation_pct: Math.min(50, Math.max(1, variation_pct ?? 10)),
        variation_pp: Math.min(20, Math.max(0.1, variation_pp ?? 2)),
        variables: Array.isArray(variables) && variables.length > 0 ? variables : undefined,
      };

      const sensResult = computeSensitivity(
        scenario as Scenario,
        (costItems ?? []) as CostItem[],
        custoTerreno,
        config
      );

      // Persiste em development_parcelamento_financial.sensitivity (jsonb)
      let persistedTo: string | null = null;
      if (financial_id) {
        const { error: upErr } = await supabase
          .from("development_parcelamento_financial")
          .update({ sensitivity: sensResult })
          .eq("id", financial_id);
        if (!upErr) persistedTo = financial_id;
      } else {
        const { data: activeFin } = await supabase
          .from("development_parcelamento_financial")
          .select("id")
          .eq("development_id", scenario.development_id)
          .eq("is_active", true)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeFin?.id) {
          const { error: upErr } = await supabase
            .from("development_parcelamento_financial")
            .update({ sensitivity: sensResult })
            .eq("id", activeFin.id);
          if (!upErr) persistedTo = activeFin.id as string;
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          sensitivity: sensResult,
          persisted_to_financial_id: persistedTo,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ────────────────────────
    // ACTION: efficient_frontier
    // ────────────────────────
    if (action === "efficient_frontier") {
      const {
        scenario_id,
        financial_id,
        equity_min_pct,
        equity_max_pct,
        step_pct,
        realistic_max_divida_pct,
      } = body as {
        scenario_id: string;
        financial_id?: string;
        equity_min_pct?: number;
        equity_max_pct?: number;
        step_pct?: number;
        realistic_max_divida_pct?: number;
      };

      if (!scenario_id) throw new Error("scenario_id required");

      // Load scenario
      const { data: scenario, error: scErr } = await supabase
        .from("development_parcelamento_scenarios")
        .select("*")
        .eq("id", scenario_id)
        .maybeSingle();

      if (scErr || !scenario) throw new Error(scErr?.message ?? "Scenario not found");

      // Load cost items
      const { data: costItems } = await supabase
        .from("development_parcelamento_cost_items")
        .select("categoria, valor_total, mes_inicio, mes_fim")
        .eq("development_id", scenario.development_id)
        .eq("is_active", true);

      // Load custo terreno
      const { data: dev } = await supabase
        .from("developments")
        .select("metadata")
        .eq("id", scenario.development_id)
        .maybeSingle();

      const custoTerreno =
        ((dev?.metadata as Record<string, unknown> | null)?.custo_terreno as number) ?? 0;

      // Config com clamps de segurança
      const cfgMin = Math.min(100, Math.max(0, equity_min_pct ?? 0));
      const cfgMax = Math.min(100, Math.max(cfgMin, equity_max_pct ?? 100));
      const cfgStep = Math.min(50, Math.max(1, step_pct ?? 10));
      const cfgRealistic = Math.min(100, Math.max(0, realistic_max_divida_pct ?? 85));

      const efResult = runEfficientFrontier(
        scenario as Scenario,
        (costItems ?? []) as CostItem[],
        custoTerreno,
        {
          equity_min_pct: cfgMin,
          equity_max_pct: cfgMax,
          step_pct: cfgStep,
          realistic_max_divida_pct: cfgRealistic,
        }
      );

      // Persiste em development_parcelamento_financial.efficient_frontier (jsonb)
      let persistedTo: string | null = null;
      if (financial_id) {
        const { error: upErr } = await supabase
          .from("development_parcelamento_financial")
          .update({ efficient_frontier: efResult })
          .eq("id", financial_id);
        if (!upErr) persistedTo = financial_id;
      } else {
        const { data: activeFin } = await supabase
          .from("development_parcelamento_financial")
          .select("id")
          .eq("development_id", scenario.development_id)
          .eq("is_active", true)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeFin?.id) {
          const { error: upErr } = await supabase
            .from("development_parcelamento_financial")
            .update({ efficient_frontier: efResult })
            .eq("id", activeFin.id);
          if (!upErr) persistedTo = activeFin.id as string;
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          efficient_frontier: efResult,
          persisted_to_financial_id: persistedTo,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ────────────────────────
    // STUBS (próximas sprints)
    // ────────────────────────
    if (action === "compare_scenarios") {
      return new Response(
        JSON.stringify({
          ok: false,
          not_implemented: true,
          action,
          message: `Action '${action}' será implementada em sprints posteriores.`,
        }),
        { status: 501, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("parcelamento-financial-calc error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
