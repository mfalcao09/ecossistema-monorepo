/**
 * useClmDashboard - Hook para o Command Center do CLM
 *
 * Fornece dados consolidados do módulo CLM:
 * - Resumo de contratos por status
 * - Quadrante de urgência (contratos expirando, aprovações pendentes, etc.)
 * - Dashboard de obrigações (vencidas, próximas, etc.)
 * - Aprovações pendentes do usuário logado
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchClmDashboard,
  fetchObligationsDashboard,
  fetchPendingApprovals,
  type ClmDashboardData,
  type ObligationDashboard,
  type ApprovalItem,
} from "@/lib/clmApi";

/** Hook principal do Command Center CLM */
export function useClmDashboard() {
  return useQuery<ClmDashboardData>({
    queryKey: ["clm-dashboard"],
    queryFn: fetchClmDashboard,
    refetchInterval: 5 * 60 * 1000, // 5 min (was 2 min — reduced to avoid cascade)
    staleTime: 2 * 60 * 1000, // 2 min (was 1 min)
    retry: 2,
  });
}

/** Hook para dashboard de obrigações */
export function useClmObligationsDashboard() {
  return useQuery<ObligationDashboard>({
    queryKey: ["clm-obligations-dashboard"],
    queryFn: fetchObligationsDashboard,
    refetchInterval: 5 * 60 * 1000, // 5 min (was 2 min)
    staleTime: 2 * 60 * 1000, // 2 min (was 1 min)
    retry: 2,
  });
}

/** Hook para aprovações pendentes do usuário */
export function useClmPendingApprovals() {
  return useQuery<ApprovalItem[]>({
    queryKey: ["clm-pending-approvals"],
    queryFn: fetchPendingApprovals,
    refetchInterval: 5 * 60 * 1000, // 5 min (was 1 min — was too aggressive)
    staleTime: 2 * 60 * 1000, // 2 min (was 30s)
    retry: 2,
  });
}
