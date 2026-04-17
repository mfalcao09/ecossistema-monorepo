# @ecossistema/litellm-client

Wrapper TypeScript do **LiteLLM proxy** — defaults V9, fallback chains canônicas, streaming SSE, virtual keys por negócio.

## Instalação

```bash
pnpm add @ecossistema/litellm-client
```

## Uso

```typescript
import { LiteLLMClient, resolveVirtualKey } from '@ecossistema/litellm-client';

const llm = new LiteLLMClient({
  proxyUrl: process.env.LITELLM_URL!,
  virtualKey: resolveVirtualKey('fic'),  // ou process.env.LITELLM_VK_FIC!
});

// Completion simples
const resp = await llm.complete({
  model: 'sonnet-4-6',
  messages: [{ role: 'user', content: 'ping' }],
  max_tokens: 100,
});

// Streaming SSE
for await (const chunk of llm.stream({
  model: 'sonnet-4-6',
  messages: [...],
})) {
  process.stdout.write(chunk.delta);
}

// Com fallback explícito
const resp2 = await llm.complete({
  model: 'sonnet-4-6',
  messages: [...],
  fallbacks: ['haiku-3-7', 'gpt-4o-mini'],
});
```

## Defaults V9

| Parâmetro | Valor |
|-----------|-------|
| `timeout` | `300_000` ms (5 min) |
| `maxRetries` | `3` |
| Fallback `sonnet-4-6` | `haiku-3-7` → `gpt-4o-mini` |
| Fallback `opus-4-7` | `sonnet-4-6` → `haiku-3-7` |
| Fallback `haiku-3-7` | `gpt-4o-mini` → `sabia-4` |

## Virtual Keys por negócio

| Business ID | Env var |
|-------------|---------|
| `ecosystem` | `LITELLM_VK_ECOSYSTEM` |
| `fic` | `LITELLM_VK_FIC` |
| `klesis` | `LITELLM_VK_KLESIS` |
| `intentus` | `LITELLM_VK_INTENTUS` |
| `splendori` | `LITELLM_VK_SPLENDORI` |
| `nexvy` | `LITELLM_VK_NEXVY` |
