import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function useContractDocuments(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contract-documents", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_documents")
        .select("*")
        .eq("contract_id", contractId!)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useDocumentVersions(parentDocumentId: string | undefined) {
  return useQuery({
    queryKey: ["document-versions", parentDocumentId],
    enabled: !!parentDocumentId,
    queryFn: async () => {
      const tenantId = await getAuthTenantId();
      const { data, error } = await supabase
        .from("contract_documents")
        .select("*")
        .eq("tenant_id", tenantId)
        .or(`id.eq.${parentDocumentId},parent_document_id.eq.${parentDocumentId}`)
        .order("version", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useUploadContractDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      file,
      title,
      documentType,
      notes,
      parentDocumentId,
      version,
    }: {
      contractId: string;
      file: File;
      title: string;
      documentType: string;
      notes?: string;
      parentDocumentId?: string;
      version?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      const filePath = `${tenant_id}/${contractId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("contract-documents")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("contract_documents")
        .insert({
          contract_id: contractId,
          title,
          document_type: documentType,
          file_path: filePath,
          notes: notes || null,
          uploaded_by: user.id,
          tenant_id,
          parent_document_id: parentDocumentId || null,
          version: version || 1,
        })
        .select()
        .single();
      if (error) throw error;

      // Log to audit
      await supabase.from("contract_audit_trail").insert({
        contract_id: contractId,
        action: "documento_enviado",
        performed_by: user.id,
        performer_name: user.email || "Usuário",
        tenant_id,
        details: { title, document_type: documentType, version: version || 1 },
      });

      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["contract-documents", vars.contractId] });
      qc.invalidateQueries({ queryKey: ["contract-audit-trail", vars.contractId] });
      toast.success("Documento enviado com sucesso!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUpdateDocumentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, contractId }: { id: string; status: string; contractId: string }) => {
      const { data, error } = await supabase
        .from("contract_documents")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["contract-documents", data.contract_id] });
      toast.success("Status do documento atualizado!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteContractDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, filePath, contractId }: { id: string; filePath: string; contractId: string }) => {
      await supabase.storage.from("contract-documents").remove([filePath]);
      const { error } = await supabase.from("contract_documents").delete().eq("id", id);
      if (error) throw error;
      return contractId;
    },
    onSuccess: (contractId) => {
      qc.invalidateQueries({ queryKey: ["contract-documents", contractId] });
      toast.success("Documento removido!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
