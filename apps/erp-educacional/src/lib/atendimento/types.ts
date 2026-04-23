/**
 * Tipos compartilhados do módulo Atendimento — S4 Kanban.
 */

export interface Pipeline {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color_hex: string | null;
  is_pinned: boolean;
  cards_visibility: "all" | "owner" | "team";
  visible_to_restricted: boolean;
  sort_order: number;
  pipeline_stages: PipelineStage[];
}

export interface PipelineStage {
  id: string;
  name: string;
  sort_order: number;
  color_hex: string | null;
  sla_warning_days: number | null;
  sla_danger_days:  number | null;
  is_won: boolean;
  is_lost: boolean;
}

export interface Contact {
  id: string;
  name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  color_hex: string | null;
}

export interface Queue {
  id: string;
  name: string;
  color_hex: string | null;
}

export interface Deal {
  id: string;
  pipeline_id: string;
  stage_id: string;
  contact_id: string | null;
  assignee_id: string | null;
  queue_id: string | null;
  campaign_id: string | null;
  title: string;
  value_cents: number | null;
  currency: string;
  source: string | null;
  custom_fields: Record<string, unknown>;
  entered_stage_at: string;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  atendimento_contacts?: Contact | null;
  atendimento_queues?:   Queue | null;
  // Modo preview (opt-in na query)
  atendimento_conversations?: Array<{
    id: string;
    last_activity_at: string | null;
    atendimento_messages: Array<{
      id: string;
      content: string | null;
      content_type: string | null;
      created_at: string;
    }>;
  }> | null;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  type: "call" | "meeting" | "task" | "email" | "whatsapp" | "note";
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  assignee_id: string | null;
  completed_at: string | null;
  attachment_url: string | null;
  created_at: string;
}

export interface DealNote {
  id: string;
  deal_id: string;
  author_id: string | null;
  body: string;
  attachment_url: string | null;
  created_at: string;
}

export interface DealHistoryEvent {
  id: string;
  deal_id: string;
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ProcessTypeBrief {
  id: string;
  key: string;
  name: string;
}

export interface Protocol {
  id: string;
  conversation_id: string;
  protocol_number: number;
  subject: string;
  description: string | null;
  status: "open" | "resolved" | "canceled";
  assignee_id: string | null;
  resolved_at: string | null;
  created_at: string;
  process_type_id: string | null;
  process_type: ProcessTypeBrief | null;
  aluno_id: string | null;
}
