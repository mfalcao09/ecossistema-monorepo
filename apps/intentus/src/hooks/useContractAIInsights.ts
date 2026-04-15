import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

// ── Tipos ────────────────────────────────────────────────
export interface RiskFactor {
  category: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface Suggestion {
  type: string;
  description: string;
  priority: "low" | "medium" | "high";
}

export interface KeyObligation {
  party: string;
  obligation: string;
  deadline?: string;
}

export interface KeyDate {
  label: string;
  date: string;
  type: "start" | "end" | "renewal" | "payment" | "other";
}

export interface FlaggedClause {
  clause_number: string;
  content_preview: string;
  reason: string;
  risk_level: "low" | "medium" | "high";
}

export interface ContractAIAnalysis {
  id: string;
  contract_id: string;
  analysis_type: string;
  risk_score: number | null;
  risk_factors: RiskFactor[];
  missing_clauses: string[];
  suggestions: Suggestion[];
  summary: string | null;
  key_obligations: KeyObligation[];
  key_dates: KeyDate[];
  parties_extracted: any[];
  flagged_clauses: FlaggedClause[];
  model_used: string | null;
  tokens_used: number | null;
  processing_ms: number | null;
  analyzed_by: string | null;
  tenant_id: string;
  created_at: string;
}

export interface ContractAIOverview {
  contract_id: string;
  contract_number: string | null;
  title: string | null;
  contract_type: string | null;
  status: string | null;
  analysis_id: string | null;
  analysis_type: string | null;
  hub_risk_score: number | null;
  hub_risk_factors: RiskFactor[] | null;
  hub_missing_clauses: string[] | null;
  hub_suggestions: Suggestion[] | null;
  hub_summary: string | null;
  hub_key_obligations: KeyObligation[] | null;
  hub_key_dates: KeyDate[] | null;
  hub_flagged_clauses: FlaggedClause[] | null;
  model_used: string | null;
  hub_analyzed_at: string | null;
}

export interface AIPortfolioInsights {
  totalContracts: number;
  analyzedContracts: number;
  avgRiskScore: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  commonMissingClauses: { clause: string; count: number }[];
  topRiskFactors: { category: string; count: number }[];
  /** true when insights are based on rule_engine (simulated), not real AI models */
  isSimulated: boolean;
}

// ── Labels e Cores ───────────────────────────────────────
export const RISK_LEVEL_LABELS: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

export const RISK_LEVEL_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

export const RISK_SCORE_COLOR = (score: number): string => {
  if (score <= 25) return "text-green-600";
  if (score <= 50) return "text-yellow-600";
  if (score <= 75) return "text-orange-600";
  return "text-red-600";
};

export const RISK_SCORE_BG = (score: number): string => {
  if (score <= 25) return "bg-green-500";
  if (score <= 50) return "bg-yellow-500";
  if (score <= 75) return "bg-orange-500";
  return "bg-red-500";
};

export const RISK_SCORE_LABEL = (score: number): string => {
  if (score <= 25) return "Baixo Risco";
  if (score <= 50) return "Risco Moderado";
  if (score <= 75) return "Risco Alto";
  return "Risco Crítico";
};

// ── Funções de fetch ─────────────────────────────────────
async function fetchContractAnalysis(contractId: string): Promise<ContractAIAnalysis[]> {
  const { data, error } = await (supabase as any)
    .from("contract_ai_analysis")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ContractAIAnalysis[];
}

async function fetchAIOverview(): Promise<ContractAIOverview[]> {
  const tenantId = await getAuthTenantId();

  const { data, error } = await (supabase as any)
    .from("v_contract_ai_overview")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("hub_risk_score", { ascending: false, nullsFirst: false })
    .limit(200); // Safety net — avoid loading thousands of records

  if (error) throw error;
  return (data ?? []) as ContractAIOverview[];
}

async function fetchPortfolioInsights(): Promise<AIPortfolioInsights> {
  const tenantId = await getAuthTenantId();

  // Busca contratos e análises para gerar insights agregados
  const { data: contracts, error: cErr } = await (supabase as any)
    .from("contracts")
    .select("id, title, status, contract_type")
    .eq("tenant_id", tenantId)
    .in("status", ["ativo", "em_revisao", "em_aprovacao", "aguardando_assinatura"]);

  if (cErr) throw cErr;

  const { data: analyses, error: aErr } = await (supabase as any)
    .from("contract_ai_analysis")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500); // Safety net — only most recent analyses needed for portfolio insights

  if (aErr) throw aErr;

  const totalContracts = contracts?.length ?? 0;
  const analysisMap = new Map<string, ContractAIAnalysis>();

  // Pega a análise mais recente por contrato
  for (const a of (analyses ?? []) as ContractAIAnalysis[]) {
    if (!analysisMap.has(a.contract_id)) {
      analysisMap.set(a.contract_id, a);
    }
  }

  const analyzedContracts = analysisMap.size;
  const allAnalyses = Array.from(analysisMap.values());

  // Médio de risk score
  const scores = allAnalyses.filter((a) => a.risk_score !== null).map((a) => a.risk_score!);
  const avgRiskScore = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

  // Contagem por faixa de risco
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  for (const score of scores) {
    if (score > 75) highRiskCount++;
    else if (score > 40) mediumRiskCount++;
    else lowRiskCount++;
  }

  // Cláusulas ausentes mais comuns
  const clauseCount = new Map<string, number>();
  for (const a of allAnalyses) {
    for (const clause of a.missing_clauses ?? []) {
      clauseCount.set(clause, (clauseCount.get(clause) ?? 0) + 1);
    }
  }
  const commonMissingClauses = Array.from(clauseCount.entries())
    .map(([clause, count]) => ({ clause, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Fatores de risco mais comuns
  const factorCount = new Map<string, number>();
  for (const a of allAnalyses) {
    for (const factor of a.risk_factors ?? []) {
      factorCount.set(factor.category, (factorCount.get(factor.category) ?? 0) + 1);
    }
  }
  const topRiskFactors = Array.from(factorCount.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Detect if insights are based on simulated (rule_engine) data
  const isSimulated = allAnalyses.length > 0 &&
    allAnalyses.every((a) => a.model_used === "rule_engine_v1" || a.model_used === null);

  return {
    totalContracts,
    analyzedContracts,
    avgRiskScore,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    commonMissingClauses,
    topRiskFactors,
    isSimulated,
  };
}

// ── Compliance Gap type ──────────────────────────────────
export interface ComplianceGap {
  requirement: string;
  status: "compliant" | "non_compliant" | "partial" | "not_applicable";
  detail: string;
}

// ── Análise via Edge Function (IA real + fallback rule engine) ──
async function runAIAnalysis(contractId: string): Promise<ContractAIAnalysis> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Usuário não autenticado");

  const response = await supabase.functions.invoke("clm-ai-insights", {
    body: { action: "analyze_contract", contract_id: contractId },
  });

  if (response.error) {
    throw new Error(response.error.message || "Erro na análise IA");
  }

  const result = response.data;
  if (!result?.analysis) throw new Error("Resposta inválida da análise");

  return result.analysis as ContractAIAnalysis;
}

// ── Portfolio Health via Edge Function ──
export interface PortfolioHealthResult {
  health_score: number;
  critical_risks: { risk: string; impact: string; urgency: string }[];
  opportunities: { insight: string; potential_impact: string }[];
  recommended_actions: { action: string; priority: string; estimated_effort: string }[];
  compliance_overview: { score: number; gaps_count: number; top_gaps: string[] };
  summary: string;
  portfolio_data: Record<string, any>;
  model_used: string;
  is_simulated: boolean;
}

async function fetchPortfolioHealth(): Promise<PortfolioHealthResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Usuário não autenticado");

  const response = await supabase.functions.invoke("clm-ai-insights", {
    body: { action: "portfolio_health" },
  });

  if (response.error) throw new Error(response.error.message || "Erro ao buscar saúde do portfólio");
  return response.data as PortfolioHealthResult;
}

// ── Advanced Metrics via Edge Function ──
export interface AdvancedMetrics {
  kpis: {
    total_contracts: number;
    active_contracts: number;
    avg_lifecycle_days: number | null;
    renewal_rate_pct: number | null;
    cancellation_rate_pct: number | null;
    collection_rate_pct: number | null;
    overdue_amount: number;
    overdue_installments: number;
    obligation_compliance_rate_pct: number | null;
    avg_payment_delay_days: number | null;
    total_portfolio_value: number;
    monthly_recurring_value: number;
  };
  expiring_by_month: { month: string; count: number }[];
  mom_growth: { month: string; count: number; growth_pct: number | null }[];
  value_by_type: { type: string; count: number; total: number; monthly: number }[];
  generated_at: string;
}

async function fetchAdvancedMetrics(period: string = "12m"): Promise<AdvancedMetrics> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Usuário não autenticado");

  const response = await supabase.functions.invoke("clm-ai-insights", {
    body: { action: "advanced_metrics", period },
  });

  if (response.error) throw new Error(response.error.message || "Erro ao buscar métricas avançadas");
  return response.data as AdvancedMetrics;
}

// ── Hooks ────────────────────────────────────────────────
export function useContractAIAnalysis(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contract-ai-analysis", contractId],
    queryFn: () => fetchContractAnalysis(contractId!),
    enabled: !!contractId,
  });
}

export function useAIOverview() {
  return useQuery({
    queryKey: ["contract-ai-overview"],
    queryFn: fetchAIOverview,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function usePortfolioInsights() {
  return useQuery({
    queryKey: ["portfolio-insights"],
    queryFn: fetchPortfolioInsights,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useRunAIAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runAIAnalysis,
    onSuccess: (_, contractId) => {
      qc.invalidateQueries({ queryKey: ["contract-ai-analysis", contractId] });
      qc.invalidateQueries({ queryKey: ["contract-ai-overview"] });
      qc.invalidateQueries({ queryKey: ["portfolio-insights"] });
      qc.invalidateQueries({ queryKey: ["portfolio-health"] });
      toast.success("Análise IA concluída!");
    },
    onError: (err: Error) => toast.error(`Erro na análise: ${err.message}`),
  });
}

export function usePortfolioHealth() {
  return useQuery({
    queryKey: ["portfolio-health"],
    queryFn: fetchPortfolioHealth,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useAdvancedMetrics(period: string = "12m") {
  return useQuery({
    queryKey: ["advanced-metrics", period],
    queryFn: () => fetchAdvancedMetrics(period),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 2,
  });
}
