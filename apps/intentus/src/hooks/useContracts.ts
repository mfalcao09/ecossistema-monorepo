import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { generateIntermediationFee, processInstallmentPayment } from "@/lib/financePipeline";
import { getAuthTenantId } from "@/lib/tenantUtils";

export type Contract = Tables<"contracts">;
export type ContractInsert = TablesInsert<"contracts">;
export type ContractUpdate = TablesUpdate<"contracts">;
export type ContractParty = Tables<"contract_parties">;
export type Installment = Tables<"contract_installments">;

export type ContractWithRelations = Contract & {
  properties?: { id: string; title: string; street?: string | null; number?: string | null; complement?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null } | null;
  contract_parties?: (ContractParty & { people?: { id: string; name: string } | null })[];
};

export function useContracts(filters?: { search?: string; status?: string; contract_type?: string }) {
  return useQuery({
    queryKey: ["contracts", filters],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      let query = supabase.from("contracts").select(`*, properties:property_id ( id, title, street, number, complement, neighborhood, city, state ), contract_parties ( id, person_id, role, people:person_id ( id, name ) )`).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200);
      if (filters?.status && filters.status !== "todos") query = query.eq("status", filters.status as Contract["status"]);
      if (filters?.contract_type && filters.contract_type !== "todos") query = query.eq("contract_type", filters.contract_type as Contract["contract_type"]);
      const { data, error } = await query;
      if (error) throw error;
      let results = data as ContractWithRelations[];
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        results = results.filter((c) => {
          const propTitle = c.properties?.title?.toLowerCase() ?? "";
          const partyNames = c.contract_parties?.map((p) => p.people?.name?.toLowerCase() ?? "").join(" ") ?? "";
          return propTitle.includes(s) || partyNames.includes(s);
        });
      }
      return results;
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: ["contracts", id], enabled: !!id,
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase.from("contracts").select(`*, properties:property_id ( id, title ), contract_parties ( id, person_id, role, people:person_id ( id, name ) )`).eq("id", id!).eq("tenant_id", tenantId).single();
      if (error) throw error;
      return data as ContractWithRelations;
    },
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contract, parties }: { contract: Omit<ContractInsert, "created_by">; parties: { person_id: string; role: ContractParty["role"] }[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase.from("contracts").insert({ ...contract, created_by: user.id, tenant_id }).select().single();
      if (error) throw error;
      if (parties.length > 0) {
        const { error: pErr } = await supabase.from("contract_parties").insert(parties.map((p) => ({ ...p, contract_id: data.id, tenant_id })));
        if (pErr) throw pErr;
      }
      return data;
    },
    onSuccess: async (data) => {
      if (data.contract_type === "locacao" && data.status === "ativo") {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const tenant_id = await getAuthTenantId();
            const { data: existingInsp } = await supabase.from("inspections").select("id").eq("contract_id", data.id).eq("inspection_type", "entrada");
            if (!existingInsp || existingInsp.length === 0) {
              await supabase.from("inspections").insert({ property_id: data.property_id, contract_id: data.id, inspection_type: "entrada", status: "agendada", scheduled_date: data.start_date, created_by: user.id, inspector_notes: "Vistoria de entrada gerada automaticamente ao ativar contrato de locação.", tenant_id });
              toast.info("Vistoria de entrada agendada automaticamente!");
            }
          }
        } catch (e) { console.error("Erro ao criar vistoria de entrada:", e); }
      }
      if (data.contract_type === "locacao" && data.monthly_value && data.start_date && data.status === "ativo") {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const result = await generateIntermediationFee(data.id, data.monthly_value, data.start_date, user.id);
            if (result) toast.info("Taxa de intermediação (1º aluguel) gerada automaticamente!");
          }
        } catch (e) { console.error("Erro ao gerar taxa de intermediação:", e); }
      }
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["installments"] });
      qc.invalidateQueries({ queryKey: ["inspections"] });
      toast.success("Contrato criado com sucesso!");
    },
    onError: (err: Error) => toast.error(`Erro ao criar contrato: ${err.message}`),
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, contract, parties }: { id: string; contract: ContractUpdate; parties?: { person_id: string; role: ContractParty["role"] }[] }) => {
      const { data, error } = await supabase.from("contracts").update(contract).eq("id", id).select().single();
      if (error) throw error;
      if (parties) {
        const tenant_id = await getAuthTenantId();
        await supabase.from("contract_parties").delete().eq("contract_id", id);
        if (parties.length > 0) {
          const { error: pErr } = await supabase.from("contract_parties").insert(parties.map((p) => ({ ...p, contract_id: id, tenant_id })));
          if (pErr) throw pErr;
        }
      }
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); toast.success("Contrato atualizado com sucesso!"); },
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("contract_parties").delete().eq("contract_id", id);
      await supabase.from("contract_installments").delete().eq("contract_id", id);
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); toast.success("Contrato removido com sucesso!"); },
    onError: (err: Error) => toast.error(`Erro ao remover: ${err.message}`),
  });
}

export function useInstallments(contractId: string | undefined) {
  return useQuery({
    queryKey: ["installments", contractId], enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contract_installments").select("*").eq("contract_id", contractId!).order("installment_number", { ascending: true });
      if (error) throw error;
      return data as Installment[];
    },
  });
}

export function useGenerateRecurringInstallments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, monthlyValue, numberOfMonths, startDate, lineItems }: {
      contractId: string; monthlyValue: number; numberOfMonths: number; startDate: string;
      lineItems?: { description: string; item_type: string; amount: number }[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const start = new Date(startDate);
      for (let i = 0; i < numberOfMonths; i++) {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + i);
        const dueDateStr = dueDate.toISOString().split("T")[0];
        const { data: inst, error } = await supabase.from("contract_installments").insert({
          contract_id: contractId, installment_number: i + 1, amount: monthlyValue, due_date: dueDateStr,
          status: "pendente" as const, created_by: user.id, tenant_id,
        }).select().single();
        if (error) throw error;
        if (lineItems && lineItems.length > 0 && inst) {
          const monthLabel = dueDate.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
          const items = lineItems.map((li) => ({ installment_id: inst.id, description: `${li.description} ${monthLabel}`, item_type: li.item_type, amount: li.amount, tenant_id }));
          await supabase.from("installment_line_items").insert(items);
        }
      }
    },
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["installments", vars.contractId] }); toast.success(`${vars.numberOfMonths} parcelas geradas com composição!`); },
    onError: (err: Error) => toast.error(`Erro ao gerar parcelas: ${err.message}`),
  });
}

export function useGenerateInstallments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, totalValue, numberOfInstallments, startDate }: { contractId: string; totalValue: number; numberOfInstallments: number; startDate: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const amount = Math.round((totalValue / numberOfInstallments) * 100) / 100;
      const start = new Date(startDate);
      const installments = Array.from({ length: numberOfInstallments }, (_, i) => {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + i);
        return { contract_id: contractId, installment_number: i + 1, amount, due_date: dueDate.toISOString().split("T")[0], status: "pendente" as const, created_by: user.id, tenant_id };
      });
      const { error } = await supabase.from("contract_installments").insert(installments);
      if (error) throw error;
    },
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["installments", vars.contractId] }); toast.success("Parcelas geradas com sucesso!"); },
    onError: (err: Error) => toast.error(`Erro ao gerar parcelas: ${err.message}`),
  });
}

export function useUpdateInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"contract_installments"> & { id: string }) => {
      const { data, error } = await supabase.from("contract_installments").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      if (data.status === "pago" && data.contract_id) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const result = await processInstallmentPayment(data.id, data.contract_id, data.paid_amount ?? data.amount, user.id);
            if (result.transfer) toast.info("Repasse ao proprietário gerado automaticamente!");
            if (result.ir && result.ir.ir_value > 0) toast.info(`Retenção de IR gerada automaticamente!`);
          }
        } catch (e) { console.error("Erro no pipeline financeiro:", e); }
      }
      qc.invalidateQueries({ queryKey: ["installments"] });
      qc.invalidateQueries({ queryKey: ["owner-transfers"] });
      qc.invalidateQueries({ queryKey: ["ir-withholdings"] });
      toast.success("Parcela atualizada!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function usePropertiesForSelect() {
  return useQuery({
    queryKey: ["properties-select"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase.from("properties").select("id, title, status").eq("tenant_id", tenantId).order("title", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function usePeopleForSelect() {
  return useQuery({
    queryKey: ["people-select"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase.from("people").select("id, name, person_type").eq("tenant_id", tenantId).order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}
