import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RiskFactor {
  factor: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface ClauseRiskEvaluation {
  clause_id: string;
  risk_level: string;
  risk_score: number;
  risk_factors: RiskFactor[];
  suggestions?: string[];
  compliance_notes?: string;
}

export interface ClauseSuggestion {
  clause_id: string;
  relevance_score: number;
  reason: string;
  is_mandatory_for_context: boolean;
  priority: "alta" | "média" | "baixa";
}

export interface ClauseConflict {
  clause_ids: string[];
  conflict_type: "contradiction" | "overlap" | "legal_incompatibility" | "ambiguity" | "duplication";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  resolution: string;
}

// ---------------------------------------------------------------------------
// Query: list clauses with optional filters
// ---------------------------------------------------------------------------

export function useContractClauses(filters?: {
  category?: string;
  search?: string;
  riskLevel?: string;
}) {
  return useQuery({
    queryKey: ["contract-clauses", filters],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      let query = supabase
        .from("contract_clauses")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("title", { ascending: true });
      if (filters?.category && filters.category !== "todas") {
        query = query.eq("category", filters.category);
      }
      if (filters?.riskLevel && filters.riskLevel !== "todos") {
        query = query.eq("risk_level", filters.riskLevel);
      }
      const { data, error } = await query;
      if (error) throw error;
      let results = data;
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        results = results.filter(
          (c) => c.title.toLowerCase().includes(s) || c.content.toLowerCase().includes(s)
        );
      }
      return results;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutation: create clause
// ---------------------------------------------------------------------------

export function useCreateClause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      content: string;
      category: string;
      contract_types?: string[];
      is_mandatory?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_clauses")
        .insert({ ...input, created_by: user.id, tenant_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-clauses"] });
      toast.success("Cláusula criada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

// ---------------------------------------------------------------------------
// Mutation: update clause
// ---------------------------------------------------------------------------

export function useUpdateClause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      title?: string;
      content?: string;
      category?: string;
      contract_types?: string[];
      is_mandatory?: boolean;
      is_active?: boolean;
    }) => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_clauses")
        .update(updates)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-clauses"] });
      toast.success("Cláusula atualizada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

// ---------------------------------------------------------------------------
// Mutation: soft-delete clause
// ---------------------------------------------------------------------------

export function useDeleteClause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase
        .from("contract_clauses")
        .update({ is_active: false })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-clauses"] });
      toast.success("Cláusula desativada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

// ---------------------------------------------------------------------------
// Mutation: evaluate risk (calls extract-clauses-ai action: evaluate_risk)
// ---------------------------------------------------------------------------

export function useEvaluateClauseRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clauseIds: string[]): Promise<{
      evaluations: ClauseRiskEvaluation[];
      updated_count: number;
      total: number;
    }> => {
      const { data, error } = await supabase.functions.invoke("extract-clauses-ai", {
        body: { action: "evaluate_risk", clause_ids: clauseIds },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["contract-clauses"] });
      toast.success(`${data.updated_count} cláusula(s) avaliada(s) com sucesso!`);
    },
    onError: (err: Error) => toast.error(`Erro ao avaliar risco: ${err.message}`),
  });
}

// ---------------------------------------------------------------------------
// Mutation: suggest clauses for a contract context
// ---------------------------------------------------------------------------

export function useSuggestClauses() {
  return useMutation({
    mutationFn: async (input: {
      contract_type: string;
      contract_context?: Record<string, unknown>;
    }): Promise<{ suggestions: ClauseSuggestion[] }> => {
      const { data, error } = await supabase.functions.invoke("extract-clauses-ai", {
        body: { action: "suggest", ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onError: (err: Error) => toast.error(`Erro ao sugerir cláusulas: ${err.message}`),
  });
}

// ---------------------------------------------------------------------------
// Mutation: detect conflicts between clauses
// ---------------------------------------------------------------------------

export function useDetectConflicts() {
  return useMutation({
    mutationFn: async (clauseIds: string[]): Promise<{
      conflicts: ClauseConflict[];
      summary: string;
      clauses_analyzed: number;
    }> => {
      const { data, error } = await supabase.functions.invoke("extract-clauses-ai", {
        body: { action: "detect_conflicts", clause_ids: clauseIds },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onError: (err: Error) => toast.error(`Erro ao detectar conflitos: ${err.message}`),
  });
}
