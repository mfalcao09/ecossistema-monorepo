/**
 * OTel bridge — wraps functions with OpenTelemetry spans.
 * Requires @opentelemetry/api to be installed (optional peer dep).
 */

type AnyAsyncFn<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

let otelApi: typeof import('@opentelemetry/api') | null = null;

async function loadOtelApi(): Promise<typeof import('@opentelemetry/api') | null> {
  if (otelApi !== null) return otelApi;
  try {
    otelApi = await import('@opentelemetry/api');
    return otelApi;
  } catch {
    return null;
  }
}

export function instrumentFn<TArgs extends unknown[], TResult>(
  name: string,
  fn: AnyAsyncFn<TArgs, TResult>,
): AnyAsyncFn<TArgs, TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const api = await loadOtelApi();

    if (!api) {
      // OTel not installed — run function directly without instrumentation
      return fn(...args);
    }

    const tracer = api.trace.getTracer('@ecossistema/observability');

    return new Promise<TResult>((resolve, reject) => {
      tracer.startActiveSpan(name, async (span) => {
        try {
          const result = await fn(...args);
          span.setStatus({ code: api.SpanStatusCode.OK });
          resolve(result);
        } catch (e) {
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: String(e),
          });
          span.recordException(e as Error);
          reject(e);
        } finally {
          span.end();
        }
      });
    });
  };
}

export function instrumentAgent<TArgs extends unknown[], TResult>(
  agentName: string,
  fn: AnyAsyncFn<TArgs, TResult>,
  attributes?: Record<string, string>,
): AnyAsyncFn<TArgs, TResult> {
  return instrumentFn(`agent.${agentName}`, async (...args: TArgs): Promise<TResult> => {
    const api = await loadOtelApi();
    if (api && attributes) {
      const span = api.trace.getActiveSpan();
      if (span) {
        Object.entries(attributes).forEach(([k, v]) => span.setAttribute(k, v));
      }
    }
    return fn(...args);
  });
}
