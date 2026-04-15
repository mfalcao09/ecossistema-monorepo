/**
 * useContractAlerts - Hook para alertas de contratos em tempo real
 *
 * Consome as funções Postgres criadas no backend CLM:
 * - fn_get_contracts_near_expiry() → Contratos perto do vencimento com níveis de alerta
 * - fn_get_overdue_installments_for_collection() → Parcelas em atraso para cobrança
 *
 * Estes dados alimentam o Quadrante de Urgência do Command Center
 * e os indicadores de risco na listagem de contratos.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================
// TIPOS
// ============================================================

export interface ContractExpiryAlert {
  contract_id: string;
  contract_title: string;
  contract_type: string;
  status: string;
  end_date: string;
  days_until_expiry: number;
  alert_level: "critico" | "urgente" | "atencao" | "planejamento";
  monthly_value: number | null;
  total_value: number | null;
  has_active_renewal: boolean;
}

export interface OverdueInstallmentForCollection {
  installment_id: string;
  contract_id: string;
  contract_title: string;
  contract_type: string;
  due_date: string;
  amount: number;
  days_overdue: number;
  rule_id: string;
  rule_name: string;
  action_type: string;
  message_template: string;
}

// ============================================================
// HOOKS
// ============================================================

/**
 * Busca contratos perto do vencimento (90 dias) com nível de alerta.
 * Níveis: critico (≤15d), urgente (≤30d), atencao (≤60d), planejamento (≤90d)
 */
export function useContractsNearExpiry() {
  return useQuery<ContractExpiryAlert[]>({
    queryKey: ["contracts-near-expiry"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_get_contracts_near_expiry");

      if (error) {
        console.error("Erro ao buscar contratos perto do vencimento:", error);
        throw new Error(error.message);
      }

      return (data as ContractExpiryAlert[]) || [];
    },
    refetchInterval: 10 * 60 * 1000, // 10 min (was 5 min — reduced to avoid cascade)
    staleTime: 5 * 60 * 1000, // 5 min (was 2 min)
  });
}

/**
 * Busca parcelas em atraso com regras de cobrança aplicáveis.
 * Retorna a próxima ação de cobrança não executada para cada parcela.
 */
export function useOverdueInstallmentsForCollection() {
  return useQuery<OverdueInstallmentForCollection[]>({
    queryKey: ["overdue-installments-collection"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "fn_get_overdue_installments_for_collection"
      );

      if (error) {
        console.error("Erro ao buscar parcelas em atraso:", error);
        throw new Error(error.message);
      }

      return (data as OverdueInstallmentForCollection[]) || [];
    },
    refetchInterval: 10 * 60 * 1000, // 10 min (was 5 min)
    staleTime: 5 * 60 * 1000, // 5 min (was 2 min)
  });
}

/**
 * Hook combinado que fornece contagem resumida para badges de alerta.
 */
export function useAlertCounts() {
  const expiry = useContractsNearExpiry();
  const overdue = useOverdueInstallmentsForCollection();

  // Single-pass aggregation instead of 4x .filter() (memoized)
  const counts = useMemo(() => {
    let critical = 0, urgent = 0, attention = 0, planning = 0;
    const items = expiry.data ?? [];
    for (const c of items) {
      switch (c.alert_level) {
        case "critico": critical++; break;
        case "urgente": urgent++; break;
        case "atencao": attention++; break;
        case "planejamento": planning++; break;
      }
    }
    const overduePayments = overdue.data?.length ?? 0;
    return {
      critical,
      urgent,
      attention,
      planning,
      totalExpiring: items.length,
      overduePayments,
      totalAlerts: critical + urgent + overduePayments,
    };
  }, [expiry.data, overdue.data]);

  return {
    counts,
    isLoading: expiry.isLoading || overdue.isLoading,
    isError: expiry.isError || overdue.isError,
    refetch: () => {
      expiry.refetch();
      overdue.refetch();
    },
  };
}
