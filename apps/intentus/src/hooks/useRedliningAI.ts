/**
 * useRedliningAI — AI-Powered Redlining Suggestions (Sessão 56)
 *
 * Hooks for the redlining-ai Edge Function.
 * Two actions:
 *   - suggest_redlines: Full contract analysis → AI redlining suggestions
 *   - analyze_clause: Single clause deep analysis
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RedlineSuggestionCategory =
  | "legal_compliance"
  | "risk_mitigation"
  | "clarity"
  | "fairness"
  | "market_practice"
  | "missing_clause";

export type RedlinePriority = "alta" | "media" | "baixa";

export interface RedlineSuggestion {
  clause_name: string;
  original_text: string;
  proposed_text: string;
  reason: string;
  category: RedlineSuggestionCategory;
  confidence: number; // 0-100
  priority: RedlinePriority;
  legal_basis?: string;
  risk_if_unchanged?: string;
}

export interface SuggestRedlinesResult {
  suggestions: RedlineSuggestion[];
  contract_summary: string;
  overall_risk: "low" | "medium" | "high" | "critical";
  analysis_model: string;
}

export interface AnalyzeClauseResult {
  suggestions: RedlineSuggestion[];
  overall_risk: "low" | "medium" | "high" | "critical";
  summary: string;
  compliance_notes: string[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Suggest redlines for a full contract — calls redlining-ai with action=suggest_redlines
 */
export function useSuggestRedlines() {
  return useMutation({
    mutationFn: async ({
      contractId,
      contractText,
      contractType,
      contractParties,
    }: {
      contractId: string;
      contractText: string;
      contractType?: string;
      contractParties?: string;
    }): Promise<SuggestRedlinesResult> => {
      const { data, error } = await supabase.functions.invoke("redlining-ai", {
        body: {
          action: "suggest_redlines",
          contract_id: contractId,
          contract_text: contractText,
          contract_type: contractType,
          contract_parties: contractParties,
        },
      });
      if (error) throw new Error(error.message || "Erro ao gerar sugestões de redlining");
      return data as SuggestRedlinesResult;
    },
    onError: (err: Error) => {
      toast.error(`Erro IA: ${err.message}`);
    },
  });
}

/**
 * Analyze a single clause — calls redlining-ai with action=analyze_clause
 */
export function useAnalyzeClause() {
  return useMutation({
    mutationFn: async ({
      clauseName,
      clauseText,
      contractType,
    }: {
      clauseName: string;
      clauseText: string;
      contractType?: string;
    }): Promise<AnalyzeClauseResult> => {
      const { data, error } = await supabase.functions.invoke("redlining-ai", {
        body: {
          action: "analyze_clause",
          clause_name: clauseName,
          clause_text: clauseText,
          contract_type: contractType,
        },
      });
      if (error) throw new Error(error.message || "Erro ao analisar cláusula");
      return data as AnalyzeClauseResult;
    },
    onError: (err: Error) => {
      toast.error(`Erro IA: ${err.message}`);
    },
  });
}
