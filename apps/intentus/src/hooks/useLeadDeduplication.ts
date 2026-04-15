/**
 * useLeadDeduplication — Hook para detecção de duplicados via EF commercial-lead-dedup.
 * v2: Backend-powered. Substitui a versão 100% frontend.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DuplicateMatch {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf_cnpj: string | null;
  source: string | null;
  status: string | null;
  entity_type: string;
  created_at: string;
  match_types: string[];
  score: number;
}

export interface DuplicateCluster {
  primary_id: string;
  primary_name: string;
  primary_email: string | null;
  primary_phone: string | null;
  entity_type: string;
  cluster_score: number;
  duplicates: DuplicateMatch[];
}

export interface ScanResult {
  clusters: DuplicateCluster[];
  total_clusters: number;
  total_scanned: number;
  scanned_at: string;
}

export interface DedupDashboard {
  total_records: number;
  total_potential_duplicates: number;
  duplicates_by_type: {
    email: number;
    phone: number;
    cpf: number;
    name: number;
  };
  recently_merged: number;
  recently_dismissed: number;
  data_quality_score: number;
  data_completeness_score: number;
  records_with_email: number;
  records_with_phone: number;
  records_with_cpf: number;
}

export interface DedupHistoryEntry {
  id: string;
  automation_name: string;
  action_type: string;
  action_details: Record<string, unknown>;
  status: string;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
}

export interface CheckDuplicateResult {
  matches: DuplicateMatch[];
  found: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const MATCH_TYPE_LABELS: Record<string, string> = {
  cpf: "CPF/CNPJ Idêntico",
  email: "Email Idêntico",
  phone: "Telefone Idêntico",
  name: "Nome Similar",
  name_fuzzy: "Nome Aproximado",
  name_swapped: "Nome Invertido",
};

export const MATCH_TYPE_COLORS: Record<string, string> = {
  cpf: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  email: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  phone: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  name: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  name_fuzzy: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  name_swapped: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

export const CONFIDENCE_THRESHOLDS = { high: 70, medium: 50, low: 30 };

// ─── EF Caller ───────────────────────────────────────────────────────────────

async function callDedup(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("commercial-lead-dedup", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Dashboard com KPIs de duplicação */
export function useDedupDashboard() {
  return useQuery<DedupDashboard>({
    queryKey: ["dedup-dashboard"],
    queryFn: () => callDedup("get_dashboard"),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });
}

/** Scan completo de duplicados */
export function useDuplicateScan() {
  const qc = useQueryClient();
  return useMutation<ScanResult, Error, { min_score?: number }>({
    mutationFn: (params = {}) => callDedup("scan_all", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dedup-dashboard"] });
    },
  });
}

/** Checar se um lead específico tem duplicados (para cadastro) */
export function useCheckDuplicate() {
  return useMutation<CheckDuplicateResult, Error, { name: string; email?: string; phone?: string; cpf_cnpj?: string }>({
    mutationFn: (params) => callDedup("check_duplicate", params),
  });
}

/** Merge de duplicados */
export function useMergeDuplicates() {
  const qc = useQueryClient();
  return useMutation<
    { success: boolean; merged: { primary_id: string; duplicate_id: string; entity_type: string; fields_filled: string[] } },
    Error,
    { primary_id: string; duplicate_id: string; entity_type: string }
  >({
    mutationFn: (params) => callDedup("merge_duplicates", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dedup-dashboard"] });
      qc.invalidateQueries({ queryKey: ["dedup-history"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

/** Dismiss (ignorar) um par de duplicados */
export function useDismissDuplicate() {
  const qc = useQueryClient();
  return useMutation<
    { success: boolean; dismissed: { primary_id: string; duplicate_id: string } },
    Error,
    { primary_id: string; duplicate_id: string }
  >({
    mutationFn: (params) => callDedup("dismiss_duplicate", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dedup-dashboard"] });
      qc.invalidateQueries({ queryKey: ["dedup-history"] });
    },
  });
}

/** Histórico de merges e dismissals */
export function useDedupHistory(limit = 50) {
  return useQuery<{ history: DedupHistoryEntry[] }>({
    queryKey: ["dedup-history", limit],
    queryFn: () => callDedup("get_history", { limit }),
    staleTime: 2 * 60 * 1000,
  });
}
