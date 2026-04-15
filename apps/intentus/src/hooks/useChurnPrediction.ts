/**
 * useChurnPrediction — Hook for Churn Prediction Engine (F7)
 *
 * Provides:
 * - useChurnPredictions(): Fetches all predictions for tenant
 * - useChurnPredictionByContract(contractId): Single contract prediction
 * - useRunChurnPrediction(): Mutation to run prediction via Edge Function
 * - useChurnSignals(contractId): Raw signals for a contract
 * - useChurnInterventions(predictionId): Interventions for a prediction
 * - useCreateIntervention(): Create a new intervention
 * - useUpdateIntervention(): Update intervention outcome
 *
 * Squad: Claudinho + Buchecha | 2026-03-21
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────

export interface ChurnReason {
  reason: string;
  weight: number;
  category: "financial" | "service" | "contract" | "satisfaction" | "behavioral";
}

export interface ChurnAction {
  action: string;
  priority: "urgente" | "alta" | "média" | "baixa";
  type: "contact" | "offer" | "escalation" | "task" | "notification";
  script?: string;
}

export interface QualitativeSignal {
  signal: string;
  severity: "high" | "medium" | "low";
}

export interface ChurnPrediction {
  id: string;
  tenant_id: string;
  person_id: string | null;
  contract_id: string | null;
  score: number;
  risk_level: "critical" | "high" | "medium" | "low";
  prediction_window: number;
  top_reasons: ChurnReason[];
  recommended_actions: ChurnAction[];
  signals_summary: {
    quantitative: number;
    qualitative: number;
    contextual: number;
    total_signals: number;
    sentiment: string | null;
    retention_probability: number | null;
  };
  model_version: string;
  predicted_at: string;
  expires_at: string | null;
  created_at: string;
  // Joined data
  people?: { name: string; email: string | null; phone: string | null } | null;
  contracts?: {
    monthly_value: number | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
    properties?: { street: string; neighborhood: string | null; city: string | null } | null;
  } | null;
}

export interface ChurnSignal {
  id: string;
  tenant_id: string;
  person_id: string | null;
  contract_id: string | null;
  signal_type: "quantitative" | "qualitative" | "contextual";
  signal_name: string;
  signal_value: number | null;
  weight: number | null;
  raw_data: Record<string, any>;
  detected_at: string;
  created_at: string;
}

export interface ChurnIntervention {
  id: string;
  tenant_id: string;
  prediction_id: string;
  person_id: string | null;
  contract_id: string | null;
  intervention_type: "contact" | "offer" | "escalation" | "task" | "notification";
  intervention_detail: Record<string, any>;
  script_ai: string | null;
  outcome: "retained" | "churned" | "pending" | "declined" | null;
  outcome_notes: string | null;
  executed_by: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null } | null;
}

// ── Queries ──────────────────────────────────────────────────

/** Fetch all latest predictions for the tenant (most recent per contract) */
export function useChurnPredictions(options?: {
  riskLevel?: string;
  minScore?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["churn-predictions", options],
    queryFn: async () => {
      let query = supabase
        .from("churn_predictions")
        .select(`
          *,
          people(name, email, phone),
          contracts(monthly_value, start_date, end_date, status,
            properties(street, neighborhood, city)
          )
        `)
        .order("predicted_at", { ascending: false })
        .limit(options?.limit || 100);

      if (options?.riskLevel) {
        query = query.eq("risk_level", options.riskLevel);
      }
      if (options?.minScore) {
        query = query.gte("score", options.minScore);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Deduplicate: keep only latest prediction per contract
      const seen = new Set<string>();
      const unique = (data || []).filter((p: any) => {
        const key = p.contract_id || p.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return unique as ChurnPrediction[];
    },
  });
}

/** Fetch latest prediction for a specific contract */
export function useChurnPredictionByContract(contractId: string | null) {
  return useQuery({
    queryKey: ["churn-prediction", contractId],
    queryFn: async () => {
      if (!contractId) return null;

      const { data, error } = await supabase
        .from("churn_predictions")
        .select(`
          *,
          people(name, email, phone),
          contracts(monthly_value, start_date, end_date, status,
            properties(street, neighborhood, city)
          )
        `)
        .eq("contract_id", contractId)
        .order("predicted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ChurnPrediction | null;
    },
    enabled: !!contractId,
  });
}

/** Fetch signals for a contract */
export function useChurnSignals(contractId: string | null) {
  return useQuery({
    queryKey: ["churn-signals", contractId],
    queryFn: async () => {
      if (!contractId) return [];

      const { data, error } = await supabase
        .from("churn_signals")
        .select("*")
        .eq("contract_id", contractId)
        .order("detected_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as ChurnSignal[];
    },
    enabled: !!contractId,
  });
}

/** Fetch interventions for a prediction */
export function useChurnInterventions(predictionId: string | null) {
  return useQuery({
    queryKey: ["churn-interventions", predictionId],
    queryFn: async () => {
      if (!predictionId) return [];

      const { data, error } = await supabase
        .from("churn_interventions")
        .select(`
          *,
          profiles(full_name)
        `)
        .eq("prediction_id", predictionId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as ChurnIntervention[];
    },
    enabled: !!predictionId,
  });
}

// ── Mutations ────────────────────────────────────────────────

/** Run churn prediction for a specific contract */
export function useRunChurnPrediction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      contractId,
      tenantId,
      predictionWindow = 30,
    }: {
      contractId: string;
      tenantId: string;
      predictionWindow?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("relationship-churn-predictor", {
        body: { contractId, tenantId, predictionWindow },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["churn-predictions"] });
      queryClient.invalidateQueries({ queryKey: ["churn-prediction", variables.contractId] });
      queryClient.invalidateQueries({ queryKey: ["churn-signals", variables.contractId] });

      const score = data?.prediction?.score;
      const riskLevel = data?.prediction?.risk_level;
      if (score !== undefined) {
        const emoji = riskLevel === "critical" ? "🔴" : riskLevel === "high" ? "🟠" : riskLevel === "medium" ? "🟡" : "🟢";
        toast.success(`${emoji} Churn Score: ${score}/100 (${riskLevel})`);
      }
    },
    onError: (error: any) => {
      console.error("Churn prediction error:", error);
      toast.error(error?.message || "Erro ao executar predição de churn");
    },
  });
}

/** Run batch predictions for all active contracts */
export function useRunBatchChurnPrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenantId, predictionWindow = 30 }: { tenantId: string; predictionWindow?: number }) => {
      // Fetch active contracts
      const { data: contracts, error } = await supabase
        .from("contracts")
        .select("id")
        .eq("status", "ativo")
        .limit(50);

      if (error) throw error;
      if (!contracts || contracts.length === 0) {
        throw new Error("Nenhum contrato ativo encontrado");
      }

      // Run predictions sequentially (to respect rate limits)
      const results: any[] = [];
      for (const contract of contracts) {
        try {
          const response = await supabase.functions.invoke("relationship-churn-predictor", {
            body: { contractId: contract.id, tenantId, predictionWindow },
          });
          if (response.data?.success) {
            results.push(response.data.prediction);
          }
        } catch (e) {
          console.warn(`Failed prediction for contract ${contract.id}:`, e);
        }
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return { total: contracts.length, predicted: results.length, results };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["churn-predictions"] });
      toast.success(`Predição completa: ${data.predicted}/${data.total} contratos analisados`);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erro na predição em lote");
    },
  });
}

/** Create an intervention for a prediction */
export function useCreateIntervention() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (intervention: {
      prediction_id: string;
      person_id?: string | null;
      contract_id?: string | null;
      intervention_type: ChurnIntervention["intervention_type"];
      intervention_detail?: Record<string, any>;
      script_ai?: string;
    }) => {
      // Get tenant_id from the prediction
      const { data: prediction } = await supabase
        .from("churn_predictions")
        .select("tenant_id")
        .eq("id", intervention.prediction_id)
        .single();

      const { data, error } = await supabase
        .from("churn_interventions")
        .insert({
          ...intervention,
          tenant_id: prediction?.tenant_id,
          outcome: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["churn-interventions", variables.prediction_id] });
      toast.success("Intervenção registrada com sucesso");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erro ao criar intervenção");
    },
  });
}

/** Update intervention outcome */
export function useUpdateIntervention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      outcome,
      outcome_notes,
    }: {
      id: string;
      outcome: ChurnIntervention["outcome"];
      outcome_notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("churn_interventions")
        .update({
          outcome,
          outcome_notes,
          executed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["churn-interventions"] });
      queryClient.invalidateQueries({ queryKey: ["churn-predictions"] });
      toast.success(`Intervenção atualizada: ${data.outcome}`);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erro ao atualizar intervenção");
    },
  });
}

// ── Computed Helpers ─────────────────────────────────────────

export function getChurnRiskColor(riskLevel: string) {
  switch (riskLevel) {
    case "critical": return "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:text-red-400";
    case "high": return "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400";
    case "medium": return "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400";
    case "low": return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400";
    default: return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

export function getChurnRiskLabel(riskLevel: string) {
  switch (riskLevel) {
    case "critical": return "Crítico";
    case "high": return "Alto";
    case "medium": return "Médio";
    case "low": return "Baixo";
    default: return riskLevel;
  }
}

export function getChurnRiskEmoji(riskLevel: string) {
  switch (riskLevel) {
    case "critical": return "🔴";
    case "high": return "🟠";
    case "medium": return "🟡";
    case "low": return "🟢";
    default: return "⚪";
  }
}

/** Calculate aggregated churn metrics from predictions array */
export function useChurnMetrics(predictions: ChurnPrediction[]) {
  const totalContracts = predictions.length;
  const avgScore = totalContracts > 0
    ? Math.round(predictions.reduce((s, p) => s + p.score, 0) / totalContracts)
    : 0;

  const critical = predictions.filter(p => p.risk_level === "critical").length;
  const high = predictions.filter(p => p.risk_level === "high").length;
  const medium = predictions.filter(p => p.risk_level === "medium").length;
  const low = predictions.filter(p => p.risk_level === "low").length;

  const atRiskMRR = predictions
    .filter(p => p.score >= 60)
    .reduce((s, p) => s + (p.contracts?.monthly_value || 0), 0);

  const totalMRR = predictions
    .reduce((s, p) => s + (p.contracts?.monthly_value || 0), 0);

  return {
    totalContracts,
    avgScore,
    critical,
    high,
    medium,
    low,
    atRiskCount: critical + high,
    atRiskMRR,
    totalMRR,
    atRiskPct: totalContracts > 0 ? Math.round(((critical + high) / totalContracts) * 100) : 0,
  };
}
