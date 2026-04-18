/**
 * Spec 00 — Infrastructure Health Check
 * Verifica que todos os serviços da Fase 0 estão respondendo.
 * REQUIRES: SUPABASE_URL, LITELLM_URL, LANGFUSE_URL, ORCHESTRATOR_URL, CONSOLIDATOR_URL
 */

import { describe, test, expect, beforeAll } from 'vitest';
import {
  SUPABASE_URL, LITELLM_URL, LANGFUSE_URL,
  ORCHESTRATOR_URL, CONSOLIDATOR_URL, LIVE_INFRA_AVAILABLE,
} from './helpers/setup.js';

describe('00 — Infrastructure Health', () => {
  beforeAll(() => {
    if (!LIVE_INFRA_AVAILABLE) {
      console.warn('⚠️  Live infra not configured. Set SUPABASE_URL + ORCHESTRATOR_URL.');
    }
  });

  test('todas as infraestruturas respondendo', async () => {
    if (!LIVE_INFRA_AVAILABLE) {
      console.warn('SKIP: env vars não configurados');
      return;
    }

    const checks = await Promise.allSettled([
      fetch(SUPABASE_URL + '/rest/v1/').then(r => ({ supabase: r.ok, status: r.status })),
      fetch(LITELLM_URL + '/health').then(r => ({ litellm: r.ok, status: r.status })),
      fetch(LANGFUSE_URL + '/api/public/health').then(r => ({ langfuse: r.ok, status: r.status })),
      fetch(ORCHESTRATOR_URL + '/health').then(r => ({ orchestrator: r.ok, status: r.status })),
      fetch(CONSOLIDATOR_URL + '/health').then(r => ({ consolidator: r.ok, status: r.status })),
    ]);

    const failures: string[] = [];
    for (const result of checks) {
      if (result.status === 'rejected') {
        failures.push(result.reason?.message ?? 'fetch failed');
      } else {
        const [key] = Object.keys(result.value).filter(k => k !== 'status');
        if (!result.value[key as keyof typeof result.value]) {
          failures.push(`${key} status=${result.value.status}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test('Orchestrator FastAPI /health retorna ok', async () => {
    if (!ORCHESTRATOR_URL) { console.warn('SKIP'); return; }
    const r = await fetch(ORCHESTRATOR_URL + '/health');
    expect(r.ok).toBe(true);
    const body = await r.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('LiteLLM /health retorna ok', async () => {
    if (!LITELLM_URL) { console.warn('SKIP'); return; }
    const r = await fetch(LITELLM_URL + '/health');
    expect(r.ok).toBe(true);
  });
});
