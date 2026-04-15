/**
 * useBulkContractOps — Bulk Operations for CLM Contracts (Sessão 57, F1 Item #5)
 *
 * Provides:
 *   - Selection state (Set<string> of contract IDs)
 *   - 6 bulk actions: transition, export CSV, export PDF(?), delete, assign, tag
 */

import { useState, useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";
import type { ContractStatus } from "@/lib/clmApi";
import type { ContractWithRelations } from "@/hooks/useContracts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Selection hook
// ---------------------------------------------------------------------------

export function useBulkSelection(contracts: ContractWithRelations[] | undefined) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (!contracts) return;
    setSelectedIds((prev) => {
      if (prev.size === contracts.length) return new Set();
      return new Set(contracts.map((c) => c.id));
    });
  }, [contracts]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const isAllSelected = useMemo(
    () => !!contracts && contracts.length > 0 && selectedIds.size === contracts.length,
    [contracts, selectedIds.size],
  );

  const isPartiallySelected = useMemo(
    () => selectedIds.size > 0 && !isAllSelected,
    [selectedIds.size, isAllSelected],
  );

  const selectedContracts = useMemo(
    () => (contracts ?? []).filter((c) => selectedIds.has(c.id)),
    [contracts, selectedIds],
  );

  return {
    selectedIds,
    selectedContracts,
    toggle,
    toggleAll,
    clearSelection,
    isAllSelected,
    isPartiallySelected,
    count: selectedIds.size,
  };
}

// ---------------------------------------------------------------------------
// Bulk transition
// ---------------------------------------------------------------------------

export function useBulkTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractIds,
      toStatus,
    }: {
      contractIds: string[];
      toStatus: ContractStatus;
    }) => {
      if (contractIds.length > MAX_BATCH_SIZE) {
        throw new Error(`Máximo de ${MAX_BATCH_SIZE} contratos por operação`);
      }
      const tenantId = await getAuthTenantId();
      const results = await Promise.allSettled(
        contractIds.map(async (id) => {
          const { error } = await supabase
            .from("contracts")
            .update({ status: toStatus })
            .eq("id", id)
            .eq("tenant_id", tenantId);
          if (error) throw new Error(`${id}: ${error.message}`);
          // Log lifecycle event
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from("contract_lifecycle_events").insert({
            contract_id: id,
            event_type: "status_change",
            description: `Status alterado para ${toStatus} (bulk operation)`,
            created_by: user?.id,
            tenant_id: tenantId,
          });
          return id;
        }),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      return { succeeded, failed, total: contractIds.length };
    },
    onSuccess: ({ succeeded, failed }) => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["clm-dashboard"] });
      if (failed === 0) {
        toast.success(`${succeeded} contrato(s) atualizado(s) com sucesso`);
      } else {
        toast.warning(`${succeeded} atualizado(s), ${failed} com erro`);
      }
    },
    onError: (err: Error) => toast.error(`Erro na transição: ${err.message}`),
  });
}

// ---------------------------------------------------------------------------
// Bulk delete
// ---------------------------------------------------------------------------

export function useBulkDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contractIds: string[]) => {
      if (contractIds.length > MAX_BATCH_SIZE) {
        throw new Error(`Máximo de ${MAX_BATCH_SIZE} contratos por operação`);
      }
      const tenantId = await getAuthTenantId();
      const results = await Promise.allSettled(
        contractIds.map(async (id) => {
          // Delete cascade: parties, installments, obligations, redlining
          await supabase.from("contract_parties").delete().eq("contract_id", id);
          await supabase.from("contract_installments").delete().eq("contract_id", id);
          await supabase.from("contract_obligations").delete().eq("contract_id", id);
          await supabase.from("contract_redlining").delete().eq("contract_id", id);
          const { error } = await supabase
            .from("contracts")
            .delete()
            .eq("id", id)
            .eq("tenant_id", tenantId);
          if (error) throw new Error(`${id}: ${error.message}`);
          return id;
        }),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      return { succeeded, failed, total: contractIds.length };
    },
    onSuccess: ({ succeeded, failed }) => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["clm-dashboard"] });
      if (failed === 0) {
        toast.success(`${succeeded} contrato(s) excluído(s)`);
      } else {
        toast.warning(`${succeeded} excluído(s), ${failed} com erro`);
      }
    },
    onError: (err: Error) => toast.error(`Erro na exclusão: ${err.message}`),
  });
}

// ---------------------------------------------------------------------------
// Bulk assign responsible
// ---------------------------------------------------------------------------

export function useBulkAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractIds,
      responsibleName,
    }: {
      contractIds: string[];
      responsibleName: string;
    }) => {
      const tenantId = await getAuthTenantId();
      const results = await Promise.allSettled(
        contractIds.map(async (id) => {
          const { error } = await supabase
            .from("contracts")
            .update({ notes: `Responsável: ${responsibleName}` } as any)
            .eq("id", id)
            .eq("tenant_id", tenantId);
          if (error) throw new Error(`${id}: ${error.message}`);
          return id;
        }),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      return { succeeded, failed: results.length - succeeded };
    },
    onSuccess: ({ succeeded }) => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      toast.success(`Responsável atribuído em ${succeeded} contrato(s)`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

// ---------------------------------------------------------------------------
// Bulk renewal (transition to renovado)
// ---------------------------------------------------------------------------

export function useBulkRenewal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contractIds: string[]) => {
      const tenantId = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      const results = await Promise.allSettled(
        contractIds.map(async (id) => {
          const { error } = await supabase
            .from("contracts")
            .update({ status: "renovado" as any })
            .eq("id", id)
            .eq("tenant_id", tenantId)
            .in("status", ["ativo", "expirado"]);
          if (error) throw new Error(`${id}: ${error.message}`);
          await supabase.from("contract_lifecycle_events").insert({
            contract_id: id,
            event_type: "renewal",
            description: "Renovação em lote (bulk operation)",
            created_by: user?.id,
            tenant_id: tenantId,
          });
          return id;
        }),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      return { succeeded, failed: results.length - succeeded };
    },
    onSuccess: ({ succeeded }) => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["clm-dashboard"] });
      toast.success(`${succeeded} contrato(s) renovado(s)`);
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

// ---------------------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------------------

export function exportContractsCsv(contracts: ContractWithRelations[]) {
  const headers = [
    "ID", "Tipo", "Status", "Imóvel", "Partes", "Início", "Fim",
    "Valor Mensal", "Valor Total", "Índice Reajuste", "Garantia", "Observações",
  ];

  const rows = contracts.map((c) => [
    c.id,
    c.contract_type,
    c.status,
    c.properties?.title ?? "",
    (c.contract_parties ?? []).map((p) => p.people?.name ?? "").join("; "),
    c.start_date ?? "",
    c.end_date ?? "",
    c.monthly_value ?? "",
    c.total_value ?? "",
    c.adjustment_index ?? "",
    c.guarantee_type ?? "",
    (c.notes ?? "").replace(/"/g, '""'),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contratos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${contracts.length} contrato(s) exportado(s) para CSV`);
}
