import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mock mínimo de SupabaseClient para testes unitários.
 * Captura calls em `calls[]` e devolve respostas configuráveis.
 */
export interface InsertCall {
  table: string;
  values: Record<string, unknown>;
}

export interface RpcCall {
  name: string;
  params: Record<string, unknown>;
}

export interface UpdateCall {
  table: string;
  values: Record<string, unknown>;
  filters: Record<string, unknown>;
}

export interface MockState {
  inserts: InsertCall[];
  rpcs: RpcCall[];
  updates: UpdateCall[];
  rpcResponses: Map<string, unknown[]>;
  insertResponses: Map<string, Array<{ id: string }>>;
  selectResponses: Map<string, unknown[]>;
}

export function createMockSupabase(): {
  client: SupabaseClient;
  state: MockState;
} {
  const state: MockState = {
    inserts: [],
    rpcs: [],
    updates: [],
    rpcResponses: new Map(),
    insertResponses: new Map(),
    selectResponses: new Map(),
  };

  const client = {
    from(table: string) {
      return createQueryBuilder(table, state);
    },
    async rpc(name: string, params: Record<string, unknown>) {
      state.rpcs.push({ name, params });
      return { data: state.rpcResponses.get(name) ?? [], error: null };
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

interface FilterContext {
  table: string;
  state: MockState;
  filters: Record<string, unknown>;
}

function createQueryBuilder(table: string, state: MockState) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: FilterContext = { table, state, filters: {} };

  const selectBuilder = {
    eq(col: string, val: unknown) {
      ctx.filters[col] = val;
      return this;
    },
    is(col: string, val: unknown) {
      ctx.filters[`${col}_is`] = val;
      return this;
    },
    limit() {
      return this;
    },
    async single() {
      const rows = state.selectResponses.get(table) ?? [];
      return { data: rows[0] ?? null, error: null };
    },
    then(resolve: (v: { data: unknown; error: null }) => unknown) {
      const rows = state.selectResponses.get(table) ?? [];
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };

  return {
    insert(values: Record<string, unknown>) {
      state.inserts.push({ table, values });
      const canned = state.insertResponses.get(table);
      const id = canned?.[0]?.id ?? `mock-${table}-${state.inserts.length}`;
      return {
        select() {
          return {
            async single() {
              return { data: { id }, error: null };
            },
          };
        },
      };
    },
    update(values: Record<string, unknown>) {
      return {
        eq(col: string, val: unknown) {
          state.updates.push({ table, values, filters: { [col]: val } });
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
    select(_cols: string, _opts?: unknown) {
      void _cols;
      void _opts;
      return selectBuilder;
    },
  };
}
