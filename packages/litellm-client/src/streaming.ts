import { StreamingError } from './errors.js';
import type { StreamChunk } from './types.js';

interface RawChunk {
  id?: string;
  model?: string;
  choices?: Array<{
    delta?: { content?: string | null };
    finish_reason?: string | null;
    index?: number;
  }>;
}

export async function* parseSSEStream(
  response: Response,
): AsyncGenerator<StreamChunk> {
  if (!response.body) throw new StreamingError('Response body is null');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6).trim();
        if (data === '[DONE]') return;
        if (!data) continue;

        let raw: RawChunk;
        try {
          raw = JSON.parse(data) as RawChunk;
        } catch {
          continue;
        }

        const choice = raw.choices?.[0];
        const delta = choice?.delta?.content ?? '';

        yield {
          delta,
          model: raw.model,
          finish_reason: choice?.finish_reason,
          raw,
        };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
