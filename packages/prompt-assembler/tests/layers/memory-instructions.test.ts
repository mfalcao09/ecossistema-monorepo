import { describe, it, expect } from 'vitest';
import { memoryInstructionsLayer } from '../../src/layers/07-memory-instructions.js';

describe('L7 — memoryInstructionsLayer', () => {
  it('mentions both recall and add', () => {
    const out = memoryInstructionsLayer();
    expect(out).toContain('memory.recall');
    expect(out).toContain('memory.add');
  });

  it('warns against leaking credentials via memory.add', () => {
    expect(memoryInstructionsLayer()).toContain('credenciais');
  });

  it('does NOT inject any actual memory content (avoids feedback loop)', () => {
    // Este layer só explica como usar memória; nunca injeta
    // resultados de recall. Asserimos que não contém marcadores de dados.
    const out = memoryInstructionsLayer();
    expect(out).not.toMatch(/importance:\d+/);
    expect(out).not.toMatch(/\[episodic\]|\[semantic\]|\[procedural\]/);
  });
});
