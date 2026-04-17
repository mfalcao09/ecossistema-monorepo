export class ObservabilityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ObservabilityError';
  }
}

export class LangfuseInitError extends ObservabilityError {
  constructor(message: string) {
    super(message, 'LANGFUSE_INIT_ERROR');
    this.name = 'LangfuseInitError';
  }
}
