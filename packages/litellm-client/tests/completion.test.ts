import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiteLLMClient } from '../src/client.js';
import { LiteLLMHttpError, RateLimitError, VirtualKeyMissingError } from '../src/errors.js';
import { resolveVirtualKey } from '../src/virtual-keys.js';

const BASE_CONFIG = {
  proxyUrl: 'https://litellm.test',
  virtualKey: 'sk-test-key',
  maxRetries: 0,
  timeout: 5_000,
};

const COMPLETION_RESP = {
  id: 'chatcmpl-abc',
  model: 'claude-sonnet-4-6',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'pong' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

function makeOkResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeErrorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('LiteLLMClient — completion', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('complete() returns parsed response', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse(COMPLETION_RESP));

    const client = new LiteLLMClient(BASE_CONFIG);
    const resp = await client.complete({
      model: 'sonnet-4-6',
      messages: [{ role: 'user', content: 'ping' }],
    });

    expect(resp.choices[0].message.content).toBe('pong');
    expect(resp.usage.total_tokens).toBe(15);
  });

  it('sends Authorization header with virtual key', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse(COMPLETION_RESP));

    const client = new LiteLLMClient(BASE_CONFIG);
    await client.complete({ model: 'sonnet-4-6', messages: [] });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-test-key');
  });

  it('includes default fallback chain in request body', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse(COMPLETION_RESP));

    const client = new LiteLLMClient(BASE_CONFIG);
    await client.complete({ model: 'sonnet-4-6', messages: [] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.fallbacks).toEqual(['haiku-3-7', 'gpt-4o-mini']);
  });

  it('respects explicit fallback override', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse(COMPLETION_RESP));

    const client = new LiteLLMClient(BASE_CONFIG);
    await client.complete({
      model: 'sonnet-4-6',
      messages: [],
      fallbacks: ['opus-4-7'],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.fallbacks).toEqual(['opus-4-7']);
  });

  it('throws LiteLLMHttpError on 500', async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(500, 'Internal server error'));

    const client = new LiteLLMClient(BASE_CONFIG);
    await expect(
      client.complete({ model: 'sonnet-4-6', messages: [] }),
    ).rejects.toThrow(LiteLLMHttpError);
  });

  it('throws RateLimitError on 429', async () => {
    fetchMock.mockResolvedValueOnce(makeErrorResponse(429, 'Rate limit exceeded'));

    const client = new LiteLLMClient(BASE_CONFIG);
    await expect(
      client.complete({ model: 'sonnet-4-6', messages: [] }),
    ).rejects.toThrow(RateLimitError);
  });
});

describe('resolveVirtualKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.LITELLM_VK_FIC;
  });

  it('resolves virtual key from env', () => {
    process.env.LITELLM_VK_FIC = 'sk-fic-key';
    expect(resolveVirtualKey('fic')).toBe('sk-fic-key');
  });

  it('throws VirtualKeyMissingError when env not set', () => {
    delete process.env.LITELLM_VK_FIC;
    expect(() => resolveVirtualKey('fic')).toThrow(VirtualKeyMissingError);
  });
});
