/**
 * Tipos compartilhados do jarvis-app.
 *
 * OrchestratorEvent espelha `orchestrator.agents.runtime.RuntimeEvent`:
 *   init → thinking → tool_use → tool_result → assistant_message → end
 * Mais `error` para falhas de rede/autenticação.
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  /** Mensagem ainda está sendo streamada do backend. */
  streaming?: boolean;
  /** Timestamp ISO. */
  createdAt: string;
}

export type OrchestratorEventType =
  | 'init'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'assistant_message'
  | 'end'
  | 'error';

export interface OrchestratorEvent<T = unknown> {
  type: OrchestratorEventType;
  data: T;
}

export interface InitEventData {
  session_id: string;
  agent_id: string;
}

export interface AssistantMessageData {
  text: string;
  session_id?: string;
}

export interface EndEventData {
  total_tokens?: number;
  session_id?: string;
  stub?: boolean;
}

export interface ErrorEventData {
  message: string;
  code?: string;
}
