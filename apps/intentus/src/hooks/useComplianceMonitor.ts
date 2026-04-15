import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────────────────

export interface ComplianceRuleResult {
  rule_code: string;
  rule_name: string;
  module: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "pass" | "fail" | "warning" | "not_applicable";
  description: string;
  legal_basis?: string;
  remediation?: string;
}

export interface CorrectiveAction {
  priority: "alta" | "média" | "baixa";
  action: string;
  module: string;
  estimated_effort: string;
}

export interface ComplianceScanResult {
  action: "scan_contract";
  contract_id: string;
  score: number;
  total_rules: number;
  passed: number;
  failed: number;
  warnings: number;
  not_applicable: number;
  rules: ComplianceRuleResult[];
  corrective_actions: CorrectiveAction[];
  check_id?: string;
}

export interface ComplianceViolation {
  id: string;
  contract_id: string;
  rule_code: string;
  rule_name: string;
  module: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  status: "open" | "acknowledged" | "resolved" | "waived" | "false_positive";
  description: string;
  legal_basis?: string;
  remediation?: string;
  created_at: string;
}

export interface ComplianceContractSummary {
  contract_id: string;
  score: number;
  failed: number;
  warnings: number;
  last_checked: string;
  corrective_actions: CorrectiveAction[];
}

export interface ComplianceDashboardData {
  action: "get_dashboard";
  summary: {
    total_contracts: number;
    avg_score: number;
    contracts_compliant: number;
    contracts_at_risk: number;
    total_open_violations: number;
    violations_by_severity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
    };
    violations_by_module: Record<string, number>;
  };
  contracts: ComplianceContractSummary[];
  open_violations: ComplianceViolation[];
  recent_history: Array<{
    id: string;
    contract_id: string;
    overall_score: number;
    failed: number;
    warnings: number;
    created_at: string;
  }>;
}

// ── Hook: Dashboard ─────────────────────────────────────────────────────

export function useComplianceDashboard() {
  return useQuery<ComplianceDashboardData>({
    queryKey: ["compliance-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "clm-compliance-monitor",
        { body: { action: "get_dashboard" } },
      );
      if (error) throw error;
      return data as ComplianceDashboardData;
    },
    staleTime: 60_000,
    retry: 2,
    refetchInterval: 10 * 60 * 1000,
  });
}

// ── Hook: Scan Contract (on-demand) ─────────────────────────────────────

export function useScanContract() {
  const queryClient = useQueryClient();

  return useMutation<ComplianceScanResult, Error, string>({
    mutationFn: async (contractId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "clm-compliance-monitor",
        { body: { action: "scan_contract", contract_id: contractId } },
      );
      if (error) throw error;
      return data as ComplianceScanResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["compliance-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["compliance-contract", data.contract_id] });
      const emoji = data.score >= 80 ? "✅" : data.score >= 60 ? "⚠️" : "🚨";
      toast.success(`${emoji} Compliance: ${data.score}/100 — ${data.failed} violação(ões), ${data.warnings} alerta(s)`);
    },
    onError: (err) => {
      toast.error(`Erro ao escanear compliance: ${err.message}`);
    },
  });
}

// ── Hook: Resolve Violation ─────────────────────────────────────────────

interface ResolveViolationParams {
  violation_id: string;
  resolution_status: "resolved" | "waived" | "false_positive" | "acknowledged";
  resolution_notes?: string;
}

export function useResolveViolation() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, ResolveViolationParams>({
    mutationFn: async (params) => {
      const { data, error } = await supabase.functions.invoke(
        "clm-compliance-monitor",
        { body: { action: "resolve_violation", ...params } },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-dashboard"] });
      toast.success("Violação atualizada com sucesso");
    },
    onError: (err) => {
      toast.error(`Erro ao resolver violação: ${err.message}`);
    },
  });
}
