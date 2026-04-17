import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiteLLMClient } from '../src/client.js';
import { V9_DEFAULTS } from '../src/defaults.js';

const BASE_CONFIG = {
  proxyUrl: 'https://litellm.test',
  virtualKey: 'sk-test-key',
  maxRetries: 0,
};

const SUCCESS_RESP = {
  id: 'chatcmpl-fallback',
  model: 'claude-haiku-3-7',
  choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
};

function makeOkResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('LiteLLMClient — fallback chain', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('V9 defaults contain fallback chains for all primary models', () => {
    expect(V9_DEFAULTS.default_fallback_chain['sonnet-4-6']).toContain('haiku-3-7');
    expect(V9_DEFAULTS.default_fallback_chain['opus-4-7']).toContain('sonnet-4-6');
    expect(V9_DEFAULTS.default_fallback_chain['haiku-3-7']).toContain('gpt-4o-mini');
  });

  it('LiteLLM server-side fallback: client sends fallbacks in body, server handles routing', async () => {
    // When server returns success (using fallback model), client just returns that response
    fetchMock.mockResolvedValueOnce(makeOkResponse(SUCCESS_RESP));

    const client = new LiteLLMClient(BASE_CONFIG);
    const resp = await client.complete({
      model: 'sonnet-4-6',
      messages: [{ role: 'user', content: 'test' }],
    });

    // Verify fallbacks were sent in request body (server-side fallback handling)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.fallbacks).toEqual(['haiku-3-7', 'gpt-4o-mini']);
    expect(resp.model).toBe('claude-haiku-3-7'); // server used haiku as fallback
  });

  it('model with no configured chain sends no fallbacks', async () => {
    fetchMock.mockResolvedValueOnce(makeOkResponse(SUCCESS_RESP));

    const client = new LiteLLMClient(BASE_CONFIG);
    await client.complete({
      model: 'unknown-custom-model',
      messages: [],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.fallbacks).toBeUndefined();
  });

  it('retries on 429 up to maxRetries before throwing', async () => {
    const client = new LiteLLMClient({ ...BASE_CONFIG, maxRetries: 2, timeout: 5_000 });

    // Use mockImplementation (not mockResolvedValue) so each retry gets a fresh Response
    // — Response body can only be read once, reusing the same object causes body-consumed errors
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: 'rate limit' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(
      client.complete({ model: 'sonnet-4-6', messages: [] }),
    ).rejects.toThrow('rate limit');

    // 1 initial + 2 retries = 3 calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
