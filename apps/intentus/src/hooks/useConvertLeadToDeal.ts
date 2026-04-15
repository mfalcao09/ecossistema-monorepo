import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Lead } from "@/hooks/useLeads";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useConvertLeadToDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lead,
      propertyId,
      dealType,
    }: {
      lead: Lead;
      propertyId?: string;
      dealType?: "venda" | "locacao";
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      const resolvedPropertyId = propertyId || lead.property_id;
      if (!resolvedPropertyId) throw new Error("Nenhum imóvel vinculado ao lead. Selecione um imóvel.");
      
      const resolvedDealType = dealType || (lead.interest_type === "venda" ? "venda" : "locacao") as "venda" | "locacao";

      const { data: deal, error: dealErr } = await supabase
        .from("deal_requests")
        .insert({
          property_id: resolvedPropertyId,
          deal_type: resolvedDealType,
          status: "rascunho" as any,
          proposed_value: resolvedDealType === "venda" ? (lead.budget_max || null) : null,
          proposed_monthly_value: resolvedDealType === "locacao" ? (lead.budget_max || null) : null,
          commercial_notes: `Convertido do lead: ${lead.name}. Origem: ${lead.source || "—"}. Região: ${lead.preferred_region || "—"}. ${lead.notes || ""}`.trim(),
          created_by: user.id,
          tenant_id,
        })
        .select()
        .single();
      if (dealErr) throw dealErr;

      if (lead.person_id) {
        const role = resolvedDealType === "venda" ? "comprador" : "locatario";
        await supabase.from("deal_request_parties").insert({
          deal_request_id: deal.id,
          person_id: lead.person_id,
          role,
          tenant_id,
        });
      }

      await supabase.from("deal_request_history").insert({
        deal_request_id: deal.id,
        to_status: "rascunho" as any,
        notes: `Negócio criado a partir do lead "${lead.name}".`,
        created_by: user.id,
        tenant_id,
      });

      await supabase.from("leads" as any).update({
        status: "convertido",
        converted_at: new Date().toISOString(),
      } as any).eq("id", lead.id);

      return deal;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["deal-requests"] });
      toast.success("Lead convertido em negócio com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
