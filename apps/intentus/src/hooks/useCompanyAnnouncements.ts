import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

export interface Announcement {
  id: string;
  title: string;
  content: string | null;
  priority: string;
  active: boolean;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export function useCompanyAnnouncements() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["company-announcements", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_announcements")
        .select("*")
        .eq("active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as unknown as Announcement[];
    },
    staleTime: 60_000,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: { title: string; content?: string; priority?: string; expires_at?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const tenant_id = await getAuthTenantId();
      const { error } = await supabase.from("company_announcements").insert({
        title: form.title,
        content: form.content || null,
        priority: form.priority || "normal",
        expires_at: form.expires_at || null,
        created_by: user.id,
        tenant_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-announcements"] });
      toast.success("Aviso criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
