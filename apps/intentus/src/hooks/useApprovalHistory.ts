/**
 * useApprovalHistory — Hook para histórico de aprovações decididas
 *
 * Wraps fetchApprovalHistory() de clmApi.ts com React Query.
 * Usado pela Central de Aprovações (ClmAprovacoes.tsx).
 *
 * Criado na sessão 49 (14/03/2026).
 */

import { useQuery } from "@tanstack/react-query";
import { fetchApprovalHistory, type ApprovalItem } from "@/lib/clmApi";

export function useApprovalHistory() {
  return useQuery<ApprovalItem[]>({
    queryKey: ["clm-approval-history"],
    queryFn: fetchApprovalHistory,
    staleTime: 60_000, // 1 min
    retry: 2,
  });
}
