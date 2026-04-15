import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthContext } from "@/lib/tenantUtils";

export function useDealAttachments(dealId: string) {
  return useQuery({
    queryKey: ["deal-attachments", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_request_attachments")
        .select("*")
        .eq("deal_request_id", dealId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUploadDealAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, file }: { dealId: string; file: File }) => {
      const { userId, tenantId } = await getAuthContext();
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/${dealId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("deal-attachments")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("deal-attachments")
        .getPublicUrl(path);

      // Since bucket is private, we store the path and generate signed URLs
      const { error: insertError } = await supabase
        .from("deal_request_attachments")
        .insert({
          deal_request_id: dealId,
          file_name: file.name,
          file_url: path,
          file_size: file.size,
          file_type: file.type || ext,
          uploaded_by: userId,
          tenant_id: tenantId,
        });
      if (insertError) throw insertError;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["deal-attachments", vars.dealId] });
      toast.success("Arquivo enviado!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao enviar: ${err.message}`);
    },
  });
}

export function useDeleteDealAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fileUrl, dealId }: { id: string; fileUrl: string; dealId: string }) => {
      await supabase.storage.from("deal-attachments").remove([fileUrl]);
      const { error } = await supabase
        .from("deal_request_attachments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["deal-attachments", vars.dealId] });
      toast.success("Anexo removido.");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover: ${err.message}`);
    },
  });
}

export function useSignedUrl(path: string | undefined) {
  return useQuery({
    queryKey: ["signed-url", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000, // 50 min
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("deal-attachments")
        .createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
