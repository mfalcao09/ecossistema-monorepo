import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ContractDraft {
  title: string;
  contract_html: string;
  clauses_count: number;
  missing_fields?: string[];
  legal_notes?: string[];
  summary: string;
}

export function useContractDraftAI() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContractDraft | null>(null);

  async function generate(params: {
    contract_id?: string;
    template_id?: string;
    contract_type?: string;
    instructions?: string;
  }) {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("contract-draft-ai", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("Limite")) toast.error(data.error);
        else throw new Error(data.error);
        return null;
      }
      setResult(data as ContractDraft);
      return data as ContractDraft;
    } catch (err: any) {
      toast.error("Erro ao gerar contrato: " + err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { generate, loading, result, reset: () => setResult(null) };
}
