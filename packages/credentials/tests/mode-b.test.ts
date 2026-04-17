import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CredentialsClient } from '../src/client.js';
import { ModeMismatchError } from '../src/errors.js';

const BASE_CONFIG = {
  gatewayUrl: 'https://gateway.test',
  agentJwt: 'test-jwt',
  mode: 'B' as const,
  retry: { max: 0, backoffMs: 0 },
  circuitBreaker: { failureThreshold: 5, resetMs: 30_000 },
};

function makeOkResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CredentialsClient — Mode B', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Mode B proxy() returns body without exposing secret', async () => {
    const gatewayResp = {
      status: 201,
      body: { nossoNumero: 'BOLETO-001', codigoBarras: '123456' },
      duration_ms: 342,
    };
    fetchMock.mockResolvedValueOnce(makeOkResponse(gatewayResp));

    const client = new CredentialsClient(BASE_CONFIG);
    const result = await client.proxy({
      credential_name: 'INTER_CLIENT_SECRET',
      project: 'fic',
      target: {
        method: 'POST',
        url: 'https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas',
        headers: { 'Content-Type': 'application/json' },
        body: { seuNumero: '123' },
      },
    });

    expect(result.status).toBe(201);
    expect(result.body).toEqual(gatewayResp.body);
    expect(result.duration_ms).toBe(342);

    // verify request body passed to gateway (never raw secret in response)
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(callBody).not.toHaveProperty('value');
    expect(callBody).toHaveProperty('credential_name', 'INTER_CLIENT_SECRET');
  });

  it('Mode B get() throws ModeMismatchError', async () => {
    const client = new CredentialsClient(BASE_CONFIG);
    await expect(
      client.get({ credential_name: 'K', project: 'fic', environment: 'prod' }),
    ).rejects.toThrow(ModeMismatchError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('list() returns available credentials without values', async () => {
    const entries = [
      { name: 'INTER_CLIENT_ID', acl_match: true },
      { name: 'INTER_CLIENT_SECRET', acl_match: true },
      { name: 'OPENAI_KEY', acl_match: false },
    ];
    fetchMock.mockResolvedValueOnce(makeOkResponse(entries));

    const client = new CredentialsClient(BASE_CONFIG);
    const result = await client.list({ project: 'fic' });

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).not.toHaveProperty('value');
  });

  it('requestViaMagicLink returns url and expires_at', async () => {
    const linkResp = {
      url: 'https://app.ecossistema.io/vault/collect/abc123',
      expires_at: '2026-04-17T22:00:00Z',
    };
    fetchMock.mockResolvedValueOnce(makeOkResponse(linkResp));

    const client = new CredentialsClient(BASE_CONFIG);
    const result = await client.requestViaMagicLink({
      credential_name: 'INTER_CLIENT_SECRET',
      project: 'fic',
      scope_description: 'Chave de API do Banco Inter para FIC',
    });

    expect(result.url).toContain('collect');
    expect(result.expires_at).toBeTruthy();
  });
});
