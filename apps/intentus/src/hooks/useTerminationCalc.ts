import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface CalcItem {
  id: string;
  termination_id: string;
  item_type: string;
  description: string;
  direction: "debito" | "credito";
  amount: number;
  formula_notes: string | null;
  sort_order: number;
  created_at: string;
  tenant_id: string;
}

export interface CalcTemplate {
  id: string;
  tenant_id: string;
  item_type: string;
  description: string;
  direction: "debito" | "credito";
  default_formula: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export const itemTypeLabels: Record<string, string> = {
  multa: "Multa Rescisória",
  aluguel_proporcional: "Aluguel Proporcional",
  condominio: "Condomínio Proporcional",
  iptu: "IPTU Proporcional",
  consumo: "Contas de Consumo",
  reparo: "Pintura / Reparos",
  caucao_devolucao: "Devolução de Caução",
  outro: "Outro",
};

export const directionLabels: Record<string, string> = {
  debito: "Débito (inquilino deve)",
  credito: "Crédito (inquilino recebe)",
};

// ---- Calc Items CRUD ----

export function useTerminationCalcItems(terminationId: string | undefined) {
  return useQuery({
    queryKey: ["termination-calc-items", terminationId],
    enabled: !!terminationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("termination_calc_items")
        .select("*")
        .eq("termination_id", terminationId!)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CalcItem[];
    },
  });
}

export function useCreateCalcItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<CalcItem, "id" | "created_at" | "tenant_id">) => {
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase
        .from("termination_calc_items")
        .insert({ ...item, tenant_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["termination-calc-items", data.termination_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCalcItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; description?: string; amount?: number; direction?: string; item_type?: string; formula_notes?: string | null; sort_order?: number }) => {
      const { data, error } = await supabase
        .from("termination_calc_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["termination-calc-items", data.termination_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCalcItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, terminationId }: { id: string; terminationId: string }) => {
      const { error } = await supabase.from("termination_calc_items").delete().eq("id", id);
      if (error) throw error;
      return terminationId;
    },
    onSuccess: (terminationId) => {
      qc.invalidateQueries({ queryKey: ["termination-calc-items", terminationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---- Calc Templates CRUD ----

export function useCalcTemplates() {
  return useQuery({
    queryKey: ["termination-calc-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("termination_calc_templates")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CalcTemplate[];
    },
  });
}

export function useCreateCalcTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tmpl: Omit<CalcTemplate, "id" | "created_at" | "tenant_id">) => {
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase
        .from("termination_calc_templates")
        .insert({ ...tmpl, tenant_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["termination-calc-templates"] });
      toast.success("Item do template criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCalcTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; item_type?: string; description?: string; direction?: string; default_formula?: string | null; sort_order?: number; active?: boolean }) => {
      const { error } = await supabase.from("termination_calc_templates").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["termination-calc-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCalcTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("termination_calc_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["termination-calc-templates"] });
      toast.success("Item removido do template!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---- Apply template to a termination ----

export function useBulkInsertCalcItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ terminationId, items }: { terminationId: string; items: Omit<CalcItem, "id" | "created_at" | "tenant_id">[] }) => {
      const tenant_id = await getAuthTenantId();
      const rows = items.map((it) => ({ ...it, tenant_id, termination_id: terminationId }));
      const { error } = await supabase.from("termination_calc_items").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["termination-calc-items", vars.terminationId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---- Save calc summary ----

export function useSaveCalcSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ terminationId, summary, penaltyValue }: { terminationId: string; summary: Record<string, unknown>; penaltyValue: number }) => {
      const { error } = await supabase
        .from("contract_terminations")
        .update({ calc_summary: summary as any, penalty_value: penaltyValue })
        .eq("id", terminationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terminations"] });
      toast.success("Cálculo rescisório salvo!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
