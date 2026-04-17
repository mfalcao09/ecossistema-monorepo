import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CredentialsClient } from '../src/client.js';
import { ModeMismatchError, CredentialNotFoundError, CircuitOpenError } from '../src/errors.js';

const BASE_CONFIG = {
  gatewayUrl: 'https://gateway.test',
  agentJwt: 'test-jwt',
  mode: 'A' as const,
  cacheTtlMs: 60_000,
  circuitBreaker: { failureThreshold: 3, resetMs: 5_000 },
  retry: { max: 0, backoffMs: 0 },
};

function makeOkResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeErrorResponse(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CredentialsClient — Mode A', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Mode B get() throws ModeMismatchError', async () => {
    const client = new CredentialsClient({ ...BASE_CONFIG, mode: 'B' });
    await expect(
      client.get({ credential_name: 'TEST_KEY', project: 'fic', environment: 'prod' }),
    ).rejects.toThrow(ModeMismatchError);
  });

  it('Mode A get() calls gateway and returns value', async () => {
    fetchMock.mockResolvedValueOnce(
      makeOkResponse({ credential_name: 'TEST_KEY', value: 'secret-value' }),
    );

    const client = new CredentialsClient(BASE_CONFIG);
    const value = await client.get({ credential_name: 'TEST_KEY', project: 'fic', environment: 'prod' });

    expect(value).toBe('secret-value');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('Mode A TTL cache returns cached value without calling gateway again', async () => {
    fetchMock.mockResolvedValueOnce(
      makeOkResponse({ credential_name: 'TEST_KEY', value: 'secret-value' }),
    );

    const client = new CredentialsClient(BASE_CONFIG);
    const req = { credential_name: 'TEST_KEY', project: 'fic', environment: 'prod' as const };

    const v1 = await client.get(req);
    const v2 = await client.get(req);

    expect(v1).toBe('secret-value');
    expect(v2).toBe('secret-value');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('expired cache re-fetches from gateway', async () => {
    const client = new CredentialsClient({ ...BASE_CONFIG, cacheTtlMs: 1 });
    fetchMock
      .mockResolvedValueOnce(makeOkResponse({ credential_name: 'K', value: 'v1' }))
      .mockResolvedValueOnce(makeOkResponse({ credential_name: 'K', value: 'v2' }));

    const req = { credential_name: 'K', project: 'fic', environment: 'prod' as const };
    await client.get(req);
    await new Promise((r) => setTimeout(r, 5)); // let TTL expire
    const v2 = await client.get(req);

    expect(v2).toBe('v2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws CredentialNotFoundError when value is empty', async () => {
    fetchMock.mockResolvedValueOnce(
      makeOkResponse({ credential_name: 'MISSING', value: '' }),
    );

    const client = new CredentialsClient(BASE_CONFIG);
    await expect(
      client.get({ credential_name: 'MISSING', project: 'fic', environment: 'prod' }),
    ).rejects.toThrow(CredentialNotFoundError);
  });

  it('throws CredentialAccessDeniedError on 403', async () => {
    fetchMock.mockResolvedValueOnce(
      makeErrorResponse(403, 'NOT_IN_ACL', "Agent not allowed for 'TEST_KEY/fic'"),
    );

    const client = new CredentialsClient(BASE_CONFIG);
    const err = await client
      .get({ credential_name: 'TEST_KEY', project: 'fic', environment: 'prod' })
      .catch((e) => e);
    expect(err.code).toBe('NOT_IN_ACL');
  });

  it('circuit breaker opens after threshold failures and throws CircuitOpenError', async () => {
    fetchMock.mockResolvedValue(
      makeErrorResponse(500, 'GATEWAY_ERROR', 'Internal error'),
    );

    const client = new CredentialsClient({
      ...BASE_CONFIG,
      retry: { max: 0, backoffMs: 0 },
      circuitBreaker: { failureThreshold: 3, resetMs: 60_000 },
    });

    const req = { credential_name: 'K', project: 'fic', environment: 'prod' as const };

    // 3 failed calls to open the circuit
    for (let i = 0; i < 3; i++) {
      await client.get(req).catch(() => null);
    }

    expect(client.isCircuitOpen()).toBe(true);

    // next call throws CircuitOpenError immediately (without calling fetch)
    fetchMock.mockClear();
    await expect(client.get(req)).rejects.toThrow(CircuitOpenError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('invalidateCache forces re-fetch on next call', async () => {
    fetchMock
      .mockResolvedValueOnce(makeOkResponse({ credential_name: 'K', value: 'v1' }))
      .mockResolvedValueOnce(makeOkResponse({ credential_name: 'K', value: 'v2' }));

    const client = new CredentialsClient(BASE_CONFIG);
    const req = { credential_name: 'K', project: 'fic', environment: 'prod' as const };

    await client.get(req);
    client.invalidateCache(req);
    const v2 = await client.get(req);

    expect(v2).toBe('v2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
