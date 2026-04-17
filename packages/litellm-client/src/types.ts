export type BusinessId = 'ecosystem' | 'fic' | 'klesis' | 'intentus' | 'splendori' | 'nexvy';

export interface LiteLLMConfig {
  proxyUrl: string;
  virtualKey: string;
  timeout?: number;
  maxRetries?: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  fallbacks?: string[];
  metadata?: Record<string, string>;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface CompletionChoice {
  index: number;
  message: { role: string; content: string | null };
  finish_reason: string;
}

export interface CompletionResponse {
  id: string;
  model: string;
  choices: CompletionChoice[];
  usage: Usage;
  system_fingerprint?: string;
}

export interface StreamRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  fallbacks?: string[];
}

export interface StreamChunk {
  delta: string;
  model?: string;
  finish_reason?: string | null;
  raw: unknown;
}

export interface SpendResponse {
  total_usd: number;
  by_model: Record<string, number>;
  by_agent: Record<string, number>;
  period: string;
}

export interface SpendRequest {
  business_id: BusinessId;
  period: '7d' | '30d' | '90d';
}

export interface BudgetWarningEvent {
  business_id: string;
  current_usd: number;
  budget_usd: number;
  ratio: number;
}
