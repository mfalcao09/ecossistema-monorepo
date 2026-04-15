import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { triggerCommercialEvent } from "@/hooks/useCommercialAutomationEngine";
import { emitPulseEvent } from "@/hooks/usePulseFeed";

type InteractionType = Database["public"]["Enums"]["interaction_type"];

export const interactionTypeLabels: Record<string, string> = { ligacao: "Ligação", email: "Email", whatsapp: "WhatsApp", visita: "Visita", reuniao: "Reunião", outro: "Outro" };

export function useInteractions(personId: string | null | undefined) {
  return useQuery({
    queryKey: ["interactions", personId],
    queryFn: async () => {
      const { data, error } = await supabase.from("interactions").select("*").eq("person_id", personId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!personId,
  });
}

export function useCreateInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ person_id, interaction_type, notes }: { person_id: string; interaction_type: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("interactions").insert({
        person_id, user_id: user.id, interaction_type: interaction_type as InteractionType, notes: notes || null, tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["interactions", v.person_id] });
      toast.success("Interação registrada!");
      // Fire-and-forget: dispara automação comercial quando interação é visita
      if (v.interaction_type === "visita") {
        triggerCommercialEvent("visita_realizada", v.person_id, "lead", { interaction_type: v.interaction_type, notes: v.notes });
        emitPulseEvent({ event_type: "visit_scheduled", entity_type: "person", entity_id: v.person_id, metadata: { notes: v.notes } });
      }
      // Pulse Feed: toda interação registrada
      emitPulseEvent({ event_type: "interaction_logged", entity_type: "person", entity_id: v.person_id, metadata: { interaction_type: v.interaction_type, notes: v.notes } });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
