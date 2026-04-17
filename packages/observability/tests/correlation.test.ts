import { describe, it, expect } from 'vitest';
import {
  generateCorrelationId,
  getCorrelationId,
  withCorrelationId,
  getOrGenerateCorrelationId,
  extractFromHeaders,
} from '../src/correlation.js';

describe('correlation ID', () => {
  it('generateCorrelationId returns a UUID v4', () => {
    const id = generateCorrelationId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('generateCorrelationId is unique on each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateCorrelationId()));
    expect(ids.size).toBe(100);
  });

  it('getCorrelationId returns undefined outside context', () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it('withCorrelationId propagates id inside async context', async () => {
    const id = 'test-correlation-id';
    let captured: string | undefined;

    await withCorrelationId(id, async () => {
      captured = getCorrelationId();
    });

    expect(captured).toBe(id);
  });

  it('getCorrelationId returns undefined after context exits', async () => {
    const id = generateCorrelationId();
    await withCorrelationId(id, async () => {
      // inside context
    });
    expect(getCorrelationId()).toBeUndefined();
  });

  it('nested withCorrelationId uses inner id', async () => {
    const outer = 'outer-id';
    const inner = 'inner-id';
    const captured: string[] = [];

    await withCorrelationId(outer, async () => {
      captured.push(getCorrelationId()!);
      await withCorrelationId(inner, async () => {
        captured.push(getCorrelationId()!);
      });
      captured.push(getCorrelationId()!);
    });

    expect(captured).toEqual([outer, inner, outer]);
  });

  it('getOrGenerateCorrelationId returns existing id in context', async () => {
    const id = 'existing-id';
    let result: string | undefined;

    await withCorrelationId(id, async () => {
      result = getOrGenerateCorrelationId();
    });

    expect(result).toBe(id);
  });

  it('getOrGenerateCorrelationId generates new id outside context', () => {
    const result = getOrGenerateCorrelationId();
    expect(result).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('extractFromHeaders reads x-correlation-id header', () => {
    const headers = { 'x-correlation-id': 'req-abc-123' };
    expect(extractFromHeaders(headers)).toBe('req-abc-123');
  });

  it('extractFromHeaders handles array header values', () => {
    const headers = { 'x-correlation-id': ['req-abc-123', 'ignored'] };
    expect(extractFromHeaders(headers)).toBe('req-abc-123');
  });

  it('extractFromHeaders returns undefined for missing header', () => {
    expect(extractFromHeaders({})).toBeUndefined();
  });

  it('withCorrelationId propagates across async boundaries', async () => {
    const id = 'async-boundary-test';
    const results: string[] = [];

    await withCorrelationId(id, async () => {
      await Promise.all([
        (async () => {
          await new Promise((r) => setTimeout(r, 1));
          results.push(getCorrelationId()!);
        })(),
        (async () => {
          await new Promise((r) => setTimeout(r, 2));
          results.push(getCorrelationId()!);
        })(),
      ]);
    });

    expect(results).toEqual([id, id]);
  });
});
