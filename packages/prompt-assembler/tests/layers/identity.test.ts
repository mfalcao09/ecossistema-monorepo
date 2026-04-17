import { describe, it, expect } from 'vitest';
import { identityLayer } from '../../src/layers/01-identity.js';
import { makeAgentConfig } from '../fixtures.js';

describe('L1 — identityLayer', () => {
  it('includes name, title, description, business, default reports_to', () => {
    const cfg = makeAgentConfig();
    const out = identityLayer(cfg);
    expect(out).toContain('# Você é CFO-IA FIC');
    expect(out).toContain('Chief Financial Officer (IA) da FIC.');
    expect(out).toContain('régua de cobrança');
    expect(out).toContain('Marcelo Silva (CEO) via Claudinho (VP)');
  });

  it('omits business suffix on the title line when business_id absent', () => {
    const cfg = makeAgentConfig({
      business_id: undefined,
      description: 'Gestor financeiro. Executa régua de cobrança.',
    });
    const out = identityLayer(cfg);
    // Second line should be "<title>." without " da <BUSINESS>."
    expect(out.split('\n')[2]).toBe('Chief Financial Officer (IA).');
  });

  it('uses custom reports_to when provided', () => {
    const cfg = makeAgentConfig({ reports_to: 'CEO-IA FIC' });
    expect(identityLayer(cfg)).toContain('Reporta a: CEO-IA FIC');
  });
});
