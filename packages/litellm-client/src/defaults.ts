export const V9_DEFAULTS = {
  timeout: 300_000,
  max_retries: 3,
  retry_policy: {
    TimeoutError: 2,
    RateLimitError: 3,
    APIError: 2,
  },
  default_fallback_chain: {
    'sonnet-4-6': ['haiku-3-7', 'gpt-4o-mini'],
    'opus-4-7': ['sonnet-4-6', 'haiku-3-7'],
    'haiku-3-7': ['gpt-4o-mini', 'sabia-4'],
    'gpt-4o': ['sonnet-4-6', 'gpt-4o-mini'],
    'gpt-4o-mini': ['haiku-3-7', 'sabia-4'],
  } as Record<string, string[]>,
  budget_warning_threshold: 0.8,
} as const;
