import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { escapeIlike } from "@/lib/searchUtils";

export type PropertyMedia = Tables<"property_media">;

export type Property = Tables<"properties">;
export type PropertyInsert = TablesInsert<"properties">;
export type PropertyUpdate = TablesUpdate<"properties">;

export function useProperties(filters?: {
  search?: string;
  property_type?: string;
  purpose?: string;
  status?: string;
  intake_status?: string;
}) {
  return useQuery({
    queryKey: ["properties", filters],
    queryFn: async () => {
      let query = supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.property_type && filters.property_type !== "todos") {
        query = query.eq("property_type", filters.property_type as Property["property_type"]);
      }
      if (filters?.purpose && filters.purpose !== "todos") {
        query = query.eq("purpose", filters.purpose as Property["purpose"]);
      }
      if (filters?.status && filters.status !== "todos") {
        query = query.eq("status", filters.status as Property["status"]);
      } else {
        // By default, exclude inactive properties
        query = query.neq("status", "inativo" as any);
      }
      if (filters?.intake_status && filters.intake_status !== "todos") {
        query = query.eq("intake_status", filters.intake_status as any);
      }
      if (filters?.search) {
        const s = escapeIlike(filters.search);
        query = query.or(
          `title.ilike.%${s}%,street.ilike.%${s}%,neighborhood.ilike.%${s}%,city.ilike.%${s}%,property_code.ilike.%${s}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Property[];
    },
  });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ["properties", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Property;
    },
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (property: Omit<PropertyInsert, "created_by">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const tenantId = await getAuthTenantId();
      if (!tenantId) throw new Error("Tenant não encontrado para o usuário");

      const { data, error } = await supabase
        .from("properties")
        .insert({ ...property, created_by: user.id, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["properties-select"] });
      toast.success("Imóvel cadastrado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao cadastrar: ${err.message}`);
    },
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: PropertyUpdate & { id: string }) => {
      // Get current values for price history tracking
      const { data: current } = await supabase
        .from("properties")
        .select("sale_price, rental_price")
        .eq("id", id)
        .single();

      const { data, error } = await supabase
        .from("properties")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      // Log price changes (Item 14)
      if (current) {
        const { data: { user } } = await supabase.auth.getUser();
        const priceChanges: any[] = [];
        if (updates.sale_price !== undefined && Number(updates.sale_price) !== Number(current.sale_price)) {
          priceChanges.push({
            property_id: id,
            price_type: "sale_price",
            old_value: current.sale_price,
            new_value: updates.sale_price,
            changed_by: user?.id,
          });
        }
        if (updates.rental_price !== undefined && Number(updates.rental_price) !== Number(current.rental_price)) {
          priceChanges.push({
            property_id: id,
            price_type: "rental_price",
            old_value: current.rental_price,
            new_value: updates.rental_price,
            changed_by: user?.id,
          });
        }
        if (priceChanges.length > 0) {
          await supabase.from("property_price_history" as any).insert(priceChanges as any);
        }
      }

      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["properties-select"] });
      qc.invalidateQueries({ queryKey: ["properties", data.id] });
      toast.success("Imóvel atualizado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });
}

// ─── Update intake status ────────────────────────────────────
export function useUpdateIntakeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, intake_status }: { id: string; intake_status: string }) => {
      const updatePayload: any = { intake_status };
      if (intake_status === "aprovado") {
        const { data: { user } } = await supabase.auth.getUser();
        updatePayload.intake_approved_at = new Date().toISOString();
        updatePayload.intake_approved_by = user?.id;
      }
      if (intake_status === "publicado") {
        updatePayload.show_on_website = true;
      }
      const { error } = await supabase.from("properties").update(updatePayload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      toast.success("Status de captação atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Update published portals ────────────────────────────────
export function useUpdatePublishedPortals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, portals }: { id: string; portals: string[] }) => {
      const { error } = await supabase
        .from("properties")
        .update({ published_portals: portals } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      toast.success("Portais atualizados!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related media from storage + DB
      const { data: media } = await supabase.from("property_media").select("media_url").eq("property_id", id);
      if (media && media.length > 0) {
        const paths = media.map((m: any) => { const p = m.media_url?.split("/property-images/"); return p?.[1] ?? null; }).filter(Boolean);
        if (paths.length > 0) await supabase.storage.from("property-images").remove(paths);
      }
      await supabase.from("property_media").delete().eq("property_id", id);

      // Delete attachments from storage + DB
      const { data: attachments } = await supabase.from("property_attachments").select("file_url").eq("property_id", id);
      if (attachments && attachments.length > 0) {
        const paths = attachments.map((a: any) => { const p = a.file_url?.split("/property-documents/"); return p?.[1] ?? null; }).filter(Boolean);
        if (paths.length > 0) await supabase.storage.from("property-documents").remove(paths);
      }
      await supabase.from("property_attachments").delete().eq("property_id", id);

      // Delete features, owners, keys
      await supabase.from("property_features").delete().eq("property_id", id);
      await supabase.from("property_owners").delete().eq("property_id", id);
      await supabase.from("property_keys" as any).delete().eq("property_id", id);

      // Delete the property itself
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["properties-select"] });
      toast.success("Imóvel excluído permanentemente!");
    },
    onError: (err: Error) => toast.error(`Erro ao excluir: ${err.message}`),
  });
}

export function useInactivateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("properties")
        .update({
          status: "inativo" as any,
          show_on_website: false,
          inactivated_at: new Date().toISOString(),
          inactivation_reason: reason,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["properties-select"] });
      toast.success("Imóvel inativado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao inativar: ${err.message}`);
    },
  });
}

// ─── Property Features ───────────────────────────────────────
export function usePropertyFeatures(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["property-features", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_features")
        .select("*")
        .eq("property_id", propertyId!)
        .order("feature_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSavePropertyFeatures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, features }: { propertyId: string; features: string[] }) => {
      await supabase.from("property_features").delete().eq("property_id", propertyId);
      if (features.length > 0) {
        const tenant_id = await getAuthTenantId();
        const { error } = await supabase.from("property_features").insert(
          features.map((f) => ({ property_id: propertyId, feature_name: f, tenant_id }))
        );
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["property-features", vars.propertyId] });
    },
  });
}

// ─── Property Media ──────────────────────────────────────────
export function usePropertyMedia(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["property-media", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_media")
        .select("*")
        .eq("property_id", propertyId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as PropertyMedia[];
    },
  });
}

export function useUploadPropertyImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, file }: { propertyId: string; file: File }) => {
      const ext = file.name.split(".").pop();
      const path = `${propertyId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("property-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("property-images")
        .getPublicUrl(path);

      // Get current max order
      const { data: existing } = await supabase
        .from("property_media")
        .select("display_order")
        .eq("property_id", propertyId)
        .order("display_order", { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;
      const tenant_id = await getAuthTenantId();

      const { error: insertError } = await supabase
        .from("property_media")
        .insert({
          property_id: propertyId,
          media_url: urlData.publicUrl,
          media_type: "image",
          display_order: nextOrder,
          tenant_id,
        });
      if (insertError) throw insertError;

      return urlData.publicUrl;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["property-media", vars.propertyId] });
      toast.success("Imagem enviada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao enviar imagem: ${err.message}`);
    },
  });
}

export function useDeletePropertyImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mediaId, mediaUrl, propertyId }: { mediaId: string; mediaUrl: string; propertyId: string }) => {
      // Extract storage path from URL
      const urlParts = mediaUrl.split("/property-images/");
      if (urlParts.length > 1) {
        await supabase.storage.from("property-images").remove([urlParts[1]]);
      }
      const { error } = await supabase.from("property_media").delete().eq("id", mediaId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["property-media", vars.propertyId] });
      toast.success("Imagem removida!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover: ${err.message}`);
    },
  });
}

// ─── Property Attachments ────────────────────────────────────
export function usePropertyAttachments(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["property-attachments", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_attachments")
        .select("*")
        .eq("property_id", propertyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUploadPropertyAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, file }: { propertyId: string; file: File }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const path = `${propertyId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("property-documents")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("property-documents")
        .getPublicUrl(path);

      const tenant_id = await getAuthTenantId();
      const { error: insertError } = await supabase
        .from("property_attachments")
        .insert({
          property_id: propertyId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
          created_by: user.id,
          tenant_id,
        });
      if (insertError) throw insertError;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["property-attachments", vars.propertyId] });
      toast.success("Anexo enviado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao enviar anexo: ${err.message}`);
    },
  });
}

export function useDeletePropertyAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fileUrl, propertyId }: { id: string; fileUrl: string; propertyId: string }) => {
      const urlParts = fileUrl.split("/property-documents/");
      if (urlParts.length > 1) {
        await supabase.storage.from("property-documents").remove([urlParts[1]]);
      }
      const { error } = await supabase.from("property_attachments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["property-attachments", vars.propertyId] });
      toast.success("Anexo removido!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover: ${err.message}`);
    },
  });
}

// ─── Property Owners ─────────────────────────────────────────
export function usePropertyOwners(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["property-owners", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_owners")
        .select("*, people(id, name, cpf_cnpj, phone, email)")
        .eq("property_id", propertyId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useAddPropertyOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, personId }: { propertyId: string; personId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase
        .from("property_owners")
        .insert({ property_id: propertyId, person_id: personId, created_by: user.id, tenant_id });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["property-owners", vars.propertyId] });
      toast.success("Proprietário vinculado!");
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}

export function useRemovePropertyOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabase.from("property_owners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["property-owners", vars.propertyId] });
      toast.success("Proprietário removido!");
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}

// ─── Property Keys (Chaveiros) ───────────────────────────────
export function usePropertyKeys(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["property-keys", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_keys")
        .select("*")
        .eq("property_id", propertyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddPropertyKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { property_id: string; key_code: string; key_type: string; location?: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("property_keys").insert({ ...payload, created_by: user.id, tenant_id });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["property-keys", vars.property_id] });
      toast.success("Chave cadastrada!");
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}

export function useDeletePropertyKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabase.from("property_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["property-keys", vars.propertyId] });
      toast.success("Chave removida!");
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });
}
