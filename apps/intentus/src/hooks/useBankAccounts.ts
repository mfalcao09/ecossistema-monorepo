import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

type BankAccountType = Database["public"]["Enums"]["bank_account_type"];

export interface BankAccount {
  id: string;
  name: string;
  bank_name: string | null;
  agency: string | null;
  account_number: string | null;
  account_type: BankAccountType;
  pix_key: string | null;
  active: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const accountTypeLabels: Record<string, string> = {
  operacional: "Operacional",
  transitoria: "Transitória / Garantia",
};

export function useBankAccounts() {
  return useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as BankAccount[];
    },
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: Omit<BankAccount, "id" | "created_by" | "created_at" | "updated_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("bank_accounts").insert({
        name: form.name,
        bank_name: form.bank_name,
        agency: form.agency,
        account_number: form.account_number,
        account_type: form.account_type,
        pix_key: form.pix_key,
        active: form.active,
        notes: form.notes,
        created_by: user.id,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-accounts"] }); toast.success("Conta criada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: Partial<BankAccount> & { id: string }) => {
      const { error } = await supabase.from("bank_accounts").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-accounts"] }); toast.success("Conta atualizada!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-accounts"] }); toast.success("Conta removida!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
