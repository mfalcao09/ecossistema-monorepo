import type { TraceHandle } from '../types.js';

type ToolFn<TArgs, TResult> = (args: TArgs) => Promise<TResult>;

export function instrumentTool<TArgs, TResult>(
  name: string,
  fn: ToolFn<TArgs, TResult>,
  trace: TraceHandle,
): ToolFn<TArgs, TResult> {
  return async (args: TArgs): Promise<TResult> => {
    const span = trace.span({ name, input: args });
    try {
      const result = await fn(args);
      span.end({ output: result, success: true });
      return result;
    } catch (e) {
      span.end({ error: String(e), success: false });
      throw e;
    }
  };
}
