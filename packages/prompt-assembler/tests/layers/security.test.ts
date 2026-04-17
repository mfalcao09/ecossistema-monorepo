import { describe, it, expect } from 'vitest';
import { securityLayer } from '../../src/layers/03-security.js';

describe('L3 — securityLayer', () => {
  it('enumerates key NUNCA rules tied to articles', () => {
    const out = securityLayer();
    expect(out).toContain('R$ 10.000');
    expect(out).toContain('Art. II');
    expect(out).toContain('Art. XIV');
    expect(out).toContain('Art. IV');
    expect(out).toContain('SC-29 Credential Gateway');
  });

  it('is deterministic (stable across calls → cacheable)', () => {
    expect(securityLayer()).toBe(securityLayer());
  });
});
