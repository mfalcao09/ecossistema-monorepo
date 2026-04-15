import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

export interface RentAdjustment {
  id: string;
  contract_id: string;
  adjustment_date: string;
  index_type: string;
  index_percentage: number;
  previous_value: number;
  new_value: number;
  status: string;
  applied_at: string | null;
  notes: string | null;
  requires_addendum: boolean;
  deal_request_id: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const indexTypeLabels: Record<string, string> = {
  igpm: "IGP-M",
  ipca: "IPCA",
  inpc: "INPC",
  manual: "Manual",
};

export const adjustmentStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  aplicado: "Aplicado",
  cancelado: "Cancelado",
};

export function useRentAdjustments(contractId?: string) {
  return useQuery({
    queryKey: ["rent-adjustments", contractId],
    queryFn: async () => {
      let q = supabase
        .from("rent_adjustments")
        .select("*, contracts:contract_id ( id, monthly_value, start_date, end_date, adjustment_index, properties:property_id ( id, title ), contract_parties ( id, person_id, role, people:person_id ( id, name ) ) )")
        .order("adjustment_date", { ascending: false });
      if (contractId) q = q.eq("contract_id", contractId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

/** Fetch BCB index from backend function */
export function useBCBIndex(indexType: string) {
  return useQuery({
    queryKey: ["bcb-index", indexType],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/bcb-index?index=${indexType}&months=12`,
        { headers: { "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } }
      );
      if (!resp.ok) throw new Error("Erro ao buscar índice BCB");
      return await resp.json() as {
        index: string;
        latest_value: number;
        latest_date: string | null;
        accumulated_12m: number;
        entries: { date: string; value: number }[];
      };
    },
    enabled: !!indexType && indexType !== "manual",
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

export function useCreateRentAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: Omit<RentAdjustment, "id" | "created_by" | "created_at" | "updated_at" | "applied_at"> & { property_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let deal_request_id: string | null = null;

      if (form.requires_addendum && form.property_id) {
        // tenantUtils imported statically at top
        const tenant_id = await getAuthTenantId();
        const { data: dr, error: drErr } = await supabase
          .from("deal_requests")
          .insert({
            property_id: form.property_id,
            deal_type: "locacao",
            status: "enviado_juridico",
            commercial_notes: `Aditivo de reajuste/prorrogação de contrato.\nÍndice: ${form.index_type?.toUpperCase()}, Percentual: ${form.index_percentage}%.\nNovo valor: R$ ${Number(form.new_value).toFixed(2)}.\n${form.notes || ""}`,
            created_by: user.id,
            submitted_at: new Date().toISOString(),
            tenant_id,
          })
          .select()
          .single();
        if (drErr) throw drErr;
        deal_request_id = dr.id;

        await supabase.from("deal_request_history").insert({
          deal_request_id: dr.id,
          to_status: "enviado_juridico",
          notes: "Aditivo de reajuste enviado automaticamente ao jurídico.",
          created_by: user.id,
          tenant_id,
        });
      }

      const { property_id: _pid, ...rest } = form;
      const { error } = await supabase.from("rent_adjustments").insert([{
        ...rest,
        index_type: rest.index_type as any,
        deal_request_id,
        created_by: user.id,
      } as any]);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["rent-adjustments"] });
      if (variables.requires_addendum) {
        qc.invalidateQueries({ queryKey: ["deal-requests"] });
        toast.success("Reajuste criado e aditivo enviado ao jurídico!");
      } else {
        toast.success("Reajuste criado!");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateRentAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: Partial<RentAdjustment> & { id: string }) => {
      const { error } = await supabase.from("rent_adjustments").update(form as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rent-adjustments"] });
      toast.success("Reajuste atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApplyRentAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, contractId, newValue }: { id: string; contractId: string; newValue: number }) => {
      const { error: cErr } = await supabase
        .from("contracts")
        .update({ monthly_value: newValue })
        .eq("id", contractId);
      if (cErr) throw cErr;

      const { data: contract } = await supabase
        .from("contracts")
        .select("property_id, monthly_value")
        .eq("id", contractId)
        .single();
      
      if (contract) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // tenantUtils imported statically at top
          const tid = await getAuthTenantId();
          await supabase.from("property_price_history").insert([{
            property_id: contract.property_id,
            price_type: "rental_price",
            old_value: contract.monthly_value,
            new_value: newValue,
            changed_by: user.id,
            notes: `Reajuste de aluguel aplicado via contrato ${contractId}`,
            tenant_id: tid,
          }]);

          await supabase.from("properties").update({ rental_price: newValue }).eq("id", contract.property_id);
        }
      }

      const { error } = await supabase
        .from("rent_adjustments")
        .update({ status: "aplicado", applied_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rent-adjustments"] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["price-history"] });
      toast.success("Reajuste aplicado ao contrato e preço do imóvel atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useContractsNeedingAdjustment() {
  return useQuery({
    queryKey: ["contracts-needing-adjustment"],
    queryFn: async () => {
      const { data: contracts, error } = await supabase
        .from("contracts")
        .select(`
          id, monthly_value, start_date, end_date, adjustment_index, property_id,
          properties:property_id ( id, title ),
          contract_parties ( person_id, role, people:person_id ( id, name ) )
        `)
        .eq("status", "ativo")
        .eq("contract_type", "locacao")
        .not("adjustment_index", "is", null);
      
      if (error) throw error;
      if (!contracts) return [];

      const now = new Date();
      const needsAdjustment: any[] = [];

      for (const c of contracts) {
        if (!c.start_date || !c.adjustment_index) continue;
        const start = new Date(c.start_date);
        const yearsSinceStart = now.getFullYear() - start.getFullYear();
        const nextAnniversary = new Date(start);
        nextAnniversary.setFullYear(start.getFullYear() + yearsSinceStart);
        if (nextAnniversary < now) {
          nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1);
        }

        const daysUntil = Math.ceil((nextAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 30 && daysUntil >= -7) {
          const adjustmentYear = nextAnniversary.getFullYear();
          const { data: existing } = await supabase
            .from("rent_adjustments")
            .select("id")
            .eq("contract_id", c.id)
            .gte("adjustment_date", `${adjustmentYear}-01-01`)
            .lte("adjustment_date", `${adjustmentYear}-12-31`);
          
          if (!existing || existing.length === 0) {
            needsAdjustment.push({
              ...c,
              days_until_anniversary: daysUntil,
              next_anniversary: nextAnniversary.toISOString().split("T")[0],
            });
          }
        }
      }

      return needsAdjustment;
    },
  });
}
