import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

type CollectionActionType = Database["public"]["Enums"]["collection_action_type"];

export interface CollectionRule {
  id: string;
  name: string;
  days_after_due: number;
  action_type: CollectionActionType;
  message_template: string | null;
  notify_webhook: boolean;
  block_owner_transfer: boolean;
  create_legal_card: boolean;
  department: string | null;
  active: boolean;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CollectionEvent {
  id: string;
  installment_id: string;
  rule_id: string | null;
  action_type: CollectionActionType;
  action_date: string;
  status: string;
  webhook_response: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export const collectionActionLabels: Record<string, string> = {
  lembrete_vencimento: "Lembrete de Vencimento",
  cobranca_amigavel: "Cobrança Amigável",
  aviso_multa_juros: "Aviso de Multa/Juros",
  notificacao_formal: "Notificação Formal",
  acionamento_garantia: "Acionamento de Garantia",
  encaminhamento_renegociacao: "Encaminhamento p/ Renegociação",
  dossie_despejo: "Dossiê p/ Ação de Despejo",
};

export function useCollectionRules() {
  return useQuery({
    queryKey: ["collection-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collection_rules")
        .select("*")
        .order("days_after_due", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CollectionRule[];
    },
  });
}

export function useCreateCollectionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: Omit<CollectionRule, "id" | "created_by" | "created_at" | "updated_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("collection_rules").insert({
        name: form.name,
        days_after_due: form.days_after_due,
        action_type: form.action_type,
        message_template: form.message_template,
        notify_webhook: form.notify_webhook,
        block_owner_transfer: form.block_owner_transfer,
        create_legal_card: form.create_legal_card,
        department: form.department,
        active: form.active,
        sort_order: form.sort_order,
        created_by: user.id,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-rules"] });
      toast.success("Regra de cobrança criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCollectionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...form }: Partial<CollectionRule> & { id: string }) => {
      const { error } = await supabase.from("collection_rules").update(form).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-rules"] });
      toast.success("Regra atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCollectionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collection_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection-rules"] });
      toast.success("Regra removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCollectionEvents(installmentId?: string) {
  return useQuery({
    queryKey: ["collection-events", installmentId],
    queryFn: async () => {
      let q = supabase.from("collection_events").select("*").order("action_date", { ascending: false });
      if (installmentId) q = q.eq("installment_id", installmentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CollectionEvent[];
    },
    enabled: installmentId !== undefined,
  });
}
