import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RiskAssessment {
  risk_score: number;
  risk_level: "baixo" | "medio" | "alto" | "critico";
  probability_default: number;
  payment_behavior: string;
  risk_factors?: string[];
  positive_factors?: string[];
  recommended_action: string;
  recommended_action_label: string;
  reasoning: string;
}

export function useDefaultRiskAI() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskAssessment | null>(null);

  async function analyze(params: { person_id: string; contract_id?: string }) {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("default-risk-ai", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data as RiskAssessment);
      return data as RiskAssessment;
    } catch (err: any) {
      toast.error("Erro na análise de risco: " + err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { analyze, loading, result, reset: () => setResult(null) };
}
