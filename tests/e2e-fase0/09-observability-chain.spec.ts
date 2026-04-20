/**
 * Spec 09 — Observability Chain
 * Verifica que correlation_id propaga por toda a stack.
 * REQUIRES: ORCHESTRATOR_URL + LANGFUSE_URL
 */

import { describe, test, expect } from 'vitest';
import { ORCHESTRATOR_URL, LANGFUSE_URL, LIVE_INFRA_AVAILABLE } from './helpers/setup.js';

describe('09 — Observability Chain', () => {
  test('Langfuse client configurado no orchestrator (estático)', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const code = readFileSync(
      resolve(import.meta.dirname, '../../apps/orchestrator/src/orchestrator/clients/langfuse.py'),
      'utf-8',
    );
    expect(code).toMatch(/Langfuse|langfuse/);
    expect(code).toMatch(/trace|observation|flush/i);
  });

  test('trace_id presente no runtime do orchestrator (estático)', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    // trace_id está no runtime.py (gerado internamente via Langfuse)
    // DÉBITO MEDIUM: X-Correlation-ID externo não propagado nas routes (S10)
    const runtime = readFileSync(
      resolve(import.meta.dirname, '../../apps/orchestrator/src/orchestrator/agents/runtime.py'),
      'utf-8',
    );
    expect(runtime).toMatch(/trace_id/i);
    console.warn('DÉBITO MEDIUM: X-Correlation-ID header externo não suportado — trace_id é gerado internamente (S10)');
  });

  test('correlation_id propaga por toda a stack (requer Railway + Langfuse)', async () => {
    if (!LIVE_INFRA_AVAILABLE || !LANGFUSE_URL) {
      console.warn('SKIP: ORCHESTRATOR_URL ou LANGFUSE_URL não configurado');
      return;
    }

    const corrId = `e2e-s17-${Date.now()}`;

    const r = await fetch(`${ORCHESTRATOR_URL}/agents/cfo-fic/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': corrId,
      },
      body: JSON.stringify({ query: 'ping' }),
    });

    expect(r.ok).toBe(true);

    // Verificar trace no Langfuse via API pública
    await new Promise(res => setTimeout(res, 3000)); // aguarda ingestion

    const langfuseR = await fetch(
      `${LANGFUSE_URL}/api/public/traces?metadata.correlation_id=${corrId}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`
          ).toString('base64')}`,
        },
      },
    );

    const traces = await langfuseR.json();
    expect(traces.data?.length).toBeGreaterThan(0);
  });
});
