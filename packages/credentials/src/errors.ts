export class CredentialError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'CredentialError';
  }
}

export class CredentialNotFoundError extends CredentialError {
  constructor(req: { credential_name: string; project: string }) {
    super(
      `Credential '${req.credential_name}' not found for project '${req.project}'`,
      'CREDENTIAL_NOT_FOUND',
    );
    this.name = 'CredentialNotFoundError';
  }
}

export class CredentialAccessDeniedError extends CredentialError {
  constructor(message: string) {
    super(message, 'NOT_IN_ACL');
    this.name = 'CredentialAccessDeniedError';
  }
}

export class CircuitOpenError extends CredentialError {
  constructor() {
    super('Circuit breaker is open — credential gateway unavailable', 'CIRCUIT_OPEN');
    this.name = 'CircuitOpenError';
  }
}

export class ModeMismatchError extends CredentialError {
  constructor(method: string) {
    super(`Mode B: use proxy() instead of ${method}()`, 'MODE_MISMATCH');
    this.name = 'ModeMismatchError';
  }
}

export class GatewayHttpError extends CredentialError {
  constructor(
    public readonly status: number,
    message: string,
    code = 'GATEWAY_ERROR',
  ) {
    super(message, code);
    this.name = 'GatewayHttpError';
  }
}
