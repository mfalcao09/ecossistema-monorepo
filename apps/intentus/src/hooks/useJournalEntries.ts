import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useToast } from "@/hooks/use-toast";

export interface JournalEntryLine {
  id?: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description?: string;
  account_code?: string;
  account_name?: string;
}

export interface JournalEntry {
  id: string;
  tenant_id: string;
  entry_date: string;
  description: string;
  status: "rascunho" | "confirmado";
  created_by: string;
  created_at: string;
  updated_at: string;
  lines?: JournalEntryLine[];
  total_debit?: number;
  total_credit?: number;
}

export interface JournalEntryInput {
  entry_date: string;
  description: string;
  status?: string;
  lines: Omit<JournalEntryLine, "id" | "account_code" | "account_name">[];
}

export function useJournalEntries(filters?: { startDate?: string; endDate?: string; accountId?: string; search?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = ["journal_entries", filters];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase
        .from("journal_entries" as any)
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters?.startDate) q = q.gte("entry_date", filters.startDate);
      if (filters?.endDate) q = q.lte("entry_date", filters.endDate);
      if (filters?.search) q = q.ilike("description", `%${filters.search}%`);

      const { data, error } = await q;
      if (error) throw error;

      // Fetch lines for all entries
      const entryIds = (data as any[]).map((e: any) => e.id);
      if (entryIds.length === 0) return [] as JournalEntry[];

      const { data: lines, error: linesError } = await supabase
        .from("journal_entry_lines" as any)
        .select("*")
        .in("entry_id", entryIds);
      if (linesError) throw linesError;

      // Fetch account info for lines
      const accountIds = [...new Set((lines as any[]).map((l: any) => l.account_id))];
      const { data: accounts } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name")
        .in("id", accountIds);

      const accountMap = new Map((accounts || []).map((a) => [a.id, a]));

      // Filter by account if specified
      let filteredEntryIds: Set<string> | null = null;
      if (filters?.accountId) {
        filteredEntryIds = new Set(
          (lines as any[]).filter((l: any) => l.account_id === filters.accountId).map((l: any) => l.entry_id)
        );
      }

      return (data as any[])
        .filter((e: any) => !filteredEntryIds || filteredEntryIds.has(e.id))
        .map((e: any) => {
          const entryLines = (lines as any[])
            .filter((l: any) => l.entry_id === e.id)
            .map((l: any) => ({
              ...l,
              account_code: accountMap.get(l.account_id)?.code || "",
              account_name: accountMap.get(l.account_id)?.name || "",
            }));
          return {
            ...e,
            lines: entryLines,
            total_debit: entryLines.reduce((sum: number, l: any) => sum + Number(l.debit_amount), 0),
            total_credit: entryLines.reduce((sum: number, l: any) => sum + Number(l.credit_amount), 0),
          } as JournalEntry;
        });
    },
  });

  const create = useMutation({
    mutationFn: async (input: JournalEntryInput) => {
      const tenantId = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();

      // Validate debit = credit
      const totalDebit = input.lines.reduce((s, l) => s + l.debit_amount, 0);
      const totalCredit = input.lines.reduce((s, l) => s + l.credit_amount, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error("Total de débitos deve ser igual ao total de créditos");
      }

      const { data: entry, error } = await supabase
        .from("journal_entries" as any)
        .insert({
          entry_date: input.entry_date,
          description: input.description,
          status: input.status || "rascunho",
          tenant_id: tenantId,
          created_by: user!.id,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      const linesToInsert = input.lines.map((l) => ({
        entry_id: (entry as any).id,
        account_id: l.account_id,
        debit_amount: l.debit_amount,
        credit_amount: l.credit_amount,
        description: l.description || null,
        tenant_id: tenantId,
      }));

      const { error: linesError } = await supabase
        .from("journal_entry_lines" as any)
        .insert(linesToInsert as any);
      if (linesError) throw linesError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal_entries"] });
      toast({ title: "Lançamento criado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar lançamento", description: e.message, variant: "destructive" }),
  });

  const confirm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("journal_entries" as any)
        .update({ status: "confirmado" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal_entries"] });
      toast({ title: "Lançamento confirmado" });
    },
    onError: (e: any) => toast({ title: "Erro ao confirmar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("journal_entries" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal_entries"] });
      toast({ title: "Lançamento excluído" });
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    create,
    confirm,
    remove,
  };
}
