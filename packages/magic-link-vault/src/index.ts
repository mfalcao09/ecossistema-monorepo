export type {
  VaultProject,
  EncryptedPayload,
  VaultToken,
  TokenMetadata,
  CollectSecretArgs,
  CollectSecretResult,
  DecryptedSecret,
} from './types.js';

export { VaultError, TokenError, CryptoError, KeyError } from './errors.js';

export {
  encryptClientSide,
  importDEK,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from './crypto/client-encrypt.js';

export {
  decryptServerSide,
  importDEKForDecrypt,
} from './crypto/server-decrypt.js';

export {
  generateDEKRaw,
  wrapDEK,
  unwrapDEK,
  sha256Hex,
} from './crypto/keys.js';

export {
  generateTokenString,
  buildNewToken,
} from './tokens/generate.js';

export type { NewTokenParams, NewToken } from './tokens/generate.js';

export {
  assertTokenValid,
  isTokenValid,
  minutesUntilExpiry,
} from './tokens/validate.js';

export {
  collectSecretToolSchema,
  handleCollectSecret,
} from './tool/collect-secret-tool.js';

export type { VaultToolContext } from './tool/collect-secret-tool.js';
