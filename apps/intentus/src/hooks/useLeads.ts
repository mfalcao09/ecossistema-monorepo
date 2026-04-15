import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { triggerCommercialEvent } from "@/hooks/useCommercialAutomationEngine";
import { emitPulseEvent } from "@/hooks/usePulseFeed";
import { autoAssignLeadFireAndForget } from "@/hooks/useLeadDistribution";

type LeadStatus = Database["public"]["Enums"]["lead_status"];
type LeadSource = Database["public"]["Enums"]["lead_source"];

export interface Lead {
  id: string; person_id: string | null; name: string; email: string | null; phone: string | null;
  source: LeadSource; status: LeadStatus; assigned_to: string | null; property_id: string | null;
  interest_type: string | null; budget_min: number | null; budget_max: number | null;
  preferred_region: string | null; notes: string | null; last_contact_at: string | null;
  converted_person_id: string | null; converted_at: string | null; created_by: string | null;
  lead_score: number | null; score_evaluated_at: string | null; scoring_model_used: string | null;
  created_at: string; updated_at: string;
}

export const leadStatusLabels: Record<string, string> = { novo: "Novo", contatado: "Contatado", qualificado: "Qualificado", visita_agendada: "Visita Agendada", proposta: "Proposta", convertido: "Convertido", perdido: "Perdido" };
export const leadStatusColors: Record<string, string> = { novo: "bg-blue-100 text-blue-800", contatado: "bg-cyan-100 text-cyan-800", qualificado: "bg-violet-100 text-violet-800", visita_agendada: "bg-amber-100 text-amber-800", proposta: "bg-orange-100 text-orange-800", convertido: "bg-green-100 text-green-800", perdido: "bg-red-100 text-red-800" };
export const leadSourceLabels: Record<string, string> = { site: "Site", portal: "Portal Imobiliário", indicacao: "Indicação", whatsapp: "WhatsApp", telefone: "Telefone", walk_in: "Presencial", outro: "Outro" };

export function useLeads(filters?: { search?: string; status?: string; source?: string }) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel("leads-realtime").on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => { qc.invalidateQueries({ queryKey: ["leads"] }); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["leads", filters],
    queryFn: async () => {
      let q = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(500);
      if (filters?.status && filters.status !== "todos") q = q.eq("status", filters.status as LeadStatus);
      if (filters?.source && filters.source !== "todos") q = q.eq("source", filters.source as LeadSource);
      const { data, error } = await q;
      if (error) throw error;
      let results = data as unknown as Lead[];
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        results = results.filter((l) => l.name.toLowerCase().includes(s) || (l.email || "").toLowerCase().includes(s) || (l.phone || "").includes(s));
      }
      return results;
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: Omit<Lead, "id" | "created_by" | "created_at" | "updated_at" | "converted_person_id" | "converted_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { data, error } = await supabase.from("leads").insert({
        name: form.name, email: form.email, phone: form.phone, source: form.source, status: form.status,
        assigned_to: form.assigned_to, property_id: form.property_id, interest_type: form.interest_type,
        budget_min: form.budget_min, budget_max: form.budget_max, preferred_region: form.preferred_region,
        notes: form.notes, person_id: form.person_id, last_contact_at: form.last_contact_at, created_by: user.id, tenant_id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead cadastrado!");
      // Fire-and-forget: dispara automações comerciais para lead_criado
      if (data?.id) {
        triggerCommercialEvent("lead_criado", data.id, "lead", { name: data.name, source: data.source, status: data.status });
        emitPulseEvent({ event_type: "lead_created", entity_type: "lead", entity_id: data.id, entity_name: data.name, metadata: { source: data.source, status: data.status } });
        // Auto-assign: só dispara se não houve atribuição manual
        if (!data.assigned_to) {
          autoAssignLeadFireAndForget(data.id, qc);
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: Partial<Lead> & { id: string }) => {
      const { error } = await supabase.from("leads").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead atualizado!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead removido!"); },
    onError: (e: Error) => toast.error(e.message),
  });
}
