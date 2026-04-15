/**
 * Tipos para a Edge Function fii-cra-simulator v1
 *
 * Sessão 145 — Bloco H Sprint 5 (US-134/135)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 *
 * FII (Fundo de Investimento Imobiliário) — Investment fund simulation
 * CRA/CRI (Certificado de Recebíveis) — Securitization of receivables
 *
 * Financial calculations are done inline (Newton-Raphson IRR, NPV, WAL)
 */

// ============================================================
// FII Simulation — Quota-based fund structure
// ============================================================

export interface SimulateFiiRequest {
  action: "simulate_fii";
  development_id: string;
  vgv_total: number; // Valor Geral de Vendas (expected revenues)
  expected_monthly_revenue: number;
  vacancy_rate_pct: number; // % of units not rented (0-100)
  admin_fee_pct: number; // Annual admin fee (% of assets, typically 0.5-1%)
  management_fee_pct: number; // Annual management fee (% of revenues)
  number_of_quotas: number;
  expected_yield_annual_pct: number; // Target annual yield (expectations)
  duration_years: number;
  discount_rate_annual_pct: number;
}

export interface FiiQuotaDetail {
  numero_quota: number;
  valor_emissao: number;
  valor_corrente: number;
  distribuicao_mensal: number;
  rentabilidade_anual_pct: number;
}

export interface FiiProjection {
  ano: number;
  receita_bruta: number;
  receita_liquida_apos_vacancia: number;
  despesas_admin: number;
  despesas_gerenciamento: number;
  fluxo_disponivel: number;
  fluxo_descontado: number;
  acumulado: number;
}

export interface SimulateFiiResult {
  ok: boolean;
  data?: {
    fii_id: string;
    quota_value: number;
    number_of_quotas: number;
    patrimonio_liquido: number;
    monthly_distribution_per_quota: number;
    annual_yield_pct: number;
    dividend_yield_pct: number;
    pvp_ratio: number; // Price/VP (valor patrimonial)
    irr_projection_5years_pct: number;
    irr_projection_10years_pct: number;
    projections: FiiProjection[];
    npv_5years: number;
    npv_10years: number;
    break_even_months: number;
    summary: string;
    simulation_date: string;
  };
  error?: { code: string; message: string };
}

// ============================================================
// CRA/CRI Securitization Simulation
// ============================================================

export interface SimulateCriCraRequest {
  action: "simulate_cri_cra";
  development_id: string;
  total_receivables: number;
  duration_months: number;
  spread_over_cdi_pct: number; // Spread acima da taxa CDI (typically 2-5%)
  subordination_level_pct: number; // Subordinated tranche size (% of total, typically 5-20%)
  credit_enhancement_type: "none" | "insurance" | "guarantee" | "reserve";
  credit_enhancement_value?: number;
  expected_default_rate_pct: number;
  tax_rate_pct?: number;
}

export interface CriCraTrancheDetail {
  nome: string;
  tipo: "senior" | "mezzanine" | "subordinada";
  valor_emitido: number;
  percentual_total: number;
  taxa_anual_pct: number; // CDI + spread (seniors) ou fixo (subordinadas)
  valor_presente: number;
  prazo_medio_ponderado_meses: number;
  risco_rating: string; // AAA, AA, A, BBB, etc
}

export interface CriCraMonthlyFlow {
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

export interface SimulateCriCraResult {
  ok: boolean;
  data?: {
    simulation_id: string;
    total_receivables: number;
    duration_months: number;
    cdi_spread_pct: number;
    senior_tranche: CriCraTrancheDetail;
    mezzanine_tranche?: CriCraTrancheDetail;
    subordinated_tranche: CriCraTrancheDetail;
    monthly_cash_flow: CriCraMonthlyFlow[];
    weighted_average_life_months: number;
    total_interest_cost: number;
    effective_rate_annual_pct: number;
    irr_senior_pct: number;
    irr_subordinada_pct: number;
    recovery_value: number;
    loss_given_default_pct: number;
    npv_by_tranche: Record<string, number>;
    summary: string;
    simulation_date: string;
  };
  error?: { code: string; message: string };
}

// ============================================================
// Compare FII vs CRA/CRI — Side-by-side comparison
// ============================================================

export interface CompareStructuresRequest {
  action: "compare_structures";
  development_id: string;
  // Can either provide simulation IDs or re-simulate inline
  fii_id?: string;
  cri_cra_id?: string;
  // Or use last simulations for the development
}

export interface StructureComparison {
  structure_name: string;
  tipo: "fii" | "cri" | "cra";
  investimento_inicial: number;
  rentabilidade_anual_pct: number;
  prazo_medio_meses: number;
  risco_rating: string;
  liquidez: "alta" | "media" | "baixa";
  tributacao_pct: number;
  vantagens: string[];
  desvantagens: string[];
}

export interface CompareStructuresResult {
  ok: boolean;
  data?: {
    comparacoes: StructureComparison[];
    recomendacao: string;
    fatores_decisao: {
      horizonte_investimento_meses: number;
      apetite_risco: "baixo" | "medio" | "alto";
      necessidade_liquidez: "alta" | "media" | "baixa";
    };
    summary: string;
    comparison_date: string;
  };
  error?: { code: string; message: string };
}

// ============================================================
// List Simulations — History & saved scenarios
// ============================================================

export interface ListSimulationsRequest {
  action: "list_simulations";
  development_id: string;
  tipo?: "fii" | "cri" | "cra" | "all";
  limit?: number;
  offset?: number;
}

export interface SimulationSummary {
  id: string;
  tipo: "fii" | "cri" | "cra";
  titulo: string;
  data_simulacao: string;
  rentabilidade_esperada_pct: number;
  valor_principal: number;
  prazo_meses: number;
  criado_por: string;
}

export interface ListSimulationsResult {
  ok: boolean;
  data?: {
    simulations: SimulationSummary[];
    total: number;
    offset: number;
    limit: number;
  };
  error?: { code: string; message: string };
}

// ============================================================
// Structure Type Labels (PT-BR)
// ============================================================

export const STRUCTURE_TYPE_LABELS: Record<string, string> = {
  fii: "Fundo de Investimento Imobiliário (FII)",
  cri: "Certificado de Recebíveis Imobiliários (CRI)",
  cra: "Certificado de Recebíveis do Agronegócio (CRA)",
};

export const STRUCTURE_TYPE_COLORS: Record<string, string> = {
  fii: "#7c3aed",
  cri: "#4f46e5",
  cra: "#0891b2",
};

export const TRANCHE_TYPE_LABELS: Record<string, string> = {
  senior: "Sênior (Menor Risco)",
  mezzanine: "Mezanino (Risco Médio)",
  subordinada: "Subordinada (Maior Risco)",
};

export const CREDIT_ENHANCEMENT_LABELS: Record<string, string> = {
  none: "Nenhum",
  insurance: "Seguro de Crédito",
  guarantee: "Garantia",
  reserve: "Fundo de Reserva",
};

export const RISK_RATING_LABELS: Record<string, string> = {
  AAA: "AAA (Risco Mínimo)",
  AA: "AA (Risco Muito Baixo)",
  A: "A (Risco Baixo)",
  BBB: "BBB (Risco Moderado)",
  BB: "BB (Risco Elevado)",
  B: "B (Risco Muito Elevado)",
  C: "C (Risco Crítico)",
};

export const LIQUIDITY_LABELS: Record<string, string> = {
  alta: "Alta — Negociação ativa em bolsa",
  media: "Média — Negociação eventual",
  baixa: "Baixa — Pouca negociação",
};

// ============================================================
// Combined Request/Response Types
// ============================================================

export type FiiCraRequest =
  | SimulateFiiRequest
  | SimulateCriCraRequest
  | CompareStructuresRequest
  | ListSimulationsRequest;

export type FiiCraResult =
  | SimulateFiiResult
  | SimulateCriCraResult
  | CompareStructuresResult
  | ListSimulationsResult;
