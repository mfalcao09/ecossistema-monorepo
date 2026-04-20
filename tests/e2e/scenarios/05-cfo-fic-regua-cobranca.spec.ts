import { test, expect } from '@playwright/test';
import { TestClient } from '../utils/test-client.js';
import { seedInadimplentes, cleanupInadimplentes } from '../fixtures/seed-data.js';
import { expectToolUsed, expectSuccess } from '../utils/assertions.js';
import type { Inadimplente } from '../fixtures/seed-data.js';

test.describe('CFO-FIC — Régua de cobrança E2E', () => {
  let client: TestClient;
  let seededRecords: Inadimplente[] = [];

  test.beforeAll(async () => {
    // Seed: 3 inadimplentes fake com 15+ dias
    try {
      seededRecords = await seedInadimplentes(3);
    } catch (e) {
      console.warn('Seed falhou (tabela test pode não existir):', (e as Error).message);
    }
  });

  test.afterAll(async () => {
    if (seededRecords.length > 0) {
      await cleanupInadimplentes(seededRecords.map((r) => r.aluno_id));
    }
  });

  test.beforeEach(({ request }) => {
    client = new TestClient();
    client.setRequest(request);
  });

  test('régua de cobrança executa fluxo completo via CFO-FIC', async () => {
    const response = await client.runAgent('cfo-fic', {
      query: 'Dispare régua de cobrança para inadimplentes de 15+ dias (modo sandbox)',
      context: {
        sandbox: true,
        use_test_table: true,
      },
      timeout: 45_000,
    });

    // Aceita success ou blocked (se valor > 10k gerou HITL)
    expect(['success', 'blocked', 'approval_pending']).toContain(response.status);

    if (response.status === 'success') {
      // Verificar ferramentas usadas
      expect(response.tools_used.length).toBeGreaterThan(0);
      expect(response.trace_id).toBeTruthy();
    }
  });

  test('trace_id presente para rastreabilidade (Art. IV)', async () => {
    const response = await client.runAgent('cfo-fic', {
      query: 'Qual é o total de inadimplência do FIC este mês?',
      context: { sandbox: true },
    });

    // Art. IV — rastreabilidade total
    expect(response.trace_id, 'trace_id obrigatório (Art. IV)').toBeTruthy();
  });
});
