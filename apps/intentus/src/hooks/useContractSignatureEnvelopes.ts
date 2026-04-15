/**
 * useContractSignatureEnvelopes - Hook para envelopes de assinatura digital
 *
 * Consome a tabela `contract_signature_envelopes` criada automaticamente
 * quando um contrato entra no status `aguardando_assinatura`.
 *
 * Status do envelope: criado → enviado → visualizado → assinado_parcial → assinado → recusado → expirado
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface SignatureEnvelope {
  id: string;
  contract_id: string;
  status: "criado" | "enviado" | "visualizado" | "assinado_parcial" | "assinado" | "recusado" | "expirado";
  provider: "clicksign" | "docusign" | "d4sign" | "manual";
  external_id: string | null;
  external_url: string | null;
  document_url: string | null;
  signed_document_url: string | null;
  signatories: Array<{
    name: string;
    email: string;
    role: string;
    signed_at?: string;
  }> | null;
  sent_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  reminder_count: number;
  created_at: string;
}

/**
 * Busca envelopes de assinatura de um contrato.
 */
export function useContractSignatureEnvelopes(contractId: string | undefined) {
  return useQuery<SignatureEnvelope[]>({
    queryKey: ["contract-signature-envelopes", contractId],
    queryFn: async () => {
      if (!contractId) return [];

      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_signature_envelopes")
        .select("*")
        .eq("contract_id", contractId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar envelopes de assinatura:", error);
        throw new Error(error.message);
      }

      return (data as unknown as SignatureEnvelope[]) || [];
    },
    enabled: !!contractId,
    staleTime: 30 * 1000,
  });
}

/**
 * Contagem de envelopes pendentes (para badge no Command Center).
 */
export function usePendingSignatureCount() {
  return useQuery<number>({
    queryKey: ["pending-signature-count"],
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { count, error } = await supabase
        .from("contract_signature_envelopes")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["criado", "enviado", "visualizado", "assinado_parcial"]);

      if (error) {
        console.error("Erro ao contar assinaturas pendentes:", error);
        return 0;
      }

      return count || 0;
    },
    refetchInterval: 5 * 60 * 1000, // 5 min (was 2 min — reduce dashboard query cascade)
    staleTime: 2 * 60 * 1000, // 2 min (was 1 min)
  });
}

/**
 * Envia lembrete para signatários.
 */
export function useSendSignatureReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (envelopeId: string) => {
      const { error } = await supabase
        .from("contract_signature_envelopes")
        .update({
          reminder_count: supabase.rpc ? undefined : 0, // incrementado via trigger
        })
        .eq("id", envelopeId);

      if (error) throw new Error(error.message);

      // TODO: Integrar com Clicksign API real para enviar lembrete
      toast.info("Funcionalidade de envio de lembrete será integrada com Clicksign.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-signature-envelopes"] });
    },
  });
}
