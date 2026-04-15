/**
 * useApprovalWorkflow — Hook para workflow de aprovação de contratos
 *
 * Épico 2 — CLM Fase 2
 *
 * CORREÇÕES APLICADAS (Auditoria CLM — Sessão 32):
 * - tenant_id filter em todas as queries
 * - Authorization check: verifica se user é o approver antes de aprovar/rejeitar
 * - Race condition fix: verifica status antes de update (previne double-approval)
 * - Profile resolution centralizada com cache por sessão
 *
 * Tabela: contract_approvals
 * FKs: contract_id → contracts(id), escalation_user_id → profiles(id)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ApproverStep } from "./useContractApprovalRules";

// NOTA (Fase 2.2 — Unificação): Operações de ESCRITA (approve/reject/delegate)
// foram movidas para useClmLifecycle.ts (via Edge Functions).
// Este hook mantém apenas operações de LEITURA + startWorkflow.

// ── Tipos ───────────────────────────────────────────────────────────────

export interface ContractApprovalStep {
  id: string;
  contract_id: string;
  step_order: number;
  step_name: string;
  approver_id: string;
  status: "pendente" | "aprovado" | "rejeitado";
  decided_at: string | null;
  comments: string | null;
  tenant_id: string;
  created_at: string;
  deadline: string | null;
  escalation_user_id: string | null;
  reminder_sent_at: string | null;
  updated_at: string;
}

export interface PendingApprovalItem extends ContractApprovalStep {
  contract_title: string;
  contract_type: string;
  contract_value: number;
}

export interface StartWorkflowInput {
  contractId: string;
  approverSteps: ApproverStep[];
  approverId: string; // profile.id do aprovador
  tenantId: string;
}

// ── Helper: resolve profile + tenant do usuário autenticado ──────────

interface UserContext {
  userId: string;
  profileId: string;
  tenantId: string;
}

async function resolveUserContext(): Promise<UserContext> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error("Usuário não autenticado");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, tenant_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar perfil: ${error.message}`);
  if (!profile) throw new Error("Perfil não encontrado");
  if (!profile.tenant_id) throw new Error("Tenant não encontrado para o usuário");

  return {
    userId: userData.user.id,
    profileId: profile.id,
    tenantId: profile.tenant_id,
  };
}

// ── Funções de acesso ao Supabase ───────────────────────────────────────

/**
 * Busca todas as aprovações de um contrato, ordenadas por step_order.
 * Filtrado por tenant_id para isolamento multi-tenant.
 */
async function fetchContractApprovals(
  contractId: string
): Promise<ContractApprovalStep[]> {
  const { tenantId } = await resolveUserContext();

  const { data, error } = await supabase
    .from("contract_approvals")
    .select("*")
    .eq("contract_id", contractId)
    .eq("tenant_id", tenantId)
    .order("step_order", { ascending: true });

  if (error)
    throw new Error(`Erro ao buscar aprovações: ${error.message}`);

  return (data ?? []) as ContractApprovalStep[];
}

/**
 * Busca todas as aprovações pendentes do usuário logado (cross-contract).
 * Filtrado por tenant_id + approver_id.
 */
async function fetchMyPendingApprovals(): Promise<PendingApprovalItem[]> {
  const { profileId, tenantId } = await resolveUserContext();

  // Buscar aprovações pendentes deste aprovador + tenant
  const { data, error } = await supabase
    .from("contract_approvals")
    .select("*")
    .eq("approver_id", profileId)
    .eq("tenant_id", tenantId)
    .eq("status", "pendente")
    .order("created_at", { ascending: true });

  if (error)
    throw new Error(`Erro ao buscar aprovações pendentes: ${error.message}`);

  if (!data || data.length === 0) return [];

  // Enriquecer com dados do contrato (também filtrado por tenant)
  const contractIds = [
    ...new Set(data.map((a) => String(a.contract_id))),
  ];

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, title, contract_type, total_value")
    .in("id", contractIds)
    .eq("tenant_id", tenantId);

  const contractMap = new Map(
    (contracts ?? []).map((c) => [c.id, c] as const)
  );

  return data.map((approval) => {
    const contract = contractMap.get(String(approval.contract_id));
    return {
      ...approval,
      contract_title: String(contract?.title ?? "Sem título"),
      contract_type: String(contract?.contract_type ?? ""),
      contract_value: Number(contract?.total_value ?? 0),
    };
  }) as PendingApprovalItem[];
}

/**
 * Iniciar workflow de aprovação para um contrato.
 * Cria os steps de aprovação baseados na regra aplicável.
 *
 * SEGURANÇA (Auditoria Sessão 35 — Phase 1):
 * Usa optimistic locking: atualiza status do contrato PRIMEIRO (lock atômico),
 * depois insere os steps. Se insert falha, faz rollback. Isso previne race
 * condition onde dois requests simultâneos criavam workflows duplicados.
 */
async function startApprovalWorkflow(
  input: StartWorkflowInput
): Promise<ContractApprovalStep[]> {
  const { contractId, approverSteps, approverId, tenantId } = input;

  // STEP 1: Optimistic Lock — Atualiza status PRIMEIRO (lock atômico)
  // Só atualiza se contrato está em status que permite aprovação
  const { data: updatedContracts, error: updateError } = await supabase
    .from("contracts")
    .update({
      status: "em_aprovacao",
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId)
    .eq("tenant_id", tenantId)
    .in("status", ["em_revisao", "rascunho"])
    .select("id");

  if (updateError) {
    throw new Error(`Erro ao atualizar status: ${updateError.message}`);
  }

  // STEP 2: Verificar se lock foi adquirido
  if (!updatedContracts || updatedContracts.length === 0) {
    // Lock falhou — verificar motivo para mensagem de erro precisa
    const { data: contract } = await supabase
      .from("contracts")
      .select("status")
      .eq("id", contractId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const currentStatus = contract?.status;

    if (currentStatus === "em_aprovacao") {
      throw new Error(
        "Este contrato já possui um workflow de aprovação ativo."
      );
    }

    throw new Error(
      currentStatus
        ? `Contrato está em status "${currentStatus}" e não pode ser movido para aprovação.`
        : "Contrato não encontrado."
    );
  }

  // STEP 3: Inserir steps de aprovação (apenas após lock adquirido)
  const steps = approverSteps
    .sort((a, b) => a.step_order - b.step_order)
    .map((step) => ({
      contract_id: contractId,
      step_order: step.step_order,
      step_name: step.step_name,
      approver_id: approverId,
      status: "pendente",
      tenant_id: tenantId,
      deadline: step.deadline_hours
        ? new Date(
            Date.now() + step.deadline_hours * 60 * 60 * 1000
          ).toISOString()
        : null,
    }));

  const { data: insertedSteps, error: insertError } = await supabase
    .from("contract_approvals")
    .insert(steps)
    .select();

  // STEP 4: Rollback se insert falhar
  if (insertError) {
    const { error: rollbackError } = await supabase
      .from("contracts")
      .update({
        status: "em_revisao",
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .eq("tenant_id", tenantId);

    if (rollbackError) {
      console.error("FALHA NO ROLLBACK — atenção manual necessária:", {
        contractId,
        attemptedStatus: "em_revisao",
        rollbackError,
      });
    }

    throw new Error(
      `Erro ao iniciar workflow de aprovação: ${insertError.message}`
    );
  }

  return (insertedSteps ?? []) as ContractApprovalStep[];
}

// ── Hooks React Query ───────────────────────────────────────────────────

const QUERY_KEY = "approval-workflow";

/**
 * Lista aprovações de um contrato específico
 */
export function useContractApprovalSteps(contractId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, "steps", contractId],
    queryFn: () => fetchContractApprovals(contractId!),
    enabled: !!contractId,
    staleTime: 30 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * Lista todas as aprovações pendentes do usuário logado
 */
export function useMyPendingApprovals() {
  return useQuery({
    queryKey: [QUERY_KEY, "my-pending"],
    queryFn: fetchMyPendingApprovals,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

// useApproveStep() e useRejectStep() REMOVIDOS (Fase 2.2).
// Use useClmApprove() e useClmReject() de @/hooks/useClmLifecycle.

/**
 * Mutation para iniciar workflow de aprovação
 */
export function useStartWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startApprovalWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["contract-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["clm-dashboard"] });
    },
  });
}
