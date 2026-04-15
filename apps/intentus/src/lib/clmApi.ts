/**
 * CLM API - Utilitário para chamar Edge Functions do módulo CLM
 *
 * Este arquivo centraliza todas as chamadas às Edge Functions do CLM,
 * facilitando a manutenção e reutilização no frontend.
 *
 * Edge Functions disponíveis:
 * - clm-contract-api: CRUD de contratos + dashboard + transições de status
 * - clm-approvals-api: Workflow de aprovações avançado
 * - clm-obligations-api: Gestão de obrigações contratuais
 * - clm-templates-api: Templates de contrato
 */

import { supabase } from "@/integrations/supabase/client";
import { getAuthContext } from "@/lib/tenantUtils";

// ============================================================
// AUTH + TENANT HELPER
// ============================================================

/**
 * Resolve sessão ativa e tenant_id do usuário.
 * Usa cache compartilhado de tenantUtils (30min TTL) — Phase 2.3 sessão 36.
 */
async function resolveAuthContext(): Promise<{ userId: string; tenantId: string }> {
  return getAuthContext();
}

// ============================================================
// TIPOS COMPARTILHADOS
// ============================================================

export type ContractStatus =
  | "negociacao"
  | "rascunho"
  | "em_revisao"
  | "em_aprovacao"
  | "aguardando_assinatura"
  | "vigencia_pendente"
  | "ativo"
  | "em_alteracao"
  | "renovado"
  | "expirado"
  | "encerrado"
  | "cancelado"
  | "arquivado";

export type ContractType =
  | "venda"
  | "locacao"
  | "administracao"
  | "distrato"
  | "prestacao_servicos"
  | "obra"
  | "comissao"
  | "fornecimento"
  | "aditivo"
  | "cessao"
  | "nda"
  | "exclusividade";

export type ObligationStatus = "pendente" | "cumprida" | "atrasada" | "cancelada";

export type ApprovalStatus = "pendente" | "aprovado" | "rejeitado" | "delegado";

export type ObligationRecurrence =
  | "unica"
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";

// Labels em português para uso no frontend (13 statuses — Phase 4 Enterprise)
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  negociacao: "Negociação",
  rascunho: "Rascunho",
  em_revisao: "Em Revisão",
  em_aprovacao: "Em Aprovação",
  aguardando_assinatura: "Aguardando Assinatura",
  vigencia_pendente: "Vigência Pendente",
  ativo: "Ativo",
  em_alteracao: "Em Alteração",
  renovado: "Renovado",
  expirado: "Expirado",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
  arquivado: "Arquivado",
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  venda: "Venda",
  locacao: "Locação",
  administracao: "Administração",
  distrato: "Distrato",
  prestacao_servicos: "Prestação de Serviços",
  obra: "Obra",
  comissao: "Comissão",
  fornecimento: "Fornecimento",
  aditivo: "Aditivo",
  cessao: "Cessão",
  nda: "NDA",
  exclusividade: "Exclusividade",
};

// Cores para cada status (Tailwind classes — 13 statuses — Phase 4 Enterprise)
export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  negociacao: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  rascunho: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  em_revisao: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  em_aprovacao: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  aguardando_assinatura: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  vigencia_pendente: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ativo: "bg-green-500/10 text-green-400 border-green-500/20",
  em_alteracao: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  renovado: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  expirado: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  encerrado: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  cancelado: "bg-red-500/10 text-red-400 border-red-500/20",
  arquivado: "bg-stone-500/10 text-stone-400 border-stone-500/20",
};

// Fases do lifecycle do contrato (stepper — 13 statuses — Phase 4 Enterprise)
export const CONTRACT_LIFECYCLE_PHASES = [
  { key: "negociacao", label: "Negociação", icon: "MessageSquare" },
  { key: "rascunho", label: "Iniciação", icon: "FileText" },
  { key: "em_revisao", label: "Elaboração", icon: "Edit" },
  { key: "em_aprovacao", label: "Aprovação", icon: "CheckCircle" },
  { key: "aguardando_assinatura", label: "Assinatura", icon: "Pen" },
  { key: "vigencia_pendente", label: "Pré-Vigência", icon: "Clock" },
  { key: "ativo", label: "Vigente", icon: "Shield" },
  { key: "em_alteracao", label: "Alteração", icon: "PenLine" },
  { key: "renovado", label: "Renovado", icon: "RefreshCw" },
  { key: "expirado", label: "Expirado", icon: "AlertTriangle" },
  { key: "encerrado", label: "Encerrado", icon: "Archive" },
  { key: "cancelado", label: "Cancelado", icon: "XCircle" },
  { key: "arquivado", label: "Arquivado", icon: "FolderArchive" },
] as const;

// Transições válidas de status (espelho do banco — allowed_transitions table)
// NOTE: Backend usa DB-driven transitions. Este mapa é referência para UI hints.
// Transições role-restricted (admin/gerente/superadmin) marcadas com comentário.
export const VALID_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  negociacao: ["rascunho", "cancelado"],
  rascunho: ["em_revisao", "cancelado"],
  em_revisao: ["em_aprovacao", "rascunho", "cancelado"],
  em_aprovacao: ["aguardando_assinatura", "em_revisao", "cancelado"],
  aguardando_assinatura: ["vigencia_pendente", "ativo", "em_revisao", "cancelado"],
  vigencia_pendente: ["ativo", "cancelado"],
  ativo: ["em_alteracao", "renovado", "encerrado", "cancelado" /* role-restricted */],
  em_alteracao: ["ativo", "cancelado"],
  renovado: ["ativo", "encerrado"],
  expirado: ["renovado", "encerrado", "arquivado"],
  encerrado: ["arquivado"],
  cancelado: ["arquivado"],
  arquivado: [],
};

// ============================================================
// FUNÇÕES DE CHAMADA DAS EDGE FUNCTIONS
// ============================================================

/**
 * Chamada genérica para Edge Functions do CLM.
 * Automaticamente valida sessão e injeta tenant_id no body.
 */
async function callClmFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  // 1. Valida auth e resolve tenant
  const { tenantId } = await resolveAuthContext();

  // 2. Injeta tenant_id no body (Edge Function pode usar para filtros adicionais)
  const enrichedBody = { ...body, tenant_id: tenantId };

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: enrichedBody,
  });

  if (error) {
    console.error(`Erro ao chamar ${functionName}:`, error);
    throw new Error(error.message || `Erro na chamada ${functionName}`);
  }

  return data as T;
}

// ============================================================
// CLM CONTRACT API
// ============================================================

/** Contrato resumido para listas de urgência */
export interface UrgencyContract {
  id: string;
  contract_type: ContractType;
  status: ContractStatus;
  end_date: string | null;
  total_value: number | null;
  monthly_value: number | null;
  properties?: { title: string } | null;
}

/** Aprovação pendente resumida */
export interface UrgencyApproval {
  id: string;
  contract_id: string;
  step_name: string;
  approver_id: string;
  created_at: string;
}

/** Obrigação resumida */
export interface UrgencyObligation {
  id: string;
  contract_id: string;
  title: string;
  due_date: string;
  obligation_type: string;
}

/** Parcela/pagamento resumido */
export interface UrgencyPayment {
  id: string;
  contract_id: string;
  due_date: string;
  amount: number;
  status: string;
}

/** Evento do lifecycle recente */
export interface LifecycleEvent {
  id: string;
  contract_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
  created_by: string | null;
  notes: string | null;
}

export interface ClmDashboardData {
  summary: Record<string, number>;
  urgency: {
    expiring_soon: UrgencyContract[];
    pending_approvals: UrgencyApproval[];
    overdue_obligations: UrgencyObligation[];
    overdue_payments: UrgencyPayment[];
  };
  recent_alerts: LifecycleEvent[];
}

/** Busca dados do Command Center (dashboard CLM) */
export async function fetchClmDashboard(): Promise<ClmDashboardData> {
  return callClmFunction<ClmDashboardData>("clm-contract-api", {
    action: "dashboard",
  });
}

/** Resultado de uma operação de mutação */
export interface ClmMutationResult {
  success: boolean;
  message?: string;
}

/** Realiza transição de status do contrato */
export async function transitionContractStatus(
  contractId: string,
  newStatus: ContractStatus,
  reason?: string
): Promise<ClmMutationResult> {
  return callClmFunction<ClmMutationResult>("clm-contract-api", {
    action: "transition",
    contract_id: contractId,
    new_status: newStatus,
    reason,
  });
}

// ============================================================
// CLM APPROVALS API
// ============================================================

export interface ApprovalItem {
  id: string;
  contract_id: string;
  step_order: number;
  step_name: string;
  approver_id: string;
  status: ApprovalStatus;
  comments: string | null;
  decided_at: string | null;
}

/** Lista aprovações pendentes do usuário logado */
export async function fetchPendingApprovals(): Promise<ApprovalItem[]> {
  return callClmFunction<ApprovalItem[]>("clm-approvals-api", {
    action: "pending",
  });
}

/** Histórico de aprovações do usuário */
export async function fetchApprovalHistory(): Promise<ApprovalItem[]> {
  return callClmFunction<ApprovalItem[]>("clm-approvals-api", {
    action: "history",
  });
}

/** Aprovar uma etapa */
export async function approveStep(
  approvalId: string,
  comments?: string
): Promise<ClmMutationResult> {
  return callClmFunction<ClmMutationResult>("clm-approvals-api", {
    action: "approve",
    approval_id: approvalId,
    comments,
  });
}

/** Rejeitar uma etapa */
export async function rejectStep(
  approvalId: string,
  comments: string
): Promise<ClmMutationResult> {
  return callClmFunction<ClmMutationResult>("clm-approvals-api", {
    action: "reject",
    approval_id: approvalId,
    comments,
  });
}

/** Delegar aprovação para outro usuário */
export async function delegateApproval(
  approvalId: string,
  delegateToId: string,
  comments?: string
): Promise<ClmMutationResult> {
  return callClmFunction<ClmMutationResult>("clm-approvals-api", {
    action: "delegate",
    approval_id: approvalId,
    delegate_to: delegateToId,
    comments,
  });
}

// ============================================================
// CLM OBLIGATIONS API
// ============================================================

/** Obrigação detalhada para dashboard */
export interface ObligationDetail {
  id: string;
  contract_id: string;
  title: string;
  description: string | null;
  obligation_type: string;
  responsible_party: string;
  due_date: string;
  status: ObligationStatus;
  recurrence: ObligationRecurrence | null;
  alert_days_before: number | null;
}

export interface ObligationDashboard {
  total_active: number;
  overdue: number;
  due_this_week: number;
  due_this_month: number;
  future: number;
  completed_this_month: number;
  by_type: Record<string, number>;
  urgency: {
    overdue: ObligationDetail[];
    due_this_week: ObligationDetail[];
  };
}

/** Busca dashboard de obrigações */
export async function fetchObligationsDashboard(): Promise<ObligationDashboard> {
  return callClmFunction<ObligationDashboard>("clm-obligations-api", {
    action: "dashboard",
  });
}

/** Lista obrigações vencidas */
export async function fetchOverdueObligations(): Promise<ObligationDetail[]> {
  return callClmFunction<ObligationDetail[]>("clm-obligations-api", {
    action: "overdue",
  });
}

/** Lista obrigações próximas do vencimento */
export async function fetchUpcomingObligations(
  days: number = 30
): Promise<ObligationDetail[]> {
  return callClmFunction<ObligationDetail[]>("clm-obligations-api", {
    action: "upcoming",
    days,
  });
}

/** Cria obrigações em lote */
export async function batchCreateObligations(
  contractId: string,
  obligations: Array<{
    title: string;
    description?: string;
    obligation_type: string;
    responsible_party: string;
    due_date: string;
    recurrence?: ObligationRecurrence;
    alert_days_before?: number;
  }>
): Promise<ClmMutationResult> {
  return callClmFunction<ClmMutationResult>("clm-obligations-api", {
    action: "batch-create",
    contract_id: contractId,
    obligations,
  });
}

// ============================================================
// CLM TEMPLATES API
// ============================================================

export interface ContractTemplate {
  id: string;
  name: string;
  template_type: ContractType;
  content: string;
  variables: string[] | null;
  is_active: boolean;
  version: number;
  use_count: number;
}

/** Lista templates disponíveis */
export async function fetchTemplates(): Promise<ContractTemplate[]> {
  return callClmFunction<ContractTemplate[]>("clm-templates-api", {
    action: "list",
  });
}

/** Renderiza um template com variáveis preenchidas */
export async function renderTemplate(
  templateId: string,
  variables: Record<string, string>
): Promise<{ rendered_content: string }> {
  return callClmFunction("clm-templates-api", {
    action: "render",
    template_id: templateId,
    variables,
  });
}
