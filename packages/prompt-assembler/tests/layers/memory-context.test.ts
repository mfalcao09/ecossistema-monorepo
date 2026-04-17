import { describe, it, expect, vi } from 'vitest';
import { memoryContextLayer } from '../../src/layers/09-memory-context.js';
import { makeAgentConfig, makeContext } from '../fixtures.js';
import { Memory, RecallArgs } from '../../src/types.js';

function memory(i: number, overrides: Partial<Memory> = {}): Memory {
  return {
    type: 'episodic',
    importance: 5,
    summary: `Memória ${i}`,
    ...overrides,
  };
}

describe('L9 — memoryContextLayer', () => {
  it('returns empty when no recall dep', async () => {
    const out = await memoryContextLayer(makeAgentConfig(), makeContext(), {});
    expect(out).toBe('');
  });

  it('returns empty when recall returns []', async () => {
    const recall = vi.fn().mockResolvedValue([]);
    const out = await memoryContextLayer(makeAgentConfig(), makeContext(), {
      recall,
    });
    expect(out).toBe('');
    expect(recall).toHaveBeenCalledOnce();
  });

  it('passes exact user query to recall (no reformulation)', async () => {
    const recall = vi.fn().mockResolvedValue([]);
    const ctx = makeContext({ query: 'Inadimplência Abril 2026?' });
    await memoryContextLayer(makeAgentConfig(), ctx, { recall });
    const call = recall.mock.calls[0][0] as RecallArgs;
    expect(call.query).toBe('Inadimplência Abril 2026?');
  });

  it('uses strict filters (user_id + agent_id + business_id + run_id)', async () => {
    const recall = vi.fn().mockResolvedValue([]);
    await memoryContextLayer(makeAgentConfig(), makeContext(), { recall });
    const call = recall.mock.calls[0][0] as RecallArgs;
    expect(call.filters.user_id).toBe('marcelo');
    expect(call.filters.agent_id).toBe('cfo-fic');
    expect(call.filters.business_id).toBe('fic');
    expect(call.filters.run_id).toBe('sess-abc-123');
  });

  it('formats top-N results with type|importance|summary', async () => {
    const recall = vi
      .fn()
      .mockResolvedValue([memory(1, { importance: 9 }), memory(2)]);
    const out = await memoryContextLayer(makeAgentConfig(), makeContext(), {
      recall,
    });
    expect(out).toContain('Memórias Relevantes (top 2)');
    expect(out).toContain('1. [episodic|importance:9] Memória 1');
    expect(out).toContain('2. [episodic|importance:5] Memória 2');
  });

  it('returns empty when exclude_dynamic_sections (cache mode)', async () => {
    const recall = vi.fn().mockResolvedValue([memory(1)]);
    const out = await memoryContextLayer(
      makeAgentConfig(),
      makeContext({ exclude_dynamic_sections: true }),
      { recall },
    );
    expect(out).toBe('');
    expect(recall).not.toHaveBeenCalled();
  });

  it('returns empty when recall throws (degraded mode, § 32)', async () => {
    const recall = vi.fn().mockRejectedValue(new Error('pgvector down'));
    const out = await memoryContextLayer(makeAgentConfig(), makeContext(), {
      recall,
    });
    expect(out).toBe('');
  });

  it('returns empty when no query (background task)', async () => {
    const recall = vi.fn();
    const out = await memoryContextLayer(
      makeAgentConfig(),
      makeContext({ query: undefined }),
      { recall },
    );
    expect(out).toBe('');
    expect(recall).not.toHaveBeenCalled();
  });
});
