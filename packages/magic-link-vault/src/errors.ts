export class VaultError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

export class TokenError extends VaultError {
  constructor(message: string) {
    super(message, 'TOKEN_ERROR');
    this.name = 'TokenError';
  }
}

export class CryptoError extends VaultError {
  constructor(message: string) {
    super(message, 'CRYPTO_ERROR');
    this.name = 'CryptoError';
  }
}

export class KeyError extends VaultError {
  constructor(message: string) {
    super(message, 'KEY_ERROR');
    this.name = 'KeyError';
  }
}
