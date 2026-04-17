import type { ObservabilityConfig } from '../types.js';
import { ObservabilityClient } from '../langfuse.js';
import { withCorrelationId, generateCorrelationId } from '../correlation.js';

type AgentFn<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

export interface AgentInstrumentOptions {
  agentName: string;
  observability: ObservabilityClient;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export function instrumentAgent<TArgs extends unknown[], TResult>(
  options: AgentInstrumentOptions,
  fn: AgentFn<TArgs, TResult>,
): AgentFn<TArgs, TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const correlationId = generateCorrelationId();

    return withCorrelationId(correlationId, async () => {
      const trace = options.observability.trace({
        name: `agent.${options.agentName}`,
        user_id: options.userId,
        session_id: options.sessionId,
        metadata: { ...options.metadata, correlation_id: correlationId },
        tags: [`agent:${options.agentName}`],
      });

      try {
        const result = await fn(...args);
        trace.score({ name: 'agent_success', value: 1.0 });
        return result;
      } catch (e) {
        trace.score({ name: 'agent_success', value: 0.0 });
        throw e;
      } finally {
        trace.end();
      }
    });
  };
}

export function createObservability(config: ObservabilityConfig): ObservabilityClient {
  return new ObservabilityClient(config);
}
