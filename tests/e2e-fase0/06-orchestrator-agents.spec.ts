/**
 * Spec 06 — Orchestrator Agents Responding
 * Verifica que Claudinho, CFO-FIC e D-Governanca respondem.
 * REQUIRES: ORCHESTRATOR_URL (Railway)
 */

import { describe, test, expect } from 'vitest';
import { ORCHESTRATOR_URL, LIVE_INFRA_AVAILABLE } from './helpers/setup.js';

async function collectSSE(response: Response): Promise<unknown[]> {
  const reader = response.body?.getReader();
  if (!reader) return [];
  const decoder = new TextDecoder();
  const events: unknown[] = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          events.push(JSON.parse(line.slice(6)));
        } catch {
          // non-JSON SSE line
        }
      }
    }
  }
  return events;
}

describe('06 — Orchestrator Agents Responding', () => {
  test('apps/orchestrator/src/orchestrator/main.py é FastAPI (estático)', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const code = readFileSync(
      resolve(import.meta.dirname, '../../apps/orchestrator/src/orchestrator/main.py'),
      'utf-8',
    );
    expect(code).toMatch(/FastAPI/);
    expect(code).toMatch(/\/health/);
    expect(code).toMatch(/\/agents/);
  });

  test('rotas SSE definidas para agentes (estático)', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const routes = readFileSync(
      resolve(import.meta.dirname, '../../apps/orchestrator/src/orchestrator/routes/agents.py'),
      'utf-8',
    );
    expect(routes).toMatch(/run|stream|SSE|EventSourceResponse/i);
  });

  test('Claudinho responde via SSE (requer Railway)', async () => {
    if (!LIVE_INFRA_AVAILABLE) {
      console.warn('SKIP: ORCHESTRATOR_URL não configurado');
      return;
    }

    const r = await fetch(`${ORCHESTRATOR_URL}/agents/claudinho/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'ping' }),
    });

    expect(r.ok).toBe(true);
    expect(r.headers.get('content-type')).toMatch(/text\/event-stream/i);

    const events = await collectSSE(r);
    expect(events.some((e: unknown) =>
      (e as { type?: string }).type === 'assistant_message'
    )).toBe(true);
  });

  test('CFO-FIC responde (requer Railway)', async () => {
    if (!LIVE_INFRA_AVAILABLE) {
      console.warn('SKIP: ORCHESTRATOR_URL não configurado');
      return;
    }

    const r = await fetch(`${ORCHESTRATOR_URL}/agents/cfo-fic/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Quantos alunos temos?' }),
    });

    const body = await r.json();
    expect(body.status).toBe('success');
  });

  test('CFO-FIC agent config existe no repo (estático)', async () => {
    const { existsSync } = await import('fs');
    const { resolve } = await import('path');
    const path = resolve(import.meta.dirname, '../../apps/fic/agents/cfo/agent.config.yaml');
    expect(existsSync(path)).toBe(true);
  });
});
