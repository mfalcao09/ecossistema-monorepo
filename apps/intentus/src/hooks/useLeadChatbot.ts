/**
 * useLeadChatbot — Hook para chatbot conversacional de qualificação de leads.
 * Integra com Edge Function `commercial-lead-chatbot` (4 actions).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  title: string | null;
  qualification_result: QualificationResult | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BANTDimension {
  score: number;
  status: string;
  notes: string;
}

export interface QualificationResult {
  qualification_score: number;
  qualification_level: "hot" | "warm" | "cold" | "unqualified";
  bant_analysis: {
    budget: BANTDimension;
    authority: BANTDimension;
    need: BANTDimension;
    timeline: BANTDimension;
  };
  key_insights: string[];
  recommended_actions: { action: string; priority: "alta" | "media" | "baixa"; reason: string }[];
  missing_information: string[];
  suggested_questions: string[];
  conversion_probability: number;
  summary: string;
  model_used?: string;
}

export interface ChatResponse {
  conversation_id: string;
  reply: string;
  message_count: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const QUALIFICATION_LEVEL_LABELS: Record<string, string> = {
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
  unqualified: "Não qualificado",
};

export const QUALIFICATION_LEVEL_COLORS: Record<string, string> = {
  hot: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  warm: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  cold: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  unqualified: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export const BANT_LABELS: Record<string, string> = {
  budget: "Orçamento",
  authority: "Decisor",
  need: "Necessidade",
  timeline: "Urgência",
};

export const PRIORITY_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  baixa: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

// ─── API helper ──────────────────────────────────────────────────────────────

async function invokeChatbot<T>(
  action: string,
  params: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "commercial-lead-chatbot",
    { body: { action, ...params } },
  );
  if (error) throw new Error(error.message || "Erro no chatbot");
  if (!data) throw new Error(`Sem resposta do chatbot para ação ${action}`);
  return data as T;
}

// ─── Query hooks ─────────────────────────────────────────────────────────────

export function useLeadConversations(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ["lead-chatbot-conversations", leadId],
    queryFn: () =>
      invokeChatbot<ChatConversation[]>("get_conversations", { lead_id: leadId }),
    enabled: !!leadId,
    staleTime: 3 * 60 * 1000,
  });
}

export function useConversationMessages(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ["lead-chatbot-messages", conversationId],
    queryFn: () =>
      invokeChatbot<ChatMessage[]>("get_messages", { conversation_id: conversationId }),
    enabled: !!conversationId,
    staleTime: 30 * 1000,
  });
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useSendChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      lead_id: string;
      message: string;
      conversation_id?: string | null;
    }) => invokeChatbot<ChatResponse>("chat", params),
    onSuccess: (data, variables) => {
      // Use response conversation_id (covers new conversation case)
      const targetConvId = variables.conversation_id || data.conversation_id;
      qc.invalidateQueries({
        queryKey: ["lead-chatbot-messages", targetConvId],
      });
      qc.invalidateQueries({
        queryKey: ["lead-chatbot-conversations", variables.lead_id],
      });
      // Invalidate leads to reflect updated last_contact_at
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro no chatbot: ${err.message}`);
    },
  });
}

export function useQualifyLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) =>
      invokeChatbot<QualificationResult>("qualify", { lead_id: leadId }),
    onSuccess: (_data, leadId) => {
      qc.invalidateQueries({
        queryKey: ["lead-chatbot-conversations", leadId],
      });
      toast.success("Qualificação BANT concluída!");
    },
    onError: (err: Error) => {
      toast.error(`Erro na qualificação: ${err.message}`);
    },
  });
}
