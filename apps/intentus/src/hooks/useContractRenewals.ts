import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export const renewalStatusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  em_analise: "Em Análise",
  aprovada: "Aprovada",
  formalizada: "Formalizada",
  cancelada: "Cancelada",
};

export const renewalStatusColors: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-800",
  em_analise: "bg-amber-100 text-amber-800",
  aprovada: "bg-blue-100 text-blue-800",
  formalizada: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
};

export interface ChecklistItem {
  key: string;
  label: string;
  required: boolean;
  done: boolean;
}

export interface TemplateItem {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

// ─── Renewals CRUD ───

export function useContractRenewals(contractId?: string) {
  return useQuery({
    queryKey: ["contract-renewals", contractId],
    queryFn: async () => {
      let q = supabase
        .from("contract_renewals" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (contractId) q = q.eq("contract_id", contractId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateRenewal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      contract_id: string;
      previous_end_date: string | null;
      new_end_date: string;
      previous_value: number | null;
      new_value: number | null;
      adjustment_index: string | null;
      adjustment_pct: number;
      renewal_term_months: number;
      checklist: ChecklistItem[];
      notes: string;
      status?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      const { error } = await supabase
        .from("contract_renewals" as any)
        .insert({
          ...payload,
          checklist: JSON.stringify(payload.checklist),
          created_by: user.id,
          tenant_id,
          status: payload.status || "rascunho",
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-renewals"] });
      toast.success("Renovação criada com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateRenewal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; [key: string]: any }) => {
      const updateData = { ...payload };
      if (updateData.checklist && typeof updateData.checklist !== "string") {
        updateData.checklist = JSON.stringify(updateData.checklist);
      }
      const { error } = await supabase
        .from("contract_renewals" as any)
        .update(updateData as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-renewals"] });
      toast.success("Renovação atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApplyRenewal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ renewalId, contractId, newEndDate, newValue, createAddendum, notes }: {
      renewalId: string;
      contractId: string;
      newEndDate: string;
      newValue: number | null;
      createAddendum: boolean;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Update contract
      const updatePayload: any = { end_date: newEndDate };
      if (newValue) updatePayload.monthly_value = newValue;
      const { error: cErr } = await supabase
        .from("contracts")
        .update(updatePayload)
        .eq("id", contractId);
      if (cErr) throw cErr;

      // Generate price history if value changed
      if (newValue) {
        const { data: contract } = await supabase
          .from("contracts")
          .select("property_id")
          .eq("id", contractId)
          .single();
        if (contract) {
          const tenant_id = await getAuthTenantId();
          await supabase.from("property_price_history").insert([{
            property_id: contract.property_id,
            price_type: "rental_price",
            old_value: 0, // will be overwritten
            new_value: newValue,
            changed_by: user.id,
            notes: `Renovação de contrato - novo valor`,
            tenant_id,
          }]);
          await supabase.from("properties").update({ rental_price: newValue }).eq("id", contract.property_id);
        }
      }

      // Create addendum if requested
      if (createAddendum) {
        const { data: contract } = await supabase
          .from("contracts")
          .select("*, properties:property_id ( id, title )")
          .eq("id", contractId)
          .single();
        if (contract) {
          const tenant_id = await getAuthTenantId();
          await supabase.from("deal_requests").insert({
            property_id: contract.property_id,
            deal_type: contract.contract_type,
            status: "enviado_juridico",
            commercial_notes: `Aditivo de renovação de contrato.${notes ? ` ${notes}` : ""} Nova vigência até ${newEndDate}.${newValue ? ` Novo valor: R$ ${newValue.toFixed(2)}` : ""}`,
            created_by: user.id,
            submitted_at: new Date().toISOString(),
            tenant_id,
          } as any);
        }
      }

      // Update renewal status
      const { error } = await supabase
        .from("contract_renewals" as any)
        .update({ status: "formalizada" } as any)
        .eq("id", renewalId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-renewals"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["deal-requests"] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      toast.success("Renovação aplicada ao contrato!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Renewal Templates CRUD ───

export function useRenewalTemplates() {
  return useQuery({
    queryKey: ["renewal-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("renewal_templates" as any)
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useSaveRenewalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      items: TemplateItem[];
      default_term_months: number;
      auto_create_addendum: boolean;
      notes: string;
    }) => {
      const tenant_id = await getAuthTenantId();
      const saveData = {
        items: JSON.stringify(payload.items),
        default_term_months: payload.default_term_months,
        auto_create_addendum: payload.auto_create_addendum,
        notes: payload.notes,
        tenant_id,
        active: true,
      };

      if (payload.id) {
        const { error } = await supabase
          .from("renewal_templates" as any)
          .update(saveData as any)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("renewal_templates" as any)
          .insert(saveData as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["renewal-templates"] });
      toast.success("Template de renovação salvo!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
