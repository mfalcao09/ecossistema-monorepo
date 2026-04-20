import { test, expect } from '@playwright/test';
import { TestClient } from '../utils/test-client.js';
import { expectNoSecretLeaked, expectToolUsed, expectSuccess } from '../utils/assertions.js';

test.describe('SC-29 Credential Gateway — Modo B (proxy)', () => {
  let client: TestClient;

  test.beforeEach(({ request }) => {
    client = new TestClient();
    client.setRequest(request);
  });

  test('agente recebe resultado (saldo) mas nunca vê o secret Inter', async () => {
    const response = await client.runAgent('cfo-fic', {
      query: 'Consulte saldo da conta Banco Inter',
      context: { sandbox: true },
    });

    // Agente deve ter conseguido resultado
    expect(response.result).toBeTruthy();

    // Nenhum secret deve aparecer na resposta
    expectNoSecretLeaked(response);
  });

  test('audit log registra chamada proxy com modo B', async () => {
    await client.runAgent('cfo-fic', {
      query: 'Consulte extrato Inter dos últimos 7 dias',
      context: { sandbox: true },
    });

    const auditLog = await client.getAuditLog({
      agent_id: 'cfo-fic',
      action: 'proxy',
      limit: 5,
    });

    expect(auditLog.length).toBeGreaterThan(0);
    const lastEntry = auditLog[0] as Record<string, unknown>;
    expect(lastEntry['mode']).toBe('B');
    expect(lastEntry['success']).toBe(true);
  });

  test('acesso negado quando agente não tem ACL para credencial', async () => {
    const response = await client.runAgent('cfo-fic', {
      query: 'Consulte saldo da conta Intentus (Stripe)',
      context: { sandbox: true },
    });

    // CFO-FIC não tem ACL para credenciais da Intentus
    const hasBlock = response.events.some(
      (e) => e.type === 'tool_blocked' || e.type === 'credential_denied',
    );
    expect(hasBlock, 'Acesso cross-business deve ser negado').toBe(true);
  });
});
