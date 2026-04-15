import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type ContractStatus = Database["public"]["Enums"]["dev_contract_status"];

export function useDevelopmentContracts(developmentId?: string) {
  return useQuery({
    queryKey: ["development-contracts", developmentId],
    queryFn: async () => {
      let q = supabase
        .from("development_contracts")
        .select("*, development_proposals(*, development_units(unit_identifier, development_id), client:people!development_proposals_client_person_id_fkey(full_name), broker:people!development_proposals_broker_person_id_fkey(full_name))")
        .order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      // Client-side filter by developmentId if provided
      if (developmentId && data) {
        return data.filter((c: any) => c.development_proposals?.development_units?.development_id === developmentId);
      }
      return data ?? [];
    },
  });
}

export function useUpdateContractStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, data_assinatura, link_documento }: { id: string; status: ContractStatus; data_assinatura?: string; link_documento?: string }) => {
      const updates: any = { status };
      if (data_assinatura) updates.data_assinatura = data_assinatura;
      if (link_documento) updates.link_documento = link_documento;
      const { error } = await supabase.from("development_contracts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["development-contracts"] });
      toast.success("Contrato atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
