import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { supabase } from "@/integrations/supabase/client";
import { emitPulseEvent } from "./usePulseFeed";
import { toast } from "sonner";

export type FollowUpChannel = "whatsapp" | "email" | "phone" | "visit";
export type FollowUpUrgency = "critical" | "high" | "normal" | "low";

export interface FollowUpRecommendation {
  optimal_timing: string;
  recommended_channel: FollowUpChannel;
  message_template: string;
  talking_points: string[];
  risk_assessment: string;
  confidence_score: number;
}

export interface DealFollowUpUrgency {
  id: string;
  deal_name: string;
  urgency_score: number;
  recommended_channel: FollowUpChannel;
  days_in_stage: number;
  interaction_count: number;
  proposed_value: number;
  status: string;
}

export interface FollowUpDashboard {
  deals_no_contact_3d: number;
  deals_no_contact_7d: number;
  deals_no_contact_14d_plus: number;
  followups_executed_today: number;
  success_rate: number;
  overdue_followups: number;
}

export interface FollowUpPlan {
  delay_days: number;
  channel: FollowUpChannel;
  message: string;
  priority: "critical" | "high" | "normal" | "low";
}

export interface BatchAnalysisResult {
  total_analyzed: number;
  top_deals: DealFollowUpUrgency[];
  summary: {
    critical: number;
    high: number;
    normal: number;
  };
}

// Constants
export const CHANNEL_LABELS: Record<FollowUpChannel, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  phone: "Telefone",
  visit: "Visita",
};

export const CHANNEL_ICONS: Record<FollowUpChannel, string> = {
  whatsapp: "MessageCircle",
  email: "Mail",
  phone: "Phone",
  visit: "MapPin",
};

export const URGENCY_LABELS: Record<FollowUpUrgency, string> = {
  critical: "Crítica",
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};

export const URGENCY_COLORS: Record<FollowUpUrgency, string> = {
  critical: "bg-red-100 text-red-900 border-red-300",
  high: "bg-orange-100 text-orange-900 border-orange-300",
  normal: "bg-blue-100 text-blue-900 border-blue-300",
  low: "bg-gray-100 text-gray-900 border-gray-300",
};

async function invokeFollowUpAI<T>(action: string, params: Record<string, any>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "commercial-follow-up-ai",
    {
      body: { action, ...params },
    }
  );

  if (error) {
    throw new Error(error.message || "Follow-up AI error");
  }

  return data as T;
}

export function useFollowUpDashboard() {
  return useQuery({
    queryKey: ["follow-up-dashboard"],
    queryFn: async () => {
      return invokeFollowUpAI<FollowUpDashboard>("get_dashboard", {});
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

export function useBatchFollowUpAnalysis(options?: { limit?: number }) {
  return useQuery({
    queryKey: ["batch-follow-up-analysis", options?.limit],
    queryFn: async () => {
      return invokeFollowUpAI<BatchAnalysisResult>("batch_analyze", {
        limit: options?.limit || 20,
      });
    },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useAnalyzeDealFollowUp() {
  const qc = useQueryClient();
  const user = useAuth();

  return useMutation({
    mutationFn: async (dealId: string) => {
      return invokeFollowUpAI<{
        deal_id: string;
        recommendation: FollowUpRecommendation;
      }>("analyze_deal", { deal_id: dealId });
    },
    onSuccess: (data) => {
      emitPulseEvent({
        event_type: "automation_executed",
        actor_id: user.user?.id,
        entity_type: "deal",
        entity_id: data.deal_id,
        entity_name: data.deal_id,
        metadata: { action: "follow_up_analyzed" },
      });
      toast.success("Análise de follow-up concluída");
    },
    onError: (error) => {
      toast.error("Erro ao analisar follow-up: " + (error as Error).message);
    },
  });
}

export function useScheduleFollowUps() {
  const qc = useQueryClient();
  const user = useAuth();

  return useMutation({
    mutationFn: async (params: { dealId: string; followUps: FollowUpPlan[] }) => {
      return invokeFollowUpAI<{
        scheduled: number;
        logs: any[];
      }>("schedule_followups", {
        deal_id: params.dealId,
        follow_ups: params.followUps,
      });
    },
    onSuccess: (data, variables) => {
      emitPulseEvent({
        event_type: "automation_executed",
        actor_id: user.user?.id,
        entity_type: "deal",
        entity_id: variables.dealId,
        entity_name: variables.dealId,
        metadata: {
          action: "follow_ups_scheduled",
          count: data.scheduled,
        },
      });
      qc.invalidateQueries({ queryKey: ["follow-up-dashboard"] });
      toast.success(`${data.scheduled} follow-ups agendados`);
    },
    onError: (error) => {
      toast.error("Erro ao agendar follow-ups: " + (error as Error).message);
    },
  });
}

export function getUrgencyLevel(score: number): FollowUpUrgency {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "normal";
  return "low";
}
