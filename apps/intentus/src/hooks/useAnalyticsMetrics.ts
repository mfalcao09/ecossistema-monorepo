/**
 * useAnalyticsMetrics.ts — Hooks focados para CLM Analytics
 * Criado do zero na sessão 70 (15/03/2026).
 *
 * Cada hook faz UMA query leve com:
 * - tenant_id isolation
 * - .limit() explícito
 * - staleTime >= 3min, refetchInterval >= 10min
 * - Number() parsing para colunas numeric do PostgreSQL
 * - retry: 1
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { differenceInDays, subMonths, format, startOfMonth } from "date-fns";

// ============================================================
// SHARED HELPERS
// ============================================================

const STALE = 3 * 60 * 1000; // 3 min
const REFETCH = 10 * 60 * 1000; // 10 min
const QUERY_OPTS = { staleTime: STALE, refetchInterval: REFETCH, retry: 1 as const };

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ============================================================
// TYPES
// ============================================================

export interface AnalyticsContract {
  id: string;
  status: string;
  contract_type: string | null;
  monthly_value: number;
  start_date: string | null;
  end_date: string | null;
  adjustment_index: string | null;
  termination_penalty_rate: number;
  created_at: string;
  property_id: string | null;
}

export interface AuditEntry {
  id: string;
  contract_id: string;
  action: string;
  field_changed: string | null;
  created_at: string;
}

export interface ApprovalEntry {
  id: string;
  contract_id: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  step_name: string | null;
  approver_id: string | null;
}

export interface ObligationEntry {
  id: string;
  contract_id: string;
  title: string;
  status: string;
  due_date: string | null;
  obligation_type: string | null;
}

export interface PartyEntry {
  contract_id: string;
  person_id: string;
  role: string;
}

export interface RedliningLite {
  id: string;
  contract_id: string;
  clause_name: string;
  status: string;
}

// ============================================================
// 1) CONTRACTS BASE — query leve, 11 colunas, ZERO JOINs
// ============================================================

export function useAnalyticsContracts() {
  return useQuery({
    queryKey: ["analytics-contracts"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contracts")
        .select("id, status, contract_type, monthly_value, start_date, end_date, adjustment_index, termination_penalty_rate, created_at, property_id")
        .eq("tenant_id", tenantId)
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((c) => ({
        ...c,
        monthly_value: num(c.monthly_value),
        termination_penalty_rate: num(c.termination_penalty_rate),
      })) as AnalyticsContract[];
    },
    ...QUERY_OPTS,
  });
}

// ============================================================
// 2) AUDIT TRAIL — para Revenue Leakage + Retrabalho
// ============================================================

export function useAnalyticsAuditTrail() {
  return useQuery({
    queryKey: ["analytics-audit-trail"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_audit_trail")
        .select("id, contract_id, action, field_changed, created_at")
        .eq("tenant_id", tenantId)
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as AuditEntry[];
    },
    ...QUERY_OPTS,
  });
}

// ============================================================
// 3) APPROVALS — para SLA + Velocity por Gestor
// ============================================================

export function useAnalyticsApprovals() {
  return useQuery({
    queryKey: ["analytics-approvals"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_approvals")
        .select("id, contract_id, status, created_at, decided_at, step_name, approver_id")
        .eq("tenant_id", tenantId)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ApprovalEntry[];
    },
    ...QUERY_OPTS,
  });
}

// ============================================================
// 4) OBLIGATIONS — para compliance e risk
// ============================================================

export function useAnalyticsObligations() {
  return useQuery({
    queryKey: ["analytics-obligations"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_obligations")
        .select("id, contract_id, title, status, due_date, obligation_type")
        .eq("tenant_id", tenantId)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ObligationEntry[];
    },
    ...QUERY_OPTS,
  });
}

// ============================================================
// 5) CONTRACT PARTIES — para Concentração de Risco
// ============================================================

export function useAnalyticsParties() {
  return useQuery({
    queryKey: ["analytics-parties"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_parties")
        .select("contract_id, person_id, role")
        .eq("tenant_id", tenantId)
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as PartyEntry[];
    },
    ...QUERY_OPTS,
  });
}

// ============================================================
// 6) REDLINING — lazy (não carrega no mount)
// ============================================================

export function useAnalyticsRedlining(enabled: boolean) {
  return useQuery({
    queryKey: ["analytics-redlining"],
    enabled,
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_redlining")
        .select("id, contract_id, clause_name, status")
        .eq("tenant_id", tenantId)
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as RedliningLite[];
    },
    ...QUERY_OPTS,
  });
}

// ============================================================
// DRILL-DOWN HOOK — carrega com JOINs só quando clicado
// ============================================================

export interface DrillDownContract {
  id: string;
  status: string;
  contract_type: string | null;
  monthly_value: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  properties: { id: string; title: string | null; neighborhood: string | null; city: string | null } | null;
}

export function useDrillDownContracts(ids: string[] | null) {
  return useQuery({
    queryKey: ["analytics-drilldown", ids],
    enabled: !!ids && ids.length > 0,
    queryFn: async () => {
      if (!ids || ids.length === 0) return [];
      const tenantId = await getAuthTenantId();
      const CHUNK = 50;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        chunks.push(ids.slice(i, i + CHUNK));
      }
      const results = await Promise.all(
        chunks.map(async (chunk) => {
          const { data, error } = await supabase
            .from("contracts")
            .select("id, status, contract_type, monthly_value, start_date, end_date, created_at, properties:property_id(id, title, neighborhood, city)")
            .in("id", chunk)
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false });
          if (error) throw error;
          return (data ?? []).map((c: any) => ({
            ...c,
            monthly_value: num(c.monthly_value),
          }));
        })
      );
      return results.flat() as DrillDownContract[];
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

// ============================================================
// COMPUTED METRICS — tudo em useMemo, single-pass
// ============================================================

/**
 * Métricas 1: Revenue Leakage
 * Contratos ativos com adjustment_index MAS sem alteração de monthly_value nos últimos 365 dias
 */
export function useRevenueLeakage(contracts: AnalyticsContract[], auditTrail: AuditEntry[]) {
  return useMemo(() => {
    const now = new Date();
    const active = contracts.filter((c) => c.status === "ativo" && c.adjustment_index && c.monthly_value > 0);
    if (active.length === 0) return { leaking: [], totalLeaked: 0, pct: 0 };

    // Pre-build Map: contract_id → latest monthly_value change date
    const latestAdjMap = new Map<string, string>();
    for (const e of auditTrail) {
      if (e.field_changed === "monthly_value" || e.action === "reajuste") {
        const prev = latestAdjMap.get(e.contract_id);
        if (!prev || e.created_at > prev) latestAdjMap.set(e.contract_id, e.created_at);
      }
    }

    const leaking: Array<{ id: string; monthly_value: number; days_without_adj: number }> = [];
    let totalLeaked = 0;
    for (const c of active) {
      const contractAge = differenceInDays(now, new Date(c.start_date ?? c.created_at));
      if (contractAge < 390) continue; // contrato com menos de ~13 meses, reajuste ainda não aplicável
      const lastAdj = latestAdjMap.get(c.id);
      const daysSinceAdj = lastAdj ? differenceInDays(now, new Date(lastAdj)) : contractAge;
      if (daysSinceAdj > 365) {
        leaking.push({ id: c.id, monthly_value: c.monthly_value, days_without_adj: daysSinceAdj });
        totalLeaked += c.monthly_value * 0.05; // ~5% IGPM médio estimado
      }
    }
    const pct = active.length > 0 ? (leaking.length / active.length) * 100 : 0;
    return { leaking, totalLeaked, pct };
  }, [contracts, auditTrail]);
}

/**
 * Métricas 2: Exposição de Passivo (liability)
 * monthly_value × (termination_penalty_rate/100) × meses restantes
 */
export function useLiabilityExposure(contracts: AnalyticsContract[]) {
  return useMemo(() => {
    const now = new Date();
    let total = 0;
    const items: Array<{ id: string; exposure: number; remaining_months: number }> = [];
    for (const c of contracts) {
      if (c.status !== "ativo" || !c.end_date || c.monthly_value <= 0) continue;
      const remainDays = differenceInDays(new Date(c.end_date), now);
      if (remainDays <= 0) continue;
      const remainMonths = Math.ceil(remainDays / 30);
      const rate = c.termination_penalty_rate > 0 ? c.termination_penalty_rate / 100 : 0.03;
      const exposure = c.monthly_value * rate * remainMonths;
      total += exposure;
      items.push({ id: c.id, exposure, remaining_months: remainMonths });
    }
    return { total, items: items.sort((a, b) => b.exposure - a.exposure).slice(0, 10) };
  }, [contracts]);
}

/**
 * Métricas 3: Concentração de Risco — TOP 8 parties por valor
 */
export function useRiskConcentration(contracts: AnalyticsContract[], parties: PartyEntry[]) {
  return useMemo(() => {
    // Map contract_id → monthly_value
    const valueMap = new Map<string, number>();
    for (const c of contracts) {
      if (c.status === "ativo" && c.monthly_value > 0) valueMap.set(c.id, c.monthly_value);
    }
    // Aggregate by person_id
    const personVal = new Map<string, { total: number; contracts: string[] }>();
    for (const p of parties) {
      const val = valueMap.get(p.contract_id);
      if (!val) continue;
      const existing = personVal.get(p.person_id);
      if (existing) {
        existing.total += val;
        existing.contracts.push(p.contract_id);
      } else {
        personVal.set(p.person_id, { total: val, contracts: [p.contract_id] });
      }
    }
    const sorted = Array.from(personVal.entries())
      .map(([person_id, v]) => ({ person_id, total: v.total, contract_count: v.contracts.length }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    const grandTotal = Array.from(valueMap.values()).reduce((s, v) => s + v, 0);
    return { top8: sorted, grandTotal };
  }, [contracts, parties]);
}

/**
 * Métricas 4: Approval SLA — média de dias por decisão
 */
export function useApprovalSLA(approvals: ApprovalEntry[]) {
  return useMemo(() => {
    const byStatus: Record<string, number[]> = {};
    for (const a of approvals) {
      if (!a.decided_at) continue;
      const days = differenceInDays(new Date(a.decided_at), new Date(a.created_at));
      if (days < 0) continue;
      if (!byStatus[a.status]) byStatus[a.status] = [];
      byStatus[a.status].push(days);
    }
    const result: Array<{ status: string; avg_days: number; count: number }> = [];
    for (const [status, days] of Object.entries(byStatus)) {
      const avg = days.reduce((s, d) => s + d, 0) / days.length;
      result.push({ status, avg_days: Math.round(avg * 10) / 10, count: days.length });
    }
    const allDays = Object.values(byStatus).flat();
    const overallAvg = allDays.length > 0 ? allDays.reduce((s, d) => s + d, 0) / allDays.length : 0;
    return { byStatus: result, overallAvg: Math.round(overallAvg * 10) / 10, total: allDays.length };
  }, [approvals]);
}

/**
 * Métricas 5: Índice de Retrabalho — edições por contrato
 */
export function useRetrabalhIndex(contracts: AnalyticsContract[], auditTrail: AuditEntry[]) {
  return useMemo(() => {
    const editsPerContract = new Map<string, number>();
    for (const e of auditTrail) {
      if (e.action === "editado") {
        editsPerContract.set(e.contract_id, (editsPerContract.get(e.contract_id) ?? 0) + 1);
      }
    }
    const contractCount = contracts.length || 1;
    const totalEdits = Array.from(editsPerContract.values()).reduce((s, v) => s + v, 0);
    const avg = totalEdits / contractCount;
    const top5 = Array.from(editsPerContract.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { avg: Math.round(avg * 10) / 10, totalEdits, top5 };
  }, [contracts, auditTrail]);
}

/**
 * Métricas 6: Contratos Estagnados — em "analise"/"em_revisao"/"rascunho" há mais de 7 dias
 */
export function useStalledContracts(contracts: AnalyticsContract[]) {
  return useMemo(() => {
    const now = new Date();
    const stalledStatuses = new Set(["analise", "em_revisao", "rascunho", "em_aprovacao", "negociacao"]);
    const stalled: Array<{ id: string; status: string; days_stalled: number }> = [];
    for (const c of contracts) {
      if (!stalledStatuses.has(c.status)) continue;
      const age = differenceInDays(now, new Date(c.created_at));
      if (age > 7) stalled.push({ id: c.id, status: c.status, days_stalled: age });
    }
    return stalled.sort((a, b) => b.days_stalled - a.days_stalled);
  }, [contracts]);
}

/**
 * Métricas 7: Tendência de Volume Mensal — últimos 6 meses
 */
export function useMonthlyVolume(contracts: AnalyticsContract[]) {
  return useMemo(() => {
    const now = new Date();
    const months: Array<{ month: string; count: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(startOfMonth(d), "yyyy-MM");
      months.push({ month: key, count: 0 });
    }
    const monthMap = new Map(months.map((m) => [m.month, m]));
    for (const c of contracts) {
      const key = format(new Date(c.created_at), "yyyy-MM");
      const entry = monthMap.get(key);
      if (entry) entry.count++;
    }
    return months;
  }, [contracts]);
}

/**
 * Métricas 8: Revenue por Tipo de contrato
 */
export function useRevenueByType(contracts: AnalyticsContract[]) {
  return useMemo(() => {
    const byType = new Map<string, number>();
    for (const c of contracts) {
      if (c.monthly_value <= 0 || !c.contract_type) continue;
      const months = c.start_date && c.end_date
        ? Math.max(1, Math.ceil(differenceInDays(new Date(c.end_date), new Date(c.start_date)) / 30))
        : 12;
      const totalValue = c.monthly_value * months;
      byType.set(c.contract_type, (byType.get(c.contract_type) ?? 0) + totalValue);
    }
    return Array.from(byType.entries())
      .map(([type, value]) => ({ type, value }))
      .sort((a, b) => b.value - a.value);
  }, [contracts]);
}

/**
 * Métricas 9: Clause Friction Heatmap — TOP 15 cláusulas com mais redlining
 */
export function useClauseFriction(redlining: RedliningLite[]) {
  return useMemo(() => {
    const clauseMap = new Map<string, { total: number; aceito: number; recusado: number; aberto: number }>();
    for (const r of redlining) {
      if (!r.clause_name) continue;
      const existing = clauseMap.get(r.clause_name) ?? { total: 0, aceito: 0, recusado: 0, aberto: 0 };
      existing.total++;
      if (r.status === "aceito" || r.status === "incorporado") existing.aceito++;
      else if (r.status === "recusado") existing.recusado++;
      else existing.aberto++;
      clauseMap.set(r.clause_name, existing);
    }
    return Array.from(clauseMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [redlining]);
}

/**
 * Métricas 10 (Buchecha): Revenue at Risk
 * Contratos ativos com cláusula de saída/rescisão próximos da expiração (< 90 dias)
 */
export function useRevenueAtRisk(contracts: AnalyticsContract[]) {
  return useMemo(() => {
    const now = new Date();
    let totalAtRisk = 0;
    const items: Array<{ id: string; monthly_value: number; days_to_expiry: number; annual_value: number }> = [];
    for (const c of contracts) {
      if (c.status !== "ativo" || !c.end_date || c.monthly_value <= 0) continue;
      const daysLeft = differenceInDays(new Date(c.end_date), now);
      if (daysLeft > 0 && daysLeft <= 90) {
        const annual = c.monthly_value * 12;
        totalAtRisk += annual;
        items.push({ id: c.id, monthly_value: c.monthly_value, days_to_expiry: daysLeft, annual_value: annual });
      }
    }
    return { totalAtRisk, items: items.sort((a, b) => a.days_to_expiry - b.days_to_expiry), count: items.length };
  }, [contracts]);
}

/**
 * Métricas 11 (Buchecha): Approval Velocity por Gestor
 * Quem está acelerando ou atrasando aprovações
 */
export function useApprovalVelocity(approvals: ApprovalEntry[]) {
  return useMemo(() => {
    const byApprover = new Map<string, number[]>();
    for (const a of approvals) {
      if (!a.decided_at || !a.approver_id) continue;
      const days = differenceInDays(new Date(a.decided_at), new Date(a.created_at));
      if (days < 0) continue;
      const arr = byApprover.get(a.approver_id) ?? [];
      arr.push(days);
      byApprover.set(a.approver_id, arr);
    }
    const result: Array<{ approver_id: string; avg_days: number; count: number; fastest: number; slowest: number }> = [];
    for (const [approver_id, days] of byApprover) {
      const avg = days.reduce((s, d) => s + d, 0) / days.length;
      result.push({
        approver_id,
        avg_days: Math.round(avg * 10) / 10,
        count: days.length,
        fastest: Math.min(...days),
        slowest: Math.max(...days),
      });
    }
    return result.sort((a, b) => b.avg_days - a.avg_days); // mais lento primeiro
  }, [approvals]);
}
