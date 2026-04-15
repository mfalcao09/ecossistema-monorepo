import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EconomicIndex {
  index_code: string;
  reference_date: string;
  monthly_value: number | null;
  accumulated_12m: number | null;
  fetched_at: string;
}

const INDEX_META: Record<string, { name: string; description: string }> = {
  igpm: { name: "IGP-M", description: "Reajuste de aluguéis" },
  ipca: { name: "IPCA", description: "Inflação oficial" },
  inpc: { name: "INPC", description: "Reajuste salarial" },
  incc: { name: "INCC", description: "Construção civil" },
  igpdi: { name: "IGP-DI", description: "Contratos antigos" },
  cdi: { name: "CDI", description: "Rentabilidade" },
  selic: { name: "SELIC", description: "Taxa básica de juros" },
  tr: { name: "TR", description: "Financiamentos" },
  tjlp: { name: "TJLP", description: "BNDES/habitação" },
  poupanca: { name: "Poupança", description: "Comparativo" },
};

export const ALL_INDEX_CODES = Object.keys(INDEX_META);

export function getIndexMeta(code: string) {
  return INDEX_META[code] || { name: code.toUpperCase(), description: "" };
}

export function useEconomicIndices() {
  const queryClient = useQueryClient();

  // Get latest entry per index_code
  const { data: indices, isLoading } = useQuery({
    queryKey: ["economic-indices-latest"],
    queryFn: async () => {
      // Fetch all entries ordered by date desc, then pick latest per code
      const { data, error } = await supabase
        .from("economic_indices")
        .select("*")
        .order("reference_date", { ascending: false });

      if (error) throw error;

      // Group by index_code, pick latest
      const latestMap = new Map<string, EconomicIndex>();
      for (const row of data || []) {
        if (!latestMap.has(row.index_code)) {
          latestMap.set(row.index_code, row as EconomicIndex);
        }
      }
      return latestMap;
    },
  });

  // Fetch sparkline data (last 12 months per index)
  const { data: sparklineData } = useQuery({
    queryKey: ["economic-indices-sparkline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_indices")
        .select("index_code, reference_date, monthly_value")
        .order("reference_date", { ascending: true });

      if (error) throw error;

      const map = new Map<string, { date: string; value: number }[]>();
      for (const row of data || []) {
        if (row.monthly_value == null) continue;
        if (!map.has(row.index_code)) map.set(row.index_code, []);
        map.get(row.index_code)!.push({ date: row.reference_date, value: Number(row.monthly_value) });
      }
      // Keep last 12 per code
      for (const [k, v] of map) {
        map.set(k, v.slice(-12));
      }
      return map;
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/bcb-index?index=all&months=12`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({}),
        }
      );
      if (!resp.ok) throw new Error("Falha ao atualizar índices");
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["economic-indices-latest"] });
      queryClient.invalidateQueries({ queryKey: ["economic-indices-sparkline"] });
      toast.success("Índices atualizados com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar índices econômicos");
    },
  });

  return {
    indices,
    sparklineData,
    isLoading,
    refreshIndices: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  };
}
