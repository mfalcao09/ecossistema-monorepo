/**
 * Tipos canônicos dos Constitutional Hooks (V9).
 *
 * Signatures seguem o formato acordado no briefing S01 e no MASTERPLAN-V9 § 12:
 *   PreToolUse:  (ctx) => { decision: "allow" | "block", reason? }
 *   PostToolUse: (ctx & { result }) => void
 *   SessionEnd:  (sessionCtx) => void
 *
 * São propositalmente desacoplados dos tipos internos do
 * `@anthropic-ai/claude-agent-sdk` para serem testáveis sem depender do SDK
 * real (facilita mocks em vitest). Adapters finos podem ser escritos em cada
 * app consumidor.
 */

export type HookDecision =
  | { decision: "allow" }
  | { decision: "block"; reason: string };

export interface HookContext {
  /** Identificador do agente que está executando a chamada (ex.: `cfo-fic`). */
  agent_id: string;
  /** Negócio ao qual o agente está acoplado (klesis | fic | splendori | intentus | nexvy | ecosystem). */
  business_id: string;
  /** Nome da tool que o agente está prestes a chamar. */
  tool_name: string;
  /** Payload de entrada (arbitrário). */
  tool_input: Record<string, unknown>;
  /** Trace id para correlacionar logs Langfuse/audit_log. */
  trace_id?: string;
  /** Timestamp ISO-8601 da chamada. */
  timestamp?: string;
  /** Sinal opcional do ambiente (`prod`, `staging`, `dev`). */
  environment?: "prod" | "staging" | "dev";
  /** Flag opcional indicando que o resultado vem de mock/stub (Art. VIII). */
  is_mock?: boolean;
}

export interface PostHookContext extends HookContext {
  /** Resultado retornado pela tool (raw). */
  result: unknown;
  /** Se a chamada jogou exceção, vem aqui. */
  error?: Error | null;
  /** Código HTTP (quando a tool chamou API externa). */
  http_status?: number;
}

export interface SessionContext {
  agent_id: string;
  business_id: string;
  session_id: string;
  started_at: string;
  ended_at: string;
  tools_used: string[];
  files_touched: string[];
  outcome: "success" | "failure" | "partial";
  /** Texto livre opcional — resumo do usuário/caller. */
  notes?: string;
}

export type PreToolUseHook = (ctx: HookContext) => Promise<HookDecision>;
export type PostToolUseHook = (ctx: PostHookContext) => Promise<void>;
export type SessionEndHook = (ctx: SessionContext) => Promise<void>;

/** Request de aprovação (Art. II HITL). */
export interface ApprovalRequest {
  agent_id: string;
  business_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  reason_for_approval: string;
  status: "pending" | "approved" | "rejected";
  trace_id?: string;
}

/** Entrada do audit_log (Art. IV). Input/output são hashes SHA-256 (LGPD). */
export interface AuditEntry {
  agent_id: string;
  business_id: string;
  tool_name: string;
  tool_input_hash: string;
  result_hash: string;
  success: boolean;
  timestamp: string;
  trace_id?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH";
  notes?: string;
}

/** Interface de client Supabase consumida pelos hooks — permite mock em testes. */
export interface HooksSupabase {
  from: (table: string) => {
    insert: (payload: unknown) => Promise<{ error: unknown }>;
    select: (cols?: string) => {
      eq: (col: string, val: unknown) => {
        gte: (col: string, val: unknown) => {
          limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };
  };
}

/** Interface mínima de client LiteLLM (budget checks — Art. XII). */
export interface LiteLLMBudgetClient {
  getRemainingBudgetUSD: (business_id: string) => Promise<number>;
}

/** Registro opcional de tools com schema JSON (Art. XVIII). */
export interface ToolSchemaRegistry {
  getSchema: (tool_name: string) => object | null;
  getVersion: (tool_name: string) => string | null;
}
