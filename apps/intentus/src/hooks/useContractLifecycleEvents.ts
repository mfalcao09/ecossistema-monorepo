/**
 * useContractLifecycleEvents - Hook para eventos do ciclo de vida do contrato
 *
 * Consome a tabela `contract_lifecycle_events` que é preenchida automaticamente
 * por triggers toda vez que um contrato muda de status.
 *
 * Exibe uma timeline cronológica com:
 * - Quem fez a transição
 * - De qual status → para qual status
 * - Motivo/comentário
 * - Data/hora exata
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContractLifecycleEvent {
  id: string;
  contract_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Busca todos os eventos de lifecycle de um contrato específico.
 * Ordenados do mais recente para o mais antigo.
 */
export function useContractLifecycleEvents(contractId: string | undefined) {
  return useQuery<ContractLifecycleEvent[]>({
    queryKey: ["contract-lifecycle-events", contractId],
    queryFn: async () => {
      if (!contractId) return [];

      const { data, error } = await supabase
        .from("contract_lifecycle_events")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar eventos de lifecycle:", error);
        throw new Error(error.message);
      }

      return (data as unknown as ContractLifecycleEvent[]) || [];
    },
    enabled: !!contractId,
    staleTime: 60 * 1000,
  });
}

/**
 * Busca eventos recentes de todos os contratos (para o feed do Command Center).
 * @param limit Número máximo de eventos (padrão: 20)
 */
export function useRecentLifecycleEvents(limit = 20) {
  return useQuery<(ContractLifecycleEvent & { contracts?: { title: string } })[]>({
    queryKey: ["recent-lifecycle-events", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_lifecycle_events")
        .select("*, contracts(title)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Erro ao buscar eventos recentes:", error);
        throw new Error(error.message);
      }

      return (data as unknown as (ContractLifecycleEvent & { contracts?: { title: string } })[]) || [];
    },
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });
}
