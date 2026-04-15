import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { escapeIlike } from "@/lib/searchUtils";

export type Person = Tables<"people">;
export type PersonInsert = TablesInsert<"people">;
export type PersonUpdate = TablesUpdate<"people">;

export function usePeople(filters?: { search?: string; person_type?: string }) {
  return useQuery({
    queryKey: ["people", filters],
    queryFn: async () => {
      let query = supabase.from("people").select("*").order("name", { ascending: true });
      if (filters?.search) {
        const s = escapeIlike(filters.search);
        query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,cpf_cnpj.ilike.%${s}%,phone.ilike.%${s}%`);
      }
      if (filters?.person_type && filters.person_type !== "todos") query = query.eq("person_type", filters.person_type as Person["person_type"]);
      const { data, error } = await query;
      if (error) throw error;
      return data as Person[];
    },
  });
}

export function usePerson(id: string | undefined) {
  return useQuery({
    queryKey: ["people", id], enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Person;
    },
  });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (person: Omit<PersonInsert, "created_by">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase.from("people").insert({ ...person, created_by: user.id, tenant_id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["people"] }); toast.success("Pessoa cadastrada com sucesso!"); },
    onError: (err: Error) => toast.error(`Erro ao cadastrar: ${err.message}`),
  });
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: PersonUpdate & { id: string }) => {
      const { data, error } = await supabase.from("people").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["people"] }); toast.success("Pessoa atualizada com sucesso!"); },
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["people"] }); toast.success("Pessoa removida com sucesso!"); },
    onError: (err: Error) => toast.error(`Erro ao remover: ${err.message}`),
  });
}
