import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export function usePropertyDocuments(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["property-documents", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_documents")
        .select("*")
        .eq("property_id", propertyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUploadPropertyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      propertyId, file, title, documentType, documentCategory, notes, expiresAt, reminderDays,
    }: {
      propertyId: string;
      file: File;
      title: string;
      documentType: string;
      documentCategory?: string;
      notes?: string;
      expiresAt?: string;
      reminderDays?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      const filePath = `${tenant_id}/${propertyId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("property-docs")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("property_documents")
        .insert({
          property_id: propertyId,
          title,
          document_type: documentType,
          document_category: documentCategory || "geral",
          file_path: filePath,
          notes: notes || null,
          uploaded_by: user.id,
          tenant_id,
          expires_at: expiresAt || null,
          reminder_days: reminderDays || 30,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["property-documents", vars.propertyId] });
      toast.success("Documento enviado com sucesso!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUpdatePropertyDocumentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, propertyId }: { id: string; status: string; propertyId: string }) => {
      const { data, error } = await supabase
        .from("property_documents")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["property-documents", data.property_id] });
      toast.success("Status atualizado!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeletePropertyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, filePath, propertyId }: { id: string; filePath: string; propertyId: string }) => {
      await supabase.storage.from("property-docs").remove([filePath]);
      const { error } = await supabase.from("property_documents").delete().eq("id", id);
      if (error) throw error;
      return propertyId;
    },
    onSuccess: (propertyId) => {
      qc.invalidateQueries({ queryKey: ["property-documents", propertyId] });
      toast.success("Documento removido!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function usePropertyDocumentToken(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["property-doc-token", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_document_tokens")
        .select("*")
        .eq("property_id", propertyId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePropertyDocumentToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId }: { propertyId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      const { data, error } = await supabase
        .from("property_document_tokens")
        .insert({ property_id: propertyId, tenant_id, created_by: user.id, token: crypto.randomUUID() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["property-doc-token", vars.propertyId] });
      toast.success("QR Code gerado com sucesso!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useExtractionTemplates() {
  return useQuery({
    queryKey: ["extraction-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_extraction_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveExtractionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, docType, fields }: { id?: string; name: string; docType: string; fields: any[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();

      if (id) {
        const { data, error } = await supabase
          .from("document_extraction_templates")
          .update({ name, doc_type: docType, fields })
          .eq("id", id)
          .select().single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("document_extraction_templates")
          .insert({ name, doc_type: docType, fields, tenant_id, created_by: user.id })
          .select().single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extraction-templates"] });
      toast.success("Template salvo!");
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
