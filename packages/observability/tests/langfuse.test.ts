import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObservabilityClient } from '../src/langfuse.js';
import type { ObservabilityConfig } from '../src/types.js';

// Mock langfuse SDK
const mockScore = vi.fn();
const mockSpanEnd = vi.fn();
const mockGenerationEnd = vi.fn();
const mockTraceUpdate = vi.fn();

const mockSpan = vi.fn().mockReturnValue({
  id: 'span-001',
  end: mockSpanEnd,
});
const mockGeneration = vi.fn().mockReturnValue({
  id: 'gen-001',
  end: mockGenerationEnd,
});
const mockTrace = vi.fn().mockReturnValue({
  id: 'trace-001',
  span: mockSpan,
  generation: mockGeneration,
  score: mockScore,
  update: mockTraceUpdate,
});

const mockFlushAsync = vi.fn().mockResolvedValue(undefined);
const mockShutdownAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('langfuse', () => ({
  Langfuse: vi.fn().mockImplementation(() => ({
    trace: mockTrace,
    flushAsync: mockFlushAsync,
    shutdownAsync: mockShutdownAsync,
  })),
}));

const CONFIG: ObservabilityConfig = {
  langfuse: {
    baseUrl: 'https://langfuse.test',
    publicKey: 'pk-test',
    secretKey: 'sk-test',
  },
  businessId: 'fic',
  service: 'cfo-fic',
  flushOnShutdown: false,
};

describe('ObservabilityClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trace() creates a Langfuse trace with business_id and service tags', () => {
    const obs = new ObservabilityClient(CONFIG);
    obs.trace({ name: 'test-trace', user_id: 'marcelo' });

    expect(mockTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-trace',
        userId: 'marcelo',
        metadata: expect.objectContaining({
          business_id: 'fic',
          service: 'cfo-fic',
        }),
        tags: expect.arrayContaining(['business:fic', 'service:cfo-fic']),
      }),
    );
  });

  it('trace.span() creates a span with correlation_id in metadata', () => {
    const obs = new ObservabilityClient(CONFIG);
    const trace = obs.trace({ name: 'test' });
    trace.span({ name: 'check_inadimplentes', input: { date: '2026-04' } });

    expect(mockSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'check_inadimplentes',
        input: { date: '2026-04' },
        metadata: expect.objectContaining({ correlation_id: expect.any(String) }),
      }),
    );
  });

  it('span.end() with success=false sets ERROR level', () => {
    const obs = new ObservabilityClient(CONFIG);
    const trace = obs.trace({ name: 'test' });
    const span = trace.span({ name: 'failing-tool' });
    span.end({ error: 'Connection refused', success: false });

    expect(mockSpanEnd).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ERROR', statusMessage: 'Connection refused' }),
    );
  });

  it('span.end() with success=true sets DEFAULT level', () => {
    const obs = new ObservabilityClient(CONFIG);
    const trace = obs.trace({ name: 'test' });
    const span = trace.span({ name: 'ok-tool' });
    span.end({ output: { result: 'ok' }, success: true });

    expect(mockSpanEnd).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'DEFAULT', output: { result: 'ok' } }),
    );
  });

  it('trace.generation() creates a generation with model info', () => {
    const obs = new ObservabilityClient(CONFIG);
    const trace = obs.trace({ name: 'test' });
    trace.generation({
      name: 'agent-reasoning',
      model: 'sonnet-4-6',
      input: [{ role: 'user', content: 'hello' }],
    });

    expect(mockGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'agent-reasoning',
        model: 'sonnet-4-6',
      }),
    );
  });

  it('generation.end() maps usage tokens correctly', () => {
    const obs = new ObservabilityClient(CONFIG);
    const trace = obs.trace({ name: 'test' });
    const gen = trace.generation({ name: 'gen', model: 'sonnet-4-6', input: [] });
    gen.end({
      output: 'response text',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    expect(mockGenerationEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        output: 'response text',
        usage: { input: 100, output: 50, total: 150 },
      }),
    );
  });

  it('trace.score() passes name and value', () => {
    const obs = new ObservabilityClient(CONFIG);
    const trace = obs.trace({ name: 'test' });
    trace.score({ name: 'task_success', value: 1.0 });

    expect(mockScore).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'task_success', value: 1.0 }),
    );
  });

  it('trace.end() calls update with ended_at', () => {
    const obs = new ObservabilityClient(CONFIG);
    const trace = obs.trace({ name: 'test' });
    trace.end();

    expect(mockTraceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ ended_at: expect.any(String) }) }),
    );
  });

  it('flush() calls langfuse.flushAsync()', async () => {
    const obs = new ObservabilityClient(CONFIG);
    await obs.flush();
    expect(mockFlushAsync).toHaveBeenCalledOnce();
  });

  it('each trace gets its own correlation_id', () => {
    const obs = new ObservabilityClient(CONFIG);
    const t1 = obs.trace({ name: 't1' });
    const t2 = obs.trace({ name: 't2' });

    expect(t1.getCorrelationId()).not.toBe(t2.getCorrelationId());
  });
});
