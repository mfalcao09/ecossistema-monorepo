import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiteLLMClient } from '../src/client.js';
import { parseSSEStream } from '../src/streaming.js';

const BASE_CONFIG = {
  proxyUrl: 'https://litellm.test',
  virtualKey: 'sk-test-key',
  maxRetries: 0,
  timeout: 5_000,
};

function makeSSEResponse(chunks: string[]): Response {
  const body = chunks.join('\n') + '\n';
  const encoder = new TextEncoder();
  const encoded = encoder.encode(body);

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const SSE_CHUNKS = [
  'data: {"id":"1","model":"claude-sonnet-4-6","choices":[{"delta":{"content":"Hello"},"finish_reason":null,"index":0}]}',
  'data: {"id":"2","model":"claude-sonnet-4-6","choices":[{"delta":{"content":" world"},"finish_reason":null,"index":0}]}',
  'data: {"id":"3","model":"claude-sonnet-4-6","choices":[{"delta":{"content":"!"},"finish_reason":"stop","index":0}]}',
  'data: [DONE]',
];

describe('parseSSEStream', () => {
  it('parses SSE chunks and emits deltas in order', async () => {
    const response = makeSSEResponse(SSE_CHUNKS);
    const chunks: string[] = [];

    for await (const chunk of parseSSEStream(response)) {
      chunks.push(chunk.delta);
    }

    expect(chunks).toEqual(['Hello', ' world', '!']);
  });

  it('stops on [DONE] sentinel', async () => {
    const response = makeSSEResponse([
      'data: {"id":"1","choices":[{"delta":{"content":"ok"},"finish_reason":null,"index":0}]}',
      'data: [DONE]',
      'data: {"id":"2","choices":[{"delta":{"content":"NEVER"},"finish_reason":null,"index":0}]}',
    ]);

    const chunks: string[] = [];
    for await (const chunk of parseSSEStream(response)) {
      chunks.push(chunk.delta);
    }

    expect(chunks).toEqual(['ok']);
  });

  it('skips malformed lines without throwing', async () => {
    const response = makeSSEResponse([
      'data: NOT_JSON',
      'data: {"id":"1","choices":[{"delta":{"content":"ok"},"finish_reason":null,"index":0}]}',
      'data: [DONE]',
    ]);

    const chunks: string[] = [];
    for await (const chunk of parseSSEStream(response)) {
      chunks.push(chunk.delta);
    }

    expect(chunks).toEqual(['ok']);
  });

  it('emits finish_reason on last chunk', async () => {
    const response = makeSSEResponse([
      'data: {"id":"1","choices":[{"delta":{"content":"hi"},"finish_reason":"stop","index":0}]}',
      'data: [DONE]',
    ]);

    const chunks = [];
    for await (const chunk of parseSSEStream(response)) {
      chunks.push(chunk);
    }

    expect(chunks[0].finish_reason).toBe('stop');
  });
});

describe('LiteLLMClient — stream()', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stream() yields deltas in order', async () => {
    fetchMock.mockResolvedValueOnce(makeSSEResponse(SSE_CHUNKS));

    const client = new LiteLLMClient(BASE_CONFIG);
    const deltas: string[] = [];

    for await (const chunk of client.stream({
      model: 'sonnet-4-6',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      deltas.push(chunk.delta);
    }

    expect(deltas.join('')).toBe('Hello world!');
  });

  it('stream() sends stream:true in request body', async () => {
    fetchMock.mockResolvedValueOnce(makeSSEResponse(['data: [DONE]']));

    const client = new LiteLLMClient(BASE_CONFIG);
    // consume the generator
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of client.stream({ model: 'sonnet-4-6', messages: [] })) {
      // drain
    }

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.stream).toBe(true);
  });
});
