import { describe, it, expect } from 'vitest';
import { onboardingLayer } from '../../src/layers/05-onboarding.js';
import { makeContext } from '../fixtures.js';

describe('L5 — onboardingLayer', () => {
  it('returns empty when not first run', () => {
    expect(onboardingLayer(makeContext({ is_first_run: false }))).toBe('');
    expect(onboardingLayer(makeContext({ is_first_run: undefined }))).toBe('');
  });

  it('includes onboarding prompt when first run', () => {
    const out = onboardingLayer(makeContext({ is_first_run: true }));
    expect(out).toContain('Primeiro Contato');
    expect(out).toContain('Apresente-se ao Marcelo');
  });
});
