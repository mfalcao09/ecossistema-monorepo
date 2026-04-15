/**
 * useClmLifecycle - Hook para transições de status do ciclo de vida do contrato
 *
 * Utiliza a Edge Function clm-contract-api para executar transições
 * validadas entre os 8 status do ciclo de vida:
 *
 * Rascunho → Em Revisão → Em Aprovação → Aguardando Assinatura → Ativo
 *                                                                   ↓
 *                                                        Renovado / Encerrado / Cancelado
 *
 * Cada transição é validada no backend conforme o mapa VALID_TRANSITIONS
 * e registra automaticamente um evento em contract_lifecycle_events.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  transitionContractStatus,
  approveStep,
  rejectStep,
  delegateApproval,
  type ContractStatus,
} from "@/lib/clmApi";

/** Hook para transição de status de contrato */
export function useClmTransition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      newStatus,
      reason,
    }: {
      contractId: string;
      newStatus: ContractStatus;
      reason?: string;
    }) => {
      return transitionContractStatus(contractId, newStatus, reason);
    },
    onSuccess: (_, vars) => {
      // Invalida todas as queries de contratos para refletir a mudança
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", vars.contractId] });
      queryClient.invalidateQueries({ queryKey: ["clm-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["contract-audit-trail", vars.contractId] });

      toast.success("Status do contrato atualizado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(`Erro na transição: ${err.message}`);
    },
  });
}

/** Hook para aprovar etapa via Edge Function */
export function useClmApprove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      approvalId,
      comments,
    }: {
      approvalId: string;
      comments?: string;
      contractId: string;
    }) => {
      return approveStep(approvalId, comments);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["clm-pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["contract-approvals", vars.contractId] });
      queryClient.invalidateQueries({ queryKey: ["approval-workflow"] });
      queryClient.invalidateQueries({ queryKey: ["clm-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["contract-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Aprovação registrada!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao aprovar: ${err.message}`);
    },
  });
}

/** Hook para rejeitar etapa via Edge Function */
export function useClmReject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      approvalId,
      comments,
    }: {
      approvalId: string;
      comments: string;
      contractId: string;
    }) => {
      return rejectStep(approvalId, comments);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["clm-pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["contract-approvals", vars.contractId] });
      queryClient.invalidateQueries({ queryKey: ["approval-workflow"] });
      queryClient.invalidateQueries({ queryKey: ["clm-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["contract-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Rejeição registrada. Contrato retorna para revisão.");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao rejeitar: ${err.message}`);
    },
  });
}

/** Hook para delegar aprovação */
export function useClmDelegate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      approvalId,
      delegateToId,
      comments,
    }: {
      approvalId: string;
      delegateToId: string;
      comments?: string;
      contractId: string;
    }) => {
      return delegateApproval(approvalId, delegateToId, comments);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["clm-pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["contract-approvals", vars.contractId] });
      queryClient.invalidateQueries({ queryKey: ["approval-workflow"] });
      queryClient.invalidateQueries({ queryKey: ["clm-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["contract-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Aprovação delegada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao delegar: ${err.message}`);
    },
  });
}
