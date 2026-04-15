import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

type UnitStatus = Database["public"]["Enums"]["unit_status"];
type DevType = Database["public"]["Enums"]["development_type"];
type DevStatus = Database["public"]["Enums"]["development_status"];

export function useDevelopments() {
  return useQuery({
    queryKey: ["developments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("developments")
        .select("*, development_units ( id, unit_identifier, status, area, price, block_id, floor, typology, valor_tabela )")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateDevelopment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { name: string; description?: string; city?: string; neighborhood?: string; state?: string; total_units?: number; tipo?: DevType; status_empreendimento?: DevStatus; vgv_estimado?: number; data_lancamento?: string; address?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("developments").insert({ ...form, created_by: user.id, tenant_id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["developments"] }); toast.success("Empreendimento criado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDevelopment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string; name?: string; description?: string; city?: string; neighborhood?: string; state?: string; total_units?: number; tipo?: DevType; status_empreendimento?: DevStatus; vgv_estimado?: number; data_lancamento?: string; address?: string }) => {
      const { error } = await supabase.from("developments").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["developments"] }); toast.success("Empreendimento atualizado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDevelopment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("developments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["developments"] }); toast.success("Empreendimento removido!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateDevelopmentUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { development_id: string; unit_identifier: string; area?: number; price?: number; block_id?: string; floor?: string; typology?: string; valor_tabela?: number }) => {
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("development_units").insert({ ...form, tenant_id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["developments"] }); toast.success("Unidade adicionada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDevelopmentUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: { id: string; status?: UnitStatus; area?: number; price?: number; block_id?: string; floor?: string; typology?: string; valor_tabela?: number; unit_identifier?: string }) => {
      const { error } = await supabase.from("development_units").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["developments"] });
      qc.invalidateQueries({ queryKey: ["sales-mirror"] });
      toast.success("Unidade atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDevelopmentUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("development_units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["developments"] }); toast.success("Unidade removida!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
