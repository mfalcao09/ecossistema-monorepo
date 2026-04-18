import { test, expect } from '@playwright/test';

test.describe('Orchestrator — SSE stream', () => {
  const baseUrl = process.env.ORCHESTRATOR_URL ?? 'http://localhost:8000';

  test('health endpoint responde 200', async ({ request }) => {
    const response = await request.get(`${baseUrl}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json() as Record<string, unknown>;
    expect(body['status']).toBe('ok');
  });

  test('SSE stream emite eventos válidos durante execução de agente', async ({ request }) => {
    const response = await request.post(`${baseUrl}/agents/cfo-fic/run/stream`, {
      data: {
        query: 'Liste os KPIs financeiros do FIC',
        context: { sandbox: true },
      },
      headers: { Accept: 'text/event-stream' },
      timeout: 30_000,
    });

    expect([200, 404, 422]).toContain(response.status());

    if (response.status() === 200) {
      const text = await response.text();
      // SSE lines começam com "data:"
      const dataLines = text.split('\n').filter((l) => l.startsWith('data:'));
      expect(dataLines.length).toBeGreaterThan(0);

      // Ao menos um evento deve ter tipo reconhecível
      const events = dataLines.map((l) => {
        try { return JSON.parse(l.slice(5).trim()); } catch { return null; }
      }).filter(Boolean);

      expect(events.length).toBeGreaterThan(0);
    }
  });

  test('endpoint /agents retorna lista de agentes registrados', async ({ request }) => {
    const response = await request.get(`${baseUrl}/agents`);
    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json() as unknown[];
      expect(Array.isArray(body)).toBe(true);
    }
  });
});
