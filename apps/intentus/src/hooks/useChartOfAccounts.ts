import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useToast } from "@/hooks/use-toast";

export interface ChartAccount {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  account_type: string;
  nature: string;
  parent_id: string | null;
  level: number;
  is_active: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ChartAccountInput = Pick<ChartAccount, "code" | "name" | "account_type" | "nature" | "parent_id" | "level" | "is_active" | "notes">;

export function useChartOfAccounts() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = ["chart_of_accounts"];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .order("code");
      if (error) throw error;
      return data as ChartAccount[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: ChartAccountInput) => {
      const tenantId = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("chart_of_accounts").insert({
        ...input,
        tenant_id: tenantId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Conta criada com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar conta", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: ChartAccountInput & { id: string }) => {
      const { error } = await supabase.from("chart_of_accounts").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Conta atualizada com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar conta", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chart_of_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Conta excluída" });
    },
    onError: (e: any) => toast({ title: "Erro ao excluir conta", description: e.message, variant: "destructive" }),
  });

  const bulkCreate = useMutation({
    mutationFn: async (inputs: ChartAccountInput[]) => {
      const tenantId = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();

      // Sort by level so parents are inserted first
      const sorted = [...inputs].sort((a, b) => a.level - b.level);

      // Insert level by level to resolve parent_id references
      const codeToId = new Map<string, string>();

      for (const input of sorted) {
        let parentId = input.parent_id;
        // parent_id here is actually the parent code from CSV — resolve it
        if (parentId && codeToId.has(parentId)) {
          parentId = codeToId.get(parentId)!;
        } else if (parentId) {
          // Try to find in existing accounts
          const existing = query.data?.find((a) => a.code === parentId);
          parentId = existing?.id || null;
        }

        const { data, error } = await supabase.from("chart_of_accounts").insert({
          ...input,
          parent_id: parentId,
          tenant_id: tenantId,
          created_by: user!.id,
        }).select("id").single();
        if (error) throw new Error(`Erro ao inserir conta ${input.code}: ${error.message}`);
        codeToId.set(input.code, data.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Contas importadas com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro na importação", description: e.message, variant: "destructive" }),
  });

  return { accounts: query.data ?? [], isLoading: query.isLoading, create, update, remove, bulkCreate };
}
