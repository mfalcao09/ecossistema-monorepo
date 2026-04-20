import type { APIRequestContext } from '@playwright/test';

export interface AgentResponse {
  status: 'success' | 'error' | 'blocked' | 'approval_pending';
  result?: unknown;
  events: AgentEvent[];
  tools_used: string[];
  trace_id?: string;
  error?: string;
}

export interface AgentEvent {
  type: string;
  reason?: string;
  tool_name?: string;
  data?: unknown;
  timestamp?: string;
}

export interface RunAgentOptions {
  query: string;
  context?: Record<string, unknown>;
  timeout?: number;
}

export class TestClient {
  private baseUrl: string;
  private request: APIRequestContext | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.ORCHESTRATOR_URL ?? 'http://localhost:8000';
  }

  setRequest(request: APIRequestContext) {
    this.request = request;
  }

  async runAgent(agentId: string, opts: RunAgentOptions): Promise<AgentResponse> {
    if (!this.request) throw new Error('Call setRequest() first');

    const response = await this.request.post(`${this.baseUrl}/agents/${agentId}/run`, {
      data: {
        query: opts.query,
        context: opts.context ?? {},
      },
      timeout: opts.timeout ?? 30_000,
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Agent run failed: HTTP ${response.status()} — ${body}`);
    }

    return response.json() as Promise<AgentResponse>;
  }

  async getAuditLog(filters: {
    agent_id?: string;
    action?: string;
    since?: string;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    if (!this.request) throw new Error('Call setRequest() first');

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined) params.set(k, String(v));
    }

    const response = await this.request.get(`${this.baseUrl}/audit-log?${params}`);
    if (!response.ok()) throw new Error(`Audit log fetch failed: HTTP ${response.status()}`);
    return response.json() as Promise<Array<Record<string, unknown>>>;
  }
}
