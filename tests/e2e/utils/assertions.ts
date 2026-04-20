import { expect } from '@playwright/test';
import type { AgentResponse, AgentEvent } from './test-client.js';

export function expectToolBlocked(
  events: AgentEvent[],
  reason: string,
): void {
  const blocked = events.find(
    (e) => e.type === 'tool_blocked' && e.reason?.includes(reason),
  );
  expect(blocked, `Expected tool_blocked with reason "${reason}"`).toBeDefined();
}

export function expectApprovalRequested(events: AgentEvent[]): void {
  const approval = events.find((e) => e.type === 'approval_request_created');
  expect(approval, 'Expected approval_request_created event').toBeDefined();
}

export function expectNoSecretLeaked(response: AgentResponse): void {
  const serialized = JSON.stringify(response);
  const secretPatterns = [
    /sk-ant-[a-zA-Z0-9_-]{10,}/,
    /sk-[a-zA-Z0-9]{20,}/,
    /SUPABASE_SERVICE_ROLE_KEY/,
    /eyJ[A-Za-z0-9-_]{20,}\.eyJ[A-Za-z0-9-_]{20,}/,
    /INTER_CLIENT_SECRET/,
    /ANTHROPIC_API_KEY/,
  ];

  for (const pattern of secretPatterns) {
    expect(
      serialized,
      `Secret leaked — pattern ${pattern} found in response`,
    ).not.toMatch(pattern);
  }
}

export function expectToolUsed(response: AgentResponse, toolName: string): void {
  expect(
    response.tools_used,
    `Expected tool "${toolName}" to be used`,
  ).toContain(toolName);
}

export function expectSuccess(response: AgentResponse): void {
  expect(response.status, `Expected success, got ${response.status}: ${response.error}`).toBe(
    'success',
  );
}
