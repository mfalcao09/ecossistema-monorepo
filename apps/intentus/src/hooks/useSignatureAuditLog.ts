import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useSignatureAuditLog(envelopeId: string | null) {
  const { user } = useAuth();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["signature-audit-log", envelopeId],
    enabled: !!envelopeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_signature_audit_log")
        .select("*")
        .eq("envelope_id", envelopeId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const qc = useQueryClient();

  const addLog = useMutation({
    mutationFn: async (entry: { action: string; details?: Record<string, any>; envelopeId: string }) => {
      const tenant_id = await getAuthTenantId();
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", user?.id ?? "")
        .single();

      const { error } = await supabase.from("legal_signature_audit_log").insert({
        envelope_id: entry.envelopeId,
        action: entry.action,
        performed_by: user?.id ?? null,
        performer_name: profile?.name ?? user?.email ?? "Sistema",
        ip_address: null,
        user_agent: navigator.userAgent,
        details: entry.details ?? null,
        tenant_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature-audit-log"] });
    },
  });

  return { logs, isLoading, addLog };
}
