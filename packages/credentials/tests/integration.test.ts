/**
 * Testes de integração — requerem SC-29 real no Supabase.
 * Rodar manualmente: INTEGRATION=1 pnpm test:e2e
 */
import { describe, it, expect } from 'vitest';
import { CredentialsClient } from '../src/client.js';

const SKIP = !process.env.INTEGRATION;

describe.skipIf(SKIP)('CredentialsClient — Integration E2E', () => {
  const client = new CredentialsClient({
    gatewayUrl: process.env.SUPABASE_URL!,
    agentJwt: process.env.AGENT_JWT!,
    mode: 'A',
  });

  it('Mode A: busca credencial real de teste', async () => {
    const value = await client.get({
      credential_name: 'TEST_CREDENTIAL',
      project: 'ecosystem',
      environment: 'dev',
    });
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThan(0);
  });

  it('Mode B: proxy request real', async () => {
    const proxyClient = new CredentialsClient({
      gatewayUrl: process.env.SUPABASE_URL!,
      agentJwt: process.env.AGENT_JWT!,
      mode: 'B',
    });

    const result = await proxyClient.proxy({
      credential_name: 'TEST_CREDENTIAL',
      project: 'ecosystem',
      target: {
        method: 'GET',
        url: 'https://httpbin.org/get',
        headers: {},
      },
    });

    expect(result.status).toBeGreaterThanOrEqual(200);
    expect(result.duration_ms).toBeGreaterThan(0);
  });
});
