/**
 * Helpers de teste — mock do Supabase via interface HooksSupabase.
 */

import type {
  HookContext,
  HooksSupabase,
  LiteLLMBudgetClient,
  PostHookContext,
  SessionContext,
} from "../src/types.js";

export interface InsertedRow {
  table: string;
  payload: unknown;
}

export interface MockSupabaseState {
  inserts: InsertedRow[];
  /** Linhas "existentes" por tabela, acessadas via select/eq/gte/limit. */
  existing: Record<string, unknown[]>;
  /** Forçar erro na próxima operação, por tabela. */
  errorOnInsert: Record<string, unknown>;
  errorOnSelect: Record<string, unknown>;
}

export function createMockSupabase(initial?: Partial<MockSupabaseState>): {
  client: HooksSupabase;
  state: MockSupabaseState;
} {
  const state: MockSupabaseState = {
    inserts: [],
    existing: {},
    errorOnInsert: {},
    errorOnSelect: {},
    ...initial,
  };

  const client: HooksSupabase = {
    from(table: string) {
      return {
        async insert(payload: unknown) {
          const err = state.errorOnInsert[table];
          if (err) return { error: err };
          state.inserts.push({ table, payload });
          return { error: null };
        },
        select() {
          return {
            eq() {
              return {
                gte() {
                  return {
                    async limit(n: number) {
                      const err = state.errorOnSelect[table];
                      if (err) return { data: null, error: err };
                      const rows = (state.existing[table] ?? []).slice(0, n);
                      return { data: rows, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return { client, state };
}

export function mockLiteLLM(remaining: number): LiteLLMBudgetClient {
  return {
    async getRemainingBudgetUSD() {
      return remaining;
    },
  };
}

export function mockLiteLLMFailing(): LiteLLMBudgetClient {
  return {
    async getRemainingBudgetUSD() {
      throw new Error("boom");
    },
  };
}

export function ctx(partial: Partial<HookContext> = {}): HookContext {
  return {
    agent_id: "test-agent",
    business_id: "test-biz",
    tool_name: "noop",
    tool_input: {},
    trace_id: "trace-1",
    timestamp: "2026-04-17T12:00:00.000Z",
    environment: "dev",
    ...partial,
  };
}

export function postCtx(partial: Partial<PostHookContext> = {}): PostHookContext {
  return {
    ...ctx(partial),
    result: partial.result ?? { ok: true },
    error: partial.error ?? null,
    http_status: partial.http_status,
  };
}

export function sessionCtx(partial: Partial<SessionContext> = {}): SessionContext {
  return {
    agent_id: "test-agent",
    business_id: "test-biz",
    session_id: "sess-1",
    started_at: "2026-04-17T12:00:00.000Z",
    ended_at: "2026-04-17T12:30:00.000Z",
    tools_used: [],
    files_touched: [],
    outcome: "success",
    ...partial,
  };
}
