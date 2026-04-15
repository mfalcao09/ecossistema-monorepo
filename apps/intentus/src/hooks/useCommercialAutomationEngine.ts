/**
 * Hook e helpers para o motor de automações comerciais v2.
 * Conecta o frontend à Edge Function `commercial-automation-engine`.
 *
 * Exports:
 *   — Queries
 *   useAutomationLogs(automationId?)      — histórico de execuções
 *   useAutomationDashboard()              — KPIs e métricas do engine
 *
 *   — Mutations
 *   useTriggerAutomation()                — dispara trigger manualmente
 *   useCheckScheduled()                   — executa automações com delay pendente
 *   useCheckTimeTriggers()                — verifica triggers baseados em tempo
 *   useCreateAutomation()                 — cria nova automação (com steps)
 *   useUpdateAutomation()                 — atualiza automação existente
 *
 *   — Helpers
 *   triggerCommercialEvent()              — fire-and-forget para wiring em hooks existentes
 *
 *   — Constants
 *   TRIGGER_LABELS, ACTION_LABELS, TRIGGER_OPTIONS, ACTION_OPTIONS
 *
 * Sessão 74 — Pair programming Claudinho + Buchecha (MiniMax M2.5)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ============================================================
// Types — Core
// ============================================================

export type EntityType = "lead" | "deal" | "contract";

export type TriggerEvent =
  | "lead_criado"
  | "visita_realizada"
  | "proposta_enviada"
  | "sem_contato_x_dias"
  | "aniversario_contrato"
  | "deal_criado"
  | "deal_movido_pipeline"
  | "deal_ganho"
  | "deal_perdido"
  | "pagamento_recebido"
  | "pagamento_atrasado"
  | "documento_assinado";

export type ActionType =
  | "tarefa"
  | "notificacao"
  | "lembrete"
  | "email"
  | "mover_deal"
  | "atribuir_responsavel"
  | "atualizar_campo"
  | "webhook";

export type AutomationType = "simples" | "sequencia";

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "not_contains"
  | "in"
  | "exists";

// ============================================================
// Types — Conditions
// ============================================================

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface ConditionGroup {
  match: "all" | "any";
  conditions: Condition[];
}

// ============================================================
// Types — Automation Steps (sequências multi-step)
// ============================================================

export interface AutomationStep {
  id?: string;
  step_order: number;
  delay_minutes: number;
  action_type: ActionType;
  action_config: Record<string, unknown>;
  conditions?: ConditionGroup | null;
  is_active: boolean;
}

// ============================================================
// Types — Automation (full entity)
// ============================================================

export interface CommercialAutomation {
  id: string;
  tenant_id: string;
  name: string;
  trigger_event: TriggerEvent;
  delay_days: number;
  action_type: ActionType;
  active: boolean;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  conditions: ConditionGroup | null;
  automation_type: AutomationType;
  description: string | null;
  steps?: AutomationStep[];
}

// ============================================================
// Types — API Params & Responses
// ============================================================

export interface ExecuteTriggerParams {
  trigger_event: string;
  entity_id: string;
  entity_type: EntityType;
  entity_data?: Record<string, unknown>;
}

interface AutomationResult {
  automation_id: string;
  automation_name: string;
  status: string;
  action_type: string;
  error?: string;
}

interface ExecuteTriggerResponse {
  triggered: number;
  results: AutomationResult[];
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  automation_name: string;
  trigger_event: string;
  action_type: string;
  lead_id: string | null;
  person_id: string | null;
  triggered_at: string;
  action_taken: string;
  status: string;
  notes: string | null;
}

interface GetLogsResponse {
  logs: AutomationLog[];
  total: number;
}

interface ScheduledResult {
  log_id: string;
  automation_name: string;
  status: string;
  error?: string;
}

interface CheckScheduledResponse {
  processed: number;
  results: ScheduledResult[];
}

interface CheckTimeTriggersResponse {
  sem_contato: { triggered: number };
  aniversario: { triggered: number };
}

export interface AutomationDashboard {
  total_automations: number;
  active_automations: number;
  executions_24h: number;
  executions_7d: number;
  success_rate_24h: number;
  success_rate_7d: number;
  failed_24h: number;
  pending_scheduled: number;
  top_automations: Array<{
    id: string;
    name: string;
    trigger_event: string;
    executions: number;
    success_rate: number;
  }>;
  recent_failures: Array<{
    id: string;
    automation_name: string;
    trigger_event: string;
    action_type: string;
    notes: string | null;
    triggered_at: string;
  }>;
}

export interface CreateAutomationParams {
  name: string;
  trigger_event: TriggerEvent;
  delay_days?: number;
  action_type: ActionType;
  conditions?: ConditionGroup | null;
  automation_type?: AutomationType;
  description?: string;
  steps?: Omit<AutomationStep, "id">[];
}

export interface UpdateAutomationParams {
  id: string;
  name?: string;
  trigger_event?: TriggerEvent;
  delay_days?: number;
  action_type?: ActionType;
  active?: boolean;
  conditions?: ConditionGroup | null;
  automation_type?: AutomationType;
  description?: string;
}

// ============================================================
// Constants — Labels & Options
// ============================================================

export const TRIGGER_LABELS: Record<string, string> = {
  lead_criado: "Lead Criado",
  visita_realizada: "Visita Realizada",
  proposta_enviada: "Proposta Enviada",
  sem_contato_x_dias: "Sem Contato (X dias)",
  aniversario_contrato: "Aniversário de Contrato",
  deal_criado: "Deal Criado",
  deal_movido_pipeline: "Deal Movido no Pipeline",
  deal_ganho: "Deal Ganho",
  deal_perdido: "Deal Perdido",
  pagamento_recebido: "Pagamento Recebido",
  pagamento_atrasado: "Pagamento Atrasado",
  documento_assinado: "Documento Assinado",
};

export const ACTION_LABELS: Record<string, string> = {
  tarefa: "Criar Tarefa",
  notificacao: "Enviar Notificação",
  lembrete: "Criar Lembrete",
  email: "Enviar E-mail",
  mover_deal: "Mover Deal no Pipeline",
  atribuir_responsavel: "Atribuir Responsável",
  atualizar_campo: "Atualizar Campo",
  webhook: "Disparar Webhook",
};

export const TRIGGER_OPTIONS = Object.entries(TRIGGER_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const CONDITION_OPERATORS: Record<ConditionOperator, string> = {
  eq: "Igual a",
  neq: "Diferente de",
  gt: "Maior que",
  lt: "Menor que",
  gte: "Maior ou igual a",
  lte: "Menor ou igual a",
  contains: "Contém",
  not_contains: "Não contém",
  in: "Está na lista",
  exists: "Existe",
};

// ============================================================
// Helper — invoca a Edge Function
// ============================================================

async function invokeAutomationEngine<T>(
  action: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "commercial-automation-engine",
    { body: { action, ...params } },
  );

  if (error) {
    console.error(`Erro ao executar ação ${action}:`, error);
    throw error;
  }

  return data as T;
}

// ============================================================
// Query Hooks
// ============================================================

/**
 * Query de logs de automação.
 * Se `automationId` for passado, filtra por automação específica.
 */
export function useAutomationLogs(automationId?: string) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["automation-logs", tenantId, automationId],
    queryFn: async (): Promise<GetLogsResponse> => {
      if (!tenantId) throw new Error("Tenant ID não disponível");
      return invokeAutomationEngine<GetLogsResponse>("get_logs", {
        automation_id: automationId,
      });
    },
    enabled: !!tenantId,
    staleTime: 30_000,
    retry: 2,
  });
}

/**
 * Query de dashboard — KPIs e métricas do engine de automações.
 */
export function useAutomationDashboard() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["automation-dashboard", tenantId],
    queryFn: async (): Promise<AutomationDashboard> => {
      if (!tenantId) throw new Error("Tenant ID não disponível");
      return invokeAutomationEngine<AutomationDashboard>("get_dashboard");
    },
    enabled: !!tenantId,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
}

// ============================================================
// Mutation Hooks
// ============================================================

/**
 * Mutation: dispara um trigger de automação.
 * Usa via `mutate({ trigger_event, entity_id, entity_type, entity_data? })`.
 */
export function useTriggerAutomation() {
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async (
      params: ExecuteTriggerParams,
    ): Promise<ExecuteTriggerResponse> => {
      if (!tenantId) throw new Error("Tenant ID não disponível");
      return invokeAutomationEngine<ExecuteTriggerResponse>(
        "execute_trigger",
        params,
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["automation-logs", tenantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["automation-dashboard", tenantId],
      });
      if (data.triggered > 0) {
        toast.success(`${data.triggered} automação(ões) disparada(s)`);
      }
    },
    onError: (error) => {
      toast.error("Erro ao executar automação");
      console.error(error);
    },
  });
}

/**
 * Mutation: verifica e executa automações com delay pendente.
 * Chamado pelo pg_cron (hourly) ou manualmente.
 */
export function useCheckScheduled() {
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async (): Promise<CheckScheduledResponse> => {
      if (!tenantId) throw new Error("Tenant ID não disponível");
      return invokeAutomationEngine<CheckScheduledResponse>("check_scheduled");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["automation-logs", tenantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["automation-dashboard", tenantId],
      });
      if (data.processed > 0) {
        toast.info(`${data.processed} automação(ões) agendada(s) processada(s)`);
      }
    },
    onError: (error) => {
      toast.error("Erro ao verificar automações agendadas");
      console.error("Erro ao verificar automações agendadas:", error);
    },
  });
}

/**
 * Mutation: verifica triggers baseados em tempo (sem_contato_x_dias, aniversario_contrato).
 * Chamado pelo pg_cron (daily) ou manualmente.
 */
export function useCheckTimeTriggers() {
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async (): Promise<CheckTimeTriggersResponse> => {
      if (!tenantId) throw new Error("Tenant ID não disponível");
      return invokeAutomationEngine<CheckTimeTriggersResponse>(
        "check_time_triggers",
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["automation-logs", tenantId],
      });
      const total = data.sem_contato.triggered + data.aniversario.triggered;
      if (total > 0) {
        toast.info(`${total} trigger(s) de tempo executado(s)`);
      }
    },
    onError: (error) => {
      toast.error("Erro ao verificar triggers de tempo");
      console.error("Erro ao verificar triggers de tempo:", error);
    },
  });
}

/**
 * Mutation: cria nova automação (com steps opcionais para sequências).
 */
export function useCreateAutomation() {
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async (
      params: CreateAutomationParams,
    ): Promise<CommercialAutomation> => {
      if (!tenantId) throw new Error("Tenant ID não disponível");
      return invokeAutomationEngine<CommercialAutomation>(
        "create_automation",
        params as unknown as Record<string, unknown>,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["commercial-automations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["automation-dashboard", tenantId],
      });
      toast.success("Automação criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar automação");
      console.error(error);
    },
  });
}

/**
 * Mutation: atualiza automação existente.
 */
export function useUpdateAutomation() {
  const queryClient = useQueryClient();
  const { tenantId } = useAuth();

  return useMutation({
    mutationFn: async (
      params: UpdateAutomationParams,
    ): Promise<CommercialAutomation> => {
      if (!tenantId) throw new Error("Tenant ID não disponível");
      return invokeAutomationEngine<CommercialAutomation>(
        "update_automation",
        params as unknown as Record<string, unknown>,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["commercial-automations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["automation-dashboard", tenantId],
      });
      toast.success("Automação atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar automação");
      console.error(error);
    },
  });
}

// ============================================================
// Fire-and-forget helper — para wiring em hooks existentes
// ============================================================

/**
 * Dispara um evento comercial de forma fire-and-forget.
 * Use nos onSuccess de mutations como useCreateLead, useCreateDeal, etc.
 *
 * Exemplo:
 *   onSuccess: (newLead) => {
 *     triggerCommercialEvent("lead_criado", newLead.id, "lead");
 *   }
 *
 * Triggers v2 suportados:
 *   lead_criado, visita_realizada, proposta_enviada,
 *   sem_contato_x_dias, aniversario_contrato,
 *   deal_criado, deal_movido_pipeline, deal_ganho, deal_perdido,
 *   pagamento_recebido, pagamento_atrasado, documento_assinado
 */
export async function triggerCommercialEvent(
  triggerEvent: string,
  entityId: string,
  entityType: EntityType,
  entityData?: Record<string, unknown>,
): Promise<ExecuteTriggerResponse | null> {
  try {
    return await invokeAutomationEngine<ExecuteTriggerResponse>(
      "execute_trigger",
      {
        trigger_event: triggerEvent,
        entity_id: entityId,
        entity_type: entityType,
        entity_data: entityData,
      },
    );
  } catch (error) {
    // Fire-and-forget: loga mas não quebra o fluxo principal
    console.warn(`Falha ao disparar trigger ${triggerEvent}:`, error);
    return null;
  }
}
