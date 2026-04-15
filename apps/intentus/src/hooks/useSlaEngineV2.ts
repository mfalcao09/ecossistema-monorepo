/**
 * useSlaEngineV2 — Hook para SLA Engine backend (commercial-sla-engine EF).
 * Regras dinâmicas, check_violations, escalation, history.
 * Substitui o useSlaEngine.ts hardcoded.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SlaRules {
  leads: {
    first_response_minutes: number;
    follow_up_hours: number;
    enabled: boolean;
  };
  deals: {
    stage_hours: Record<string, number>;
    max_total_days: number;
    enabled: boolean;
  };
  escalation: {
    warning_threshold_pct: number;
    critical_threshold_pct: number;
    auto_escalate: boolean;
    auto_notify: boolean;
    escalation_targets: string[];
  };
}

export interface SlaViolation {
  entity_type: "lead" | "deal";
  entity_id: string;
  entity_name: string;
  sla_type: "first_response" | "stage_time" | "follow_up" | "total_time";
  sla_target_value: number;
  sla_target_unit: string;
  actual_value: number;
  severity: "critical" | "warning";
  status: string;
  assigned_to: string | null;
  assigned_name: string | null;
}

export interface SlaSummary {
  total_violations: number;
  critical: number;
  warning: number;
  by_type: {
    first_response: number;
    follow_up: number;
    stage_time: number;
    total_time: number;
  };
  escalated: number;
  notified: number;
}

export interface SlaComplianceData {
  first_response_rate: number;
  avg_response_minutes: number;
  total_leads: number;
  responded: number;
  pending_response: number;
}

export interface SlaDashboardData {
  violations: SlaViolation[];
  summary: SlaSummary;
  rules: SlaRules;
  compliance: SlaComplianceData;
}

export interface SlaHistoryEntry {
  id: string;
  trigger_event: string;
  action_type: string;
  action_taken: string;
  status: string;
  created_at: string;
  notes: string | null;
}

// ─── SLA Type Labels ────────────────────────────────────────────────────────

export const SLA_TYPE_LABELS: Record<string, string> = {
  first_response: "Primeiro Contato",
  stage_time: "Tempo no Estágio",
  follow_up: "Follow-up",
  total_time: "Tempo Total",
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
};

export const DEAL_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado_juridico: "Enviado Jurídico",
  em_analise: "Em Análise",
  elaboracao_validacao: "Elaboração/Validação",
  em_validacao: "Em Validação",
  aprovado: "Aprovado",
  em_assinatura: "Em Assinatura",
};

// ─── EF Caller ──────────────────────────────────────────────────────────────

async function callSlaEngine(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("commercial-sla-engine", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useSlaEngineDashboard() {
  return useQuery<SlaDashboardData>({
    queryKey: ["sla-engine-dashboard"],
    queryFn: () => callSlaEngine("get_dashboard"),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useSlaRulesV2() {
  return useQuery<SlaRules>({
    queryKey: ["sla-engine-rules"],
    queryFn: () => callSlaEngine("get_rules"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSlaHistory(limit: number = 50) {
  return useQuery<{ history: SlaHistoryEntry[] }>({
    queryKey: ["sla-engine-history", limit],
    queryFn: () => callSlaEngine("get_history", { limit }),
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateSlaRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rules: Partial<SlaRules>) => callSlaEngine("update_rules", { rules }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sla-engine-rules"] });
      qc.invalidateQueries({ queryKey: ["sla-engine-dashboard"] });
    },
  });
}

export function useCheckSlaViolations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callSlaEngine("check_violations"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sla-engine-dashboard"] });
      qc.invalidateQueries({ queryKey: ["sla-engine-history"] });
    },
  });
}

export function useEscalateSla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { violation_ids: string[]; target_user_id: string }) =>
      callSlaEngine("escalate", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sla-engine-history"] });
    },
  });
}
