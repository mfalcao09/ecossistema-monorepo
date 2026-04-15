import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

export type EnvelopeFilter = "todos" | "em_processo" | "finalizados" | "cancelados" | "rascunhos" | "lixeira" | "prazos" | "lembretes" | "contatos";

function buildStatusFilter(filter: EnvelopeFilter) {
  switch (filter) {
    case "em_processo": return { statuses: ["enviado", "parcialmente_assinado"], deletedOnly: false };
    case "finalizados": return { statuses: ["concluido"], deletedOnly: false };
    case "cancelados": return { statuses: ["cancelado", "expirado"], deletedOnly: false };
    case "rascunhos": return { statuses: ["rascunho"], deletedOnly: false };
    case "lixeira": return { statuses: null, deletedOnly: true };
    case "prazos": return { statuses: ["enviado", "parcialmente_assinado", "rascunho"], deletedOnly: false };
    case "lembretes": return { statuses: ["enviado", "parcialmente_assinado"], deletedOnly: false };
    default: return { statuses: null, deletedOnly: false };
  }
}

export function useSignatureEnvelopes(departmentId: string | null, filter: EnvelopeFilter = "todos") {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const { statuses, deletedOnly } = buildStatusFilter(filter);

  const { data: envelopes = [], isLoading } = useQuery({
    queryKey: ["signature-envelopes", departmentId, filter],
    enabled: !!departmentId && !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from("legal_signature_envelopes")
        .select("*")
        .eq("department_team_id", departmentId!)
        .order("created_at", { ascending: false });

      if (deletedOnly) {
        query = query.not("deleted_at", "is", null);
      } else {
        query = query.is("deleted_at", null);
        if (statuses) {
          query = query.in("status", statuses);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: signersByEnvelope = {} } = useQuery({
    queryKey: ["signature-signers-map", departmentId],
    enabled: !!departmentId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_signature_signers")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      const map: Record<string, any[]> = {};
      (data ?? []).forEach((s: any) => {
        if (!map[s.envelope_id]) map[s.envelope_id] = [];
        map[s.envelope_id].push(s);
      });
      return map;
    },
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("legal_signature_envelopes")
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["signature-envelopes"] }); toast.success("Movido para lixeira"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("legal_signature_envelopes")
        .update({ deleted_at: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["signature-envelopes"] }); toast.success("Restaurado!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const permanentDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("legal_signature_envelopes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["signature-envelopes"] }); toast.success("Excluído permanentemente"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // KPI counts (all non-deleted)
  const { data: kpis } = useQuery({
    queryKey: ["signature-kpis", departmentId],
    enabled: !!departmentId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_signature_envelopes")
        .select("status, deleted_at")
        .eq("department_team_id", departmentId!);
      if (error) throw error;
      const active = (data ?? []).filter((e: any) => !e.deleted_at);
      return {
        em_processo: active.filter((e: any) => ["enviado", "parcialmente_assinado"].includes(e.status)).length,
        finalizados: active.filter((e: any) => e.status === "concluido").length,
        cancelados: active.filter((e: any) => ["cancelado", "expirado"].includes(e.status)).length,
        rascunhos: active.filter((e: any) => e.status === "rascunho").length,
        total: active.length,
        lixeira: (data ?? []).filter((e: any) => !!e.deleted_at).length,
      };
    },
  });

  return {
    envelopes,
    signersByEnvelope,
    isLoading,
    kpis: kpis ?? { em_processo: 0, finalizados: 0, cancelados: 0, rascunhos: 0, total: 0, lixeira: 0 },
    softDelete,
    restore,
    permanentDelete,
  };
}
