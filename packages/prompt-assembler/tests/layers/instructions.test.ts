import { describe, it, expect } from 'vitest';
import { instructionsLayer } from '../../src/layers/08-instructions.js';
import { makeAgentConfig } from '../fixtures.js';

describe('L8 — instructionsLayer', () => {
  it('includes handoff targets', () => {
    const out = instructionsLayer(makeAgentConfig());
    expect(out).toContain('Claudinho');
    expect(out).toContain('D-Estrategia');
    expect(out).toContain('D-Governanca');
  });

  it('references Art. IX explicit-failure rule', () => {
    expect(instructionsLayer(makeAgentConfig())).toContain('Art. IX');
  });
});
