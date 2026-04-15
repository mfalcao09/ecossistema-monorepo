import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export type GuaranteeType = Tables<"guarantee_types">;

export interface DocumentGroup {
  party_role: string;
  label: string;
  documents: string[];
}

export interface ValidationStep {
  order: number;
  name: string;
  description: string;
  required: boolean;
}

export interface BusinessRules {
  document_groups?: DocumentGroup[];
  validation_steps?: ValidationStep[];
  notes?: string;
}

export function useGuaranteeTypes(onlyActive = false) {
  return useQuery({
    queryKey: ["guarantee-types", onlyActive],
    queryFn: async () => {
      let q = supabase.from("guarantee_types").select("*").order("name");
      if (onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data as GuaranteeType[];
    },
  });
}

export function useCreateGuaranteeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { name: string; description?: string; required_documents?: string[]; business_rules?: BusinessRules }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("guarantee_types").insert({
        name: form.name, description: form.description || null, required_documents: form.required_documents || null,
        business_rules: (form.business_rules || {}) as any,
        created_by: user.id, tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["guarantee-types"] }); toast.success("Tipo de garantia criado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateGuaranteeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string; name?: string; description?: string; required_documents?: string[]; active?: boolean; business_rules?: BusinessRules }) => {
      const payload: any = { ...form };
      if (form.business_rules) payload.business_rules = form.business_rules;
      const { error } = await supabase.from("guarantee_types").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["guarantee-types"] }); toast.success("Garantia atualizada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteGuaranteeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("guarantee_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["guarantee-types"] }); toast.success("Garantia removida!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
