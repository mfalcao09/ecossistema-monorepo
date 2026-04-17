import { describe, it, expect } from 'vitest';
import { environmentLayer } from '../../src/layers/02-environment.js';
import { makeAgentConfig, makeContext } from '../fixtures.js';

describe('L2 — environmentLayer', () => {
  it('includes model, supabase, mcps, tools, env, timestamp', () => {
    const fixedNow = new Date('2026-04-17T12:00:00Z');
    const out = environmentLayer(makeAgentConfig(), makeContext(), {
      now: () => fixedNow,
    });
    expect(out).toContain('claude-sonnet-4-6');
    expect(out).toContain('ifdnjieklngcfodmtied');
    expect(out).toContain('supabase-mcp, memory-mcp, audit-mcp');
    expect(out).toContain('memory.recall');
    expect(out).toContain('test');
    expect(out).toContain('2026-04-17T12:00:00.000Z');
  });

  it('omits timestamp when exclude_dynamic_sections', () => {
    const out = environmentLayer(
      makeAgentConfig(),
      makeContext({ exclude_dynamic_sections: true }),
      { now: () => new Date('2026-04-17T12:00:00Z') },
    );
    expect(out).not.toContain('2026-04-17');
    expect(out).not.toContain('Data/hora');
  });

  it('gracefully handles empty tool/mcp lists', () => {
    const out = environmentLayer(
      makeAgentConfig(),
      makeContext({ available_mcps: [], available_tools: [] }),
    );
    expect(out).toContain('MCPs disponíveis: nenhum');
    expect(out).toContain('Tools habilitadas: nenhuma');
  });
});
