export class LiteLLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'LiteLLMError';
  }
}

export class LiteLLMHttpError extends LiteLLMError {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message, `HTTP_${status}`);
    this.name = 'LiteLLMHttpError';
  }
}

export class RateLimitError extends LiteLLMHttpError {
  constructor(message = 'Rate limit exceeded') {
    super(429, message);
    this.name = 'RateLimitError';
  }
}

export class BudgetExceededError extends LiteLLMError {
  constructor(public readonly businessId: string) {
    super(`Budget exceeded for business '${businessId}'`, 'BUDGET_EXCEEDED');
    this.name = 'BudgetExceededError';
  }
}

export class VirtualKeyMissingError extends LiteLLMError {
  constructor(businessId: string) {
    super(`No virtual key configured for business: ${businessId}`, 'VIRTUAL_KEY_MISSING');
    this.name = 'VirtualKeyMissingError';
  }
}

export class StreamingError extends LiteLLMError {
  constructor(message: string) {
    super(message, 'STREAMING_ERROR');
    this.name = 'StreamingError';
  }
}
