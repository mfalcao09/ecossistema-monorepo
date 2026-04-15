import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContractKPIs {
  totalContracts: number;
  activeContracts: number;
  totalValue: number;
  activeValue: number;
  overdueInstallments: number;
  overdueAmount: number;
  pendingApprovals: number;
  expiringNext30Days: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  paidAmount: number;
  receivableAmount: number;
}

export interface ContractKPIFilters {
  dateFrom?: string;
  dateTo?: string;
  contractType?: string;
  status?: string;
  propertyId?: string;
}

async function fetchContractKPIs(filters: ContractKPIFilters): Promise<ContractKPIs> {
  // Base query for contracts (with limit for safety)
  let contractsQuery = supabase
    .from("contracts")
    .select("id, status, contract_type, total_value, end_date")
    .is("deleted_at", null)
    .limit(2000);

  if (filters.contractType) {
    contractsQuery = contractsQuery.eq("contract_type", filters.contractType);
  }
  if (filters.status) {
    contractsQuery = contractsQuery.eq("status", filters.status);
  }
  if (filters.propertyId) {
    contractsQuery = contractsQuery.eq("property_id", filters.propertyId);
  }
  if (filters.dateFrom) {
    contractsQuery = contractsQuery.gte("start_date", filters.dateFrom);
  }
  if (filters.dateTo) {
    contractsQuery = contractsQuery.lte("start_date", filters.dateTo);
  }

  const { data: contracts, error: contractsError } = await contractsQuery;
  if (contractsError) throw contractsError;

  const contractList = contracts || [];
  const contractIds = contractList.map((c) => c.id);

  // Installments aggregation — FILTERED by contract IDs (not global!)
  let installmentList: Array<{ status: string; amount: number; paid_amount: number; due_date: string; contract_id: string }> = [];
  if (contractIds.length > 0) {
    // Supabase .in() has a limit of ~300 items; batch if needed
    const batchSize = 200;
    const batches: string[][] = [];
    for (let i = 0; i < contractIds.length; i += batchSize) {
      batches.push(contractIds.slice(i, i + batchSize));
    }
    const results = await Promise.all(
      batches.map((batch) =>
        supabase
          .from("contract_installments")
          .select("status, amount, paid_amount, due_date, contract_id")
          .in("contract_id", batch)
      )
    );
    for (const r of results) {
      if (r.error) throw r.error;
      if (r.data) installmentList.push(...r.data);
    }
  }

  // Pending approvals count
  const { count: pendingApprovals, error: approvalsError } = await supabase
    .from("contract_approvals")
    .select("*", { count: "exact", head: true })
    .eq("status", "pendente");
  if (approvalsError) throw approvalsError;

  // Single-pass aggregation for contracts
  const activeStatuses = new Set(["ativo", "em_revisao", "em_aprovacao", "aguardando_assinatura"]);
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let activeCount = 0;
  let totalValue = 0;
  let activeValue = 0;
  let expiringNext30Days = 0;

  const today = new Date().toISOString().split("T")[0];
  const next30Days = new Date();
  next30Days.setDate(next30Days.getDate() + 30);
  const next30Str = next30Days.toISOString().split("T")[0];

  for (const c of contractList) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    byType[c.contract_type] = (byType[c.contract_type] || 0) + 1;
    const val = Number(c.total_value || 0);
    totalValue += val;
    if (activeStatuses.has(c.status)) {
      activeCount++;
      activeValue += val;
    }
    if (c.status === "ativo" && c.end_date && c.end_date >= today && c.end_date <= next30Str) {
      expiringNext30Days++;
    }
  }

  // Single-pass aggregation for installments
  let overdueCount = 0;
  let overdueAmount = 0;
  let paidAmount = 0;
  let receivableAmount = 0;

  for (const i of installmentList) {
    const isOverdue = i.status === "atrasado" || (i.status === "pendente" && i.due_date < today);
    if (isOverdue) {
      overdueCount++;
      overdueAmount += Number(i.amount || 0);
    }
    if (i.status === "pago") {
      paidAmount += Number(i.paid_amount || 0);
    }
    if (i.status === "pendente" || i.status === "atrasado") {
      receivableAmount += Number(i.amount || 0);
    }
  }

  return {
    totalContracts: contractList.length,
    activeContracts: activeCount,
    totalValue,
    activeValue,
    overdueInstallments: overdueCount,
    overdueAmount,
    pendingApprovals: pendingApprovals || 0,
    expiringNext30Days,
    byStatus,
    byType,
    paidAmount,
    receivableAmount,
  };
}

export function useContractKPIs(filters: ContractKPIFilters = {}) {
  // Stable query key — serialize filter values to primitives to avoid infinite refetch
  const stableKey = useMemo(
    () => [
      "contract-kpis",
      filters.dateFrom ?? "",
      filters.dateTo ?? "",
      filters.contractType ?? "",
      filters.status ?? "",
      filters.propertyId ?? "",
    ],
    [filters.dateFrom, filters.dateTo, filters.contractType, filters.status, filters.propertyId]
  );

  return useQuery({
    queryKey: stableKey,
    queryFn: () => fetchContractKPIs(filters),
    refetchInterval: 10 * 60 * 1000, // 10 min (was 5 min — reduced to avoid cascade)
    staleTime: 5 * 60 * 1000, // 5 min (was 2 min)
  });
}
