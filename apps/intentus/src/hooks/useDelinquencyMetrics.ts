/**
 * useDelinquencyMetrics — Métricas de inadimplência e cobrança
 *
 * Agrega dados de parcelas para fornecer KPIs de cobrança:
 * - Total a receber (pendentes + atrasadas)
 * - Total inadimplente (atrasadas)
 * - Taxa de inadimplência
 * - Aging buckets (1-30, 31-60, 61-90, 90+ dias)
 * - Ranking de contratos com mais parcelas em atraso
 *
 * Tabela: contract_installments
 * installment_status enum: pendente | pago | atrasado | cancelado
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────
export interface DelinquencyKPIs {
  totalReceivable: number;        // soma amount de pendentes + atrasadas
  totalOverdue: number;           // soma amount de atrasadas + pendentes vencidas
  totalPaidPeriod: number;        // soma paid_amount do período
  overdueCount: number;           // qtd parcelas em atraso
  overdueRate: number;            // % inadimplência (overdue / total ativas)
  avgDaysOverdue: number;         // média dias de atraso
}

export interface AgingBucket {
  label: string;
  range: string;
  count: number;
  amount: number;
  color: string;
}

export interface OverdueContract {
  contractId: string;
  contractTitle: string;
  contractType: string;
  overdueCount: number;
  overdueAmount: number;
  oldestDueDate: string;
  maxDaysOverdue: number;
}

export interface OverdueInstallment {
  id: string;
  contractId: string;
  contractTitle: string;
  contractType: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  daysOverdue: number;
  status: string;
  revenueType: string;
}

// ── Fetch KPIs ─────────────────────────────────────────────────────────
async function fetchDelinquencyKPIs(): Promise<DelinquencyKPIs> {
  const today = new Date().toISOString().split("T")[0];

  // All active installments (not cancelled)
  const { data: installments, error } = await supabase
    .from("contract_installments")
    .select("id, amount, paid_amount, status, due_date")
    .neq("status", "cancelado");

  if (error) throw error;
  if (!installments || installments.length === 0) {
    return {
      totalReceivable: 0, totalOverdue: 0, totalPaidPeriod: 0,
      overdueCount: 0, overdueRate: 0, avgDaysOverdue: 0,
    };
  }

  let totalReceivable = 0;
  let totalOverdue = 0;
  let totalPaid = 0;
  let overdueCount = 0;
  let totalDaysOverdue = 0;

  for (const inst of installments) {
    const amount = Number(inst.amount) || 0;
    const paidAmount = Number(inst.paid_amount) || 0;

    if (inst.status === "pago") {
      totalPaid += paidAmount;
    } else {
      // pendente or atrasado
      totalReceivable += amount;
      const isOverdue = inst.status === "atrasado" ||
                        (inst.status === "pendente" && inst.due_date < today);
      if (isOverdue) {
        totalOverdue += amount;
        overdueCount++;
        const days = Math.max(0, Math.floor(
          (Date.now() - new Date(inst.due_date).getTime()) / 86400000
        ));
        totalDaysOverdue += days;
      }
    }
  }

  const activeCount = installments.filter(i => i.status !== "pago").length;
  const overdueRate = activeCount > 0 ? (overdueCount / activeCount) * 100 : 0;
  const avgDaysOverdue = overdueCount > 0 ? totalDaysOverdue / overdueCount : 0;

  return {
    totalReceivable,
    totalOverdue,
    totalPaidPeriod: totalPaid,
    overdueCount,
    overdueRate: Math.round(overdueRate * 10) / 10,
    avgDaysOverdue: Math.round(avgDaysOverdue),
  };
}

// ── Fetch Aging Buckets ────────────────────────────────────────────────
async function fetchAgingBuckets(): Promise<AgingBucket[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("contract_installments")
    .select("id, amount, due_date, status")
    .or(`status.eq.atrasado,and(status.eq.pendente,due_date.lt.${today})`);

  if (error) throw error;

  const buckets: AgingBucket[] = [
    { label: "1-30 dias", range: "1-30", count: 0, amount: 0, color: "#f59e0b" },
    { label: "31-60 dias", range: "31-60", count: 0, amount: 0, color: "#f97316" },
    { label: "61-90 dias", range: "61-90", count: 0, amount: 0, color: "#ef4444" },
    { label: "90+ dias", range: "90+", count: 0, amount: 0, color: "#991b1b" },
  ];

  for (const inst of data || []) {
    const days = Math.max(0, Math.floor(
      (Date.now() - new Date(inst.due_date).getTime()) / 86400000
    ));
    const amount = Number(inst.amount) || 0;

    if (days <= 30) { buckets[0].count++; buckets[0].amount += amount; }
    else if (days <= 60) { buckets[1].count++; buckets[1].amount += amount; }
    else if (days <= 90) { buckets[2].count++; buckets[2].amount += amount; }
    else { buckets[3].count++; buckets[3].amount += amount; }
  }

  return buckets;
}

// ── Fetch Overdue Contracts Ranking ────────────────────────────────────
async function fetchOverdueContracts(): Promise<OverdueContract[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("contract_installments")
    .select(`
      id, contract_id, amount, due_date, status,
      contract:contracts!inner (title, contract_type)
    `)
    .or(`status.eq.atrasado,and(status.eq.pendente,due_date.lt.${today})`);

  if (error) throw error;
  if (!data) return [];

  // Group by contract
  const grouped = new Map<string, OverdueContract>();
  for (const inst of data) {
    const contract = inst.contract as any;
    const existing = grouped.get(inst.contract_id);
    const days = Math.max(0, Math.floor(
      (Date.now() - new Date(inst.due_date).getTime()) / 86400000
    ));
    const amount = Number(inst.amount) || 0;

    if (existing) {
      existing.overdueCount++;
      existing.overdueAmount += amount;
      if (inst.due_date < existing.oldestDueDate) existing.oldestDueDate = inst.due_date;
      if (days > existing.maxDaysOverdue) existing.maxDaysOverdue = days;
    } else {
      grouped.set(inst.contract_id, {
        contractId: inst.contract_id,
        contractTitle: contract?.title || "—",
        contractType: contract?.contract_type || "—",
        overdueCount: 1,
        overdueAmount: amount,
        oldestDueDate: inst.due_date,
        maxDaysOverdue: days,
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.overdueAmount - a.overdueAmount);
}

// ── Fetch All Overdue Installments ─────────────────────────────────────
async function fetchOverdueInstallments(): Promise<OverdueInstallment[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("contract_installments")
    .select(`
      id, contract_id, installment_number, due_date, amount, status, revenue_type,
      contract:contracts!inner (title, contract_type)
    `)
    .or(`status.eq.atrasado,and(status.eq.pendente,due_date.lt.${today})`)
    .order("due_date", { ascending: true });

  if (error) throw error;

  return (data || []).map((inst) => {
    const contract = inst.contract as any;
    return {
      id: inst.id,
      contractId: inst.contract_id,
      contractTitle: contract?.title || "—",
      contractType: contract?.contract_type || "—",
      installmentNumber: inst.installment_number,
      dueDate: inst.due_date,
      amount: Number(inst.amount),
      daysOverdue: Math.max(0, Math.floor(
        (Date.now() - new Date(inst.due_date).getTime()) / 86400000
      )),
      status: inst.status,
      revenueType: inst.revenue_type,
    };
  });
}

// ── Hooks ──────────────────────────────────────────────────────────────
export function useDelinquencyKPIs() {
  return useQuery({
    queryKey: ["delinquency-kpis"],
    queryFn: fetchDelinquencyKPIs,
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });
}

export function useAgingBuckets() {
  return useQuery({
    queryKey: ["aging-buckets"],
    queryFn: fetchAgingBuckets,
  });
}

export function useOverdueContracts() {
  return useQuery({
    queryKey: ["overdue-contracts"],
    queryFn: fetchOverdueContracts,
  });
}

export function useOverdueInstallments() {
  return useQuery({
    queryKey: ["overdue-installments"],
    queryFn: fetchOverdueInstallments,
  });
}
