/**
 * DS Bot — Types para grafo de fluxo (serializável em JSONB).
 *
 * Referência: docs/sessions/BRIEFING-ATND-S11-DS-BOT.md — 20 tipos de node:
 *   Bubbles(5) · Inputs(8) · Ações Fluxo(4) · Ações Contato(3) ·
 *   Ações Mensagem(3) · Ações Atendimento(4) · Conditional · AgentHandoff.
 *
 * Client-safe: nada de next/headers ou server client aqui.
 */

// ──────────────────────────────────────────────────────────────
// Base
// ──────────────────────────────────────────────────────────────
export type NodeCategory =
  | "trigger"
  | "bubble"
  | "input"
  | "flow"
  | "contact"
  | "message"
  | "attendance"
  | "logic"
  | "agent";

export interface NodePosition {
  x: number;
  y: number;
}

export interface BaseNode<TType extends string, TData = unknown> {
  id: string;
  type: TType;
  category: NodeCategory;
  position: NodePosition;
  data: TData;
}

// ──────────────────────────────────────────────────────────────
// Trigger (start) — pseudo-node, sempre único
// ──────────────────────────────────────────────────────────────
export type TriggerNode = BaseNode<
  "trigger",
  { label?: string }
>;

// ──────────────────────────────────────────────────────────────
// Bubbles (5) — mensagens enviadas ao contato
// ──────────────────────────────────────────────────────────────
export type BubbleTextNode = BaseNode<
  "bubble_text",
  { text: string; interpolate?: boolean } // interpola {{variavel}}
>;

export type BubbleImageNode = BaseNode<
  "bubble_image",
  { url: string; caption?: string }
>;

export type BubbleVideoNode = BaseNode<
  "bubble_video",
  { url: string; caption?: string }
>;

export type BubbleAudioNode = BaseNode<
  "bubble_audio",
  { url: string; voice_library_id?: string } // opcional: referência a ds_voice
>;

export type BubbleEmbedNode = BaseNode<
  "bubble_embed",
  { url: string; height?: number }
>;

// ──────────────────────────────────────────────────────────────
// Inputs (8) — coletam resposta do contato
// ──────────────────────────────────────────────────────────────
export interface InputBaseData {
  question: string;
  variable: string;             // nome da variável onde salvar
  required?: boolean;
  placeholder?: string;
  timeout_seconds?: number;     // default 3600 (1h)
  retry_message?: string;       // mensagem se inválido
}

export type InputTextNode      = BaseNode<"input_text",      InputBaseData & { min_length?: number; max_length?: number }>;
export type InputNumberNode    = BaseNode<"input_number",    InputBaseData & { min?: number; max?: number }>;
export type InputEmailNode     = BaseNode<"input_email",     InputBaseData>;
export type InputWebsiteNode   = BaseNode<"input_website",   InputBaseData>;
export type InputDateNode      = BaseNode<"input_date",      InputBaseData & { min_date?: string; max_date?: string }>;
export type InputPhoneNode     = BaseNode<"input_phone",     InputBaseData & { country?: string }>;
export type InputButtonNode    = BaseNode<"input_button",    InputBaseData & { options: Array<{ id: string; label: string; value: string }> }>;
export type InputFileNode      = BaseNode<"input_file",      InputBaseData & { accept?: string; max_mb?: number; bucket?: string }>;

// ──────────────────────────────────────────────────────────────
// Ações de Fluxo (4)
// ──────────────────────────────────────────────────────────────
export type FlowGoToNode  = BaseNode<"flow_goto",  { target_node_id: string }>;
export type FlowBackNode  = BaseNode<"flow_back",  Record<string, never>>;
export type FlowEndNode   = BaseNode<"flow_end",   { reason?: string }>;
export type FlowWaitNode  = BaseNode<"flow_wait",  { timeout_seconds: number }>;

// ──────────────────────────────────────────────────────────────
// Ações de Contato (3)
// ──────────────────────────────────────────────────────────────
export type ContactAddTagNode     = BaseNode<"contact_add_tag",     { tag: string }>;
export type ContactRemoveTagNode  = BaseNode<"contact_remove_tag",  { tag: string }>;
export type ContactUpdateFieldNode = BaseNode<"contact_update_field", { field: string; value: string; interpolate?: boolean }>;

// ──────────────────────────────────────────────────────────────
// Ações de Mensagem (3)
// ──────────────────────────────────────────────────────────────
export type MessageWabaTemplateNode = BaseNode<
  "message_waba_template",
  { template_id: string; variables?: Record<string, string> }
>;

export type MessageDsVoiceNode = BaseNode<
  "message_ds_voice",
  { library_item_id: string }
>;

export type MessageForwardNode = BaseNode<
  "message_forward",
  { message_id: string }
>;

// ──────────────────────────────────────────────────────────────
// Ações de Atendimento (4)
// ──────────────────────────────────────────────────────────────
export type AttendanceTransferQueueNode = BaseNode<
  "attendance_transfer_queue",
  { queue_id: string; note?: string }
>;

export type AttendanceAssignAgentNode = BaseNode<
  "attendance_assign_agent",
  { agent_id: string; note?: string }
>;

export type AttendanceOpenProtocolNode = BaseNode<
  "attendance_open_protocol",
  { subject: string; priority?: "low" | "normal" | "high" }
>;

export type AttendanceCloseNode = BaseNode<
  "attendance_close",
  { reason?: string }
>;

// ──────────────────────────────────────────────────────────────
// Lógica: Conditional (if/else)
// ──────────────────────────────────────────────────────────────
export type ConditionalOperator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "contains" | "not_contains" | "starts_with" | "ends_with"
  | "is_empty" | "is_not_empty";

export interface ConditionalClause {
  left: string;                 // "var.nome" | "var.idade" | "context.channel"
  op: ConditionalOperator;
  right?: string | number;      // ausente em is_empty/is_not_empty
}

export type ConditionalNode = BaseNode<
  "conditional",
  {
    logic: "AND" | "OR";
    clauses: ConditionalClause[];
    // saídas nomeadas: "true" / "false" (edges usam sourceHandle)
  }
>;

// ──────────────────────────────────────────────────────────────
// Agent hand-off (S10 integration)
// ──────────────────────────────────────────────────────────────
export type AgentHandoffNode = BaseNode<
  "agent_handoff",
  { agent_id: string; context_vars?: string[] } // variáveis a injetar no prompt do agente
>;

// ──────────────────────────────────────────────────────────────
// Discriminated union
// ──────────────────────────────────────────────────────────────
export type DsBotNode =
  | TriggerNode
  | BubbleTextNode | BubbleImageNode | BubbleVideoNode | BubbleAudioNode | BubbleEmbedNode
  | InputTextNode | InputNumberNode | InputEmailNode | InputWebsiteNode
  | InputDateNode | InputPhoneNode | InputButtonNode | InputFileNode
  | FlowGoToNode | FlowBackNode | FlowEndNode | FlowWaitNode
  | ContactAddTagNode | ContactRemoveTagNode | ContactUpdateFieldNode
  | MessageWabaTemplateNode | MessageDsVoiceNode | MessageForwardNode
  | AttendanceTransferQueueNode | AttendanceAssignAgentNode
  | AttendanceOpenProtocolNode | AttendanceCloseNode
  | ConditionalNode
  | AgentHandoffNode;

export type DsBotNodeType = DsBotNode["type"];

// ──────────────────────────────────────────────────────────────
// Edge (React Flow compatible)
// ──────────────────────────────────────────────────────────────
export interface DsBotEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null; // "true"|"false" em conditional; option-id em input_button
  targetHandle?: string | null;
  label?: string;
}

// ──────────────────────────────────────────────────────────────
// Flow (root object serializado em flow_json)
// ──────────────────────────────────────────────────────────────
export interface DsBotFlow {
  nodes: DsBotNode[];
  edges: DsBotEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

// ──────────────────────────────────────────────────────────────
// Execution context (runtime)
// ──────────────────────────────────────────────────────────────
export interface DsBotExecutionContext {
  bot_id: string;
  execution_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  channel: string;
  variables: Record<string, unknown>;
  history: DsBotHistoryEntry[];
}

export interface DsBotHistoryEntry {
  node_id: string;
  at: string;
  event: "entered" | "awaiting" | "input_received" | "resumed" | "errored" | "completed";
  payload?: unknown;
}

// ──────────────────────────────────────────────────────────────
// Result de executeNode
// ──────────────────────────────────────────────────────────────
export type NodeExecutionResult =
  | { kind: "next"; next_node_id: string | null; side_effects?: SideEffect[] }
  | { kind: "await"; side_effects?: SideEffect[] }
  | { kind: "end"; reason?: string; side_effects?: SideEffect[] }
  | { kind: "handoff"; agent_id: string; side_effects?: SideEffect[] }
  | { kind: "error"; error: string };

export type SideEffect =
  | { type: "send_text"; text: string }
  | { type: "send_media"; media_type: "image" | "video" | "audio"; url: string; caption?: string }
  | { type: "send_embed"; url: string }
  | { type: "send_waba_template"; template_id: string; variables?: Record<string, string> }
  | { type: "send_ds_voice"; library_item_id: string }
  | { type: "forward_message"; message_id: string }
  | { type: "add_tag"; tag: string }
  | { type: "remove_tag"; tag: string }
  | { type: "update_contact_field"; field: string; value: string }
  | { type: "transfer_queue"; queue_id: string; note?: string }
  | { type: "assign_agent"; agent_id: string; note?: string }
  | { type: "open_protocol"; subject: string; priority: "low" | "normal" | "high" }
  | { type: "close_conversation"; reason?: string };

// ──────────────────────────────────────────────────────────────
// Trigger matching (incoming message)
// ──────────────────────────────────────────────────────────────
export interface TriggerMatchInput {
  conversation_id: string;
  contact_id: string | null;
  channel: string;
  is_new_conversation: boolean;
  message_text?: string;
  added_tag?: string;
}

// ──────────────────────────────────────────────────────────────
// Categoria → lista de tipos (UI palette)
// ──────────────────────────────────────────────────────────────
export const NODE_CATEGORIES: Record<NodeCategory, { label: string; types: DsBotNodeType[] }> = {
  trigger:    { label: "Gatilho",        types: ["trigger"] },
  bubble:     { label: "Bolhas",         types: ["bubble_text","bubble_image","bubble_video","bubble_audio","bubble_embed"] },
  input:      { label: "Perguntas",      types: ["input_text","input_number","input_email","input_website","input_date","input_phone","input_button","input_file"] },
  flow:       { label: "Fluxo",          types: ["flow_goto","flow_back","flow_end","flow_wait"] },
  contact:    { label: "Contato",        types: ["contact_add_tag","contact_remove_tag","contact_update_field"] },
  message:    { label: "Mensagem",       types: ["message_waba_template","message_ds_voice","message_forward"] },
  attendance: { label: "Atendimento",    types: ["attendance_transfer_queue","attendance_assign_agent","attendance_open_protocol","attendance_close"] },
  logic:      { label: "Lógica",         types: ["conditional"] },
  agent:      { label: "IA",             types: ["agent_handoff"] },
};

export const NODE_LABELS: Record<DsBotNodeType, string> = {
  trigger:                   "Início",
  bubble_text:               "Texto",
  bubble_image:              "Imagem",
  bubble_video:              "Vídeo",
  bubble_audio:              "Áudio",
  bubble_embed:              "Embed",
  input_text:                "Pergunta — Texto",
  input_number:              "Pergunta — Número",
  input_email:               "Pergunta — E-mail",
  input_website:             "Pergunta — Website",
  input_date:                "Pergunta — Data",
  input_phone:               "Pergunta — Telefone",
  input_button:              "Pergunta — Botão",
  input_file:                "Pergunta — Arquivo",
  flow_goto:                 "Ir para node",
  flow_back:                 "Voltar",
  flow_end:                  "Encerrar",
  flow_wait:                 "Aguardar",
  contact_add_tag:           "Adicionar tag",
  contact_remove_tag:        "Remover tag",
  contact_update_field:      "Atualizar campo",
  message_waba_template:     "Template WABA",
  message_ds_voice:          "DS Voice",
  message_forward:           "Encaminhar",
  attendance_transfer_queue: "Transferir fila",
  attendance_assign_agent:   "Atribuir agente",
  attendance_open_protocol:  "Abrir protocolo",
  attendance_close:          "Fechar conversa",
  conditional:               "Condicional",
  agent_handoff:             "Chamar DS Agente",
};

export function nodeCategory(type: DsBotNodeType): NodeCategory {
  for (const [cat, meta] of Object.entries(NODE_CATEGORIES) as [NodeCategory, { types: DsBotNodeType[] }][]) {
    if (meta.types.includes(type)) return cat;
  }
  return "bubble";
}
