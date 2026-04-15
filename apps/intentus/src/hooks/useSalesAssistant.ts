import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { emitPulseEvent } from "./usePulseFeed";
import { toast } from "sonner";

export interface SalesScript {
  opening: string;
  discovery_questions: string[];
  value_proposition: string;
  objection_handlers: Array<{
    objection: string;
    response: string;
  }>;
  closing_technique: string;
  key_facts: string[];
}

export interface VisitPrep {
  checklist: string[];
  talking_points: string[];
  comparables_pitch: string;
  client_specific_notes: string;
  follow_up_plan: string;
}

export interface CommercialProposal {
  proposal_title: string;
  executive_summary: string;
  property_description: string;
  pricing_justification: string;
  payment_conditions: string;
  differentials: string;
  next_steps: string;
  validity_period: string;
}

export interface ObjectionResponse {
  objection_category: string;
  empathy_response: string;
  counter_arguments: string[];
  reframe_technique: string;
  success_probability: number;
}

export interface BrokerInsights {
  total_active_deals: number;
  deals_needing_attention: number;
  estimated_closing_probability: number;
  revenue_forecast: number;
  recommended_priorities: string[];
  summary: string;
  model_used: string;
}

export type ObjectionCategory =
  | "preco"
  | "localizacao"
  | "tempo"
  | "competicao"
  | "confianca"
  | "outro";

export const OBJECTION_CATEGORY_LABELS: Record<ObjectionCategory, string> = {
  preco: "Preço",
  localizacao: "Localização",
  tempo: "Tempo",
  competicao: "Competição",
  confianca: "Confiança",
  outro: "Outra",
};

export const OBJECTION_CATEGORY_ICONS: Record<ObjectionCategory, string> = {
  preco: "DollarSign",
  localizacao: "MapPin",
  tempo: "Clock",
  competicao: "Users",
  confianca: "Shield",
  outro: "HelpCircle",
};

async function invokeSalesAssistant<T>(
  action: string,
  params: Record<string, unknown>
): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "commercial-broker-assistant",
      {
        body: { action, ...params },
      }
    );

    if (error) {
      console.error("Sales assistant error:", error);
      toast.error("Erro no assistente de vendas");
      return null;
    }

    return data as T;
  } catch (err) {
    console.error("Sales assistant invocation error:", err);
    toast.error("Erro ao conectar com assistente de vendas");
    return null;
  }
}

export function useGenerateScript() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      lead_id?: string;
    }): Promise<SalesScript | null> => {
      const result = await invokeSalesAssistant<SalesScript>(
        "generate_script",
        params
      );

      if (result && user?.id) {
        emitPulseEvent({
          event_type: "automation_executed",
          actor_id: user.id,
          entity_type: "deal",
          entity_id: params.deal_id,
          entity_name: "Script de Vendas",
          metadata: {
            action: "script_generated",
          },
        });
      }

      return result;
    },
  });
}

export function usePrepareVisit() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      property_id?: string;
      lead_id?: string;
      visit_date?: string;
    }): Promise<VisitPrep | null> => {
      const result = await invokeSalesAssistant<VisitPrep>(
        "prepare_visit",
        params
      );

      if (result && user?.id) {
        emitPulseEvent({
          event_type: "automation_executed",
          actor_id: user.id,
          entity_type: "deal",
          entity_id: params.deal_id,
          entity_name: "Preparação de Visita",
          metadata: {
            action: "visit_prepared",
            visit_date: params.visit_date,
          },
        });
      }

      return result;
    },
  });
}

export function useGenerateProposal() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      deal_id: string;
      include_pricing: boolean;
    }): Promise<CommercialProposal | null> => {
      const result = await invokeSalesAssistant<CommercialProposal>(
        "generate_proposal",
        params
      );

      if (result && user?.id) {
        emitPulseEvent({
          event_type: "automation_executed",
          actor_id: user.id,
          entity_type: "deal",
          entity_id: params.deal_id,
          entity_name: "Proposta Comercial",
          metadata: {
            action: "proposal_generated",
          },
        });
      }

      return result;
    },
  });
}

export function useHandleObjection() {
  return useMutation({
    mutationFn: async (params: {
      objection_text: string;
      deal_id?: string;
      context?: string;
    }): Promise<ObjectionResponse | null> => {
      return invokeSalesAssistant<ObjectionResponse>(
        "handle_objection",
        params
      );
    },
  });
}

export function useBrokerInsights() {
  return useQuery({
    queryKey: ["broker-insights"],
    queryFn: async (): Promise<BrokerInsights | null> => {
      return invokeSalesAssistant<BrokerInsights>("get_insights", {});
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });
}
