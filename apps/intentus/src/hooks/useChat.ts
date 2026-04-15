import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import type { Database } from "@/integrations/supabase/types";

type ChatChannel = Database["public"]["Tables"]["chat_channels"]["Row"];
type ChatContact = Database["public"]["Tables"]["chat_contacts"]["Row"];
type ChatTag = Database["public"]["Tables"]["chat_tags"]["Row"];
type ChatConversation = Database["public"]["Tables"]["chat_conversations"]["Row"];
type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
type ChatQueue = Database["public"]["Tables"]["chat_queues"]["Row"];
type ChatCampaign = Database["public"]["Tables"]["chat_campaigns"]["Row"];
type ChatFile = Database["public"]["Tables"]["chat_files"]["Row"];
type ChatIntegration = Database["public"]["Tables"]["chat_integrations"]["Row"];

// ==================== CHANNELS ====================
export function useChatChannels() {
  return useQuery({
    queryKey: ["chat_channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .neq("status", "deletado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChatChannel[];
    },
  });
}

export function useCreateChatChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; channel_type: string; phone_number?: string }) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("chat_channels").insert({
        ...values,
        channel_type: values.channel_type as any,
        tenant_id: tenantId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_channels"] }),
  });
}

export function useUpdateChatChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Partial<ChatChannel>) => {
      const { error } = await supabase.from("chat_channels").update(values as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_channels"] }),
  });
}

// ==================== CONTACTS ====================
export function useChatContacts() {
  return useQuery({
    queryKey: ["chat_contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_contacts")
        .select("*, chat_contact_tags(tag_id, chat_tags(*))")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateChatContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; phone?: string; email?: string; notes?: string }) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("chat_contacts").insert({ ...values, tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_contacts"] }),
  });
}

export function useUpdateChatContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Partial<ChatContact>) => {
      const { error } = await supabase.from("chat_contacts").update(values as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_contacts"] }),
  });
}

export function useDeleteChatContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_contacts"] }),
  });
}

// ==================== TAGS ====================
export function useChatTags() {
  return useQuery({
    queryKey: ["chat_tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_tags").select("*").order("name");
      if (error) throw error;
      return data as ChatTag[];
    },
  });
}

export function useCreateChatTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; color: string }) => {
      const tenantId = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("chat_tags").insert({
        ...values,
        tenant_id: tenantId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_tags"] }),
  });
}

export function useDeleteChatTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_tags"] }),
  });
}

// ==================== CONTACT TAGS ====================
export function useToggleContactTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, tagId, action }: { contactId: string; tagId: string; action: "add" | "remove" }) => {
      if (action === "add") {
        const tenantId = await getAuthTenantId();
        const { error } = await supabase.from("chat_contact_tags").insert({ contact_id: contactId, tag_id: tagId, tenant_id: tenantId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chat_contact_tags").delete().eq("contact_id", contactId).eq("tag_id", tagId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_contacts"] }),
  });
}

// ==================== CONVERSATIONS ====================
export function useChatConversations(status?: string) {
  return useQuery({
    queryKey: ["chat_conversations", status],
    queryFn: async () => {
      let q = supabase
        .from("chat_conversations")
        .select("*, chat_contacts(*), chat_channels(*)")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (status) q = q.eq("status", status as any);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateChatConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { contact_id: string; channel_id?: string; queue_id?: string }) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("chat_conversations").insert({ ...values, tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_conversations"] }),
  });
}

export function useUpdateChatConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Partial<ChatConversation>) => {
      const { error } = await supabase.from("chat_conversations").update(values as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_conversations"] }),
  });
}

// ==================== MESSAGES ====================
export function useChatMessages(conversationId?: string) {
  return useQuery({
    queryKey: ["chat_messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChatMessage[];
    },
  });
}

export function useSendChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { conversation_id: string; content: string; message_type?: string; media_url?: string; sender_type?: string }) => {
      const tenantId = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: values.conversation_id,
        content: values.content,
        message_type: (values.message_type || "texto") as any,
        media_url: values.media_url,
        sender_type: (values.sender_type || "agente") as any,
        sender_id: user!.id,
        tenant_id: tenantId,
      });
      if (error) throw error;
      // Update last_message_at
      await supabase.from("chat_conversations").update({ last_message_at: new Date().toISOString() } as any).eq("id", values.conversation_id);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["chat_messages", vars.conversation_id] });
      qc.invalidateQueries({ queryKey: ["chat_conversations"] });
    },
  });
}

// ==================== QUEUES ====================
export function useChatQueues() {
  return useQuery({
    queryKey: ["chat_queues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_queues").select("*, chat_queue_members(*)").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateChatQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; description?: string }) => {
      const tenantId = await getAuthTenantId();
      const { error } = await supabase.from("chat_queues").insert({ ...values, tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_queues"] }),
  });
}

export function useDeleteChatQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_queues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_queues"] }),
  });
}

// ==================== CAMPAIGNS ====================
export function useChatCampaigns() {
  return useQuery({
    queryKey: ["chat_campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_campaigns").select("*, chat_channels(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateChatCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; channel_id?: string; message_template?: string; scheduled_at?: string }) => {
      const tenantId = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("chat_campaigns").insert({
        ...values,
        tenant_id: tenantId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_campaigns"] }),
  });
}

// ==================== FILES ====================
export function useChatFiles(fileType?: string) {
  return useQuery({
    queryKey: ["chat_files", fileType],
    queryFn: async () => {
      let q = supabase.from("chat_files").select("*").order("created_at", { ascending: false });
      if (fileType) q = q.eq("file_type", fileType as any);
      const { data, error } = await q;
      if (error) throw error;
      return data as ChatFile[];
    },
  });
}

export function useCreateChatFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { file_name: string; file_type: string; folder?: string; file_url?: string; file_size?: number }) => {
      const tenantId = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("chat_files").insert({
        ...values,
        file_type: values.file_type as any,
        tenant_id: tenantId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_files"] }),
  });
}

export function useDeleteChatFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_files").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_files"] }),
  });
}

// ==================== INTEGRATIONS ====================
export function useChatIntegrations() {
  return useQuery({
    queryKey: ["chat_integrations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_integrations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChatIntegration[];
    },
  });
}

export function useCreateChatIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; type: string; config?: Record<string, any> }) => {
      const tenantId = await getAuthTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("chat_integrations").insert({
        ...values,
        type: values.type as any,
        tenant_id: tenantId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_integrations"] }),
  });
}

export function useUpdateChatIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string; active?: boolean; config?: Record<string, any>; name?: string }) => {
      const { error } = await supabase.from("chat_integrations").update(values as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_integrations"] }),
  });
}

export function useDeleteChatIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_integrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_integrations"] }),
  });
}

// ==================== DASHBOARD STATS ====================
export function useChatDashboardStats() {
  return useQuery({
    queryKey: ["chat_dashboard_stats"],
    queryFn: async () => {
      const [channels, conversations, contacts, campaigns] = await Promise.all([
        supabase.from("chat_channels").select("id, status", { count: "exact" }).neq("status", "deletado"),
        supabase.from("chat_conversations").select("id, status", { count: "exact" }),
        supabase.from("chat_contacts").select("id", { count: "exact" }),
        supabase.from("chat_campaigns").select("id, status", { count: "exact" }),
      ]);

      const channelsData = channels.data || [];
      const convsData = conversations.data || [];

      return {
        totalChannels: channelsData.length,
        connectedChannels: channelsData.filter(c => c.status === "conectado").length,
        openConversations: convsData.filter(c => c.status === "aberta").length,
        waitingConversations: convsData.filter(c => c.status === "aguardando").length,
        totalContacts: contacts.count || 0,
        activeCampaigns: (campaigns.data || []).filter(c => c.status === "enviando").length,
      };
    },
  });
}
