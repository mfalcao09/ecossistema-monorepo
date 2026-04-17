export { CredentialsClient } from './client.js';
export { TTLCache } from './cache.js';
export {
  CredentialError,
  CredentialNotFoundError,
  CredentialAccessDeniedError,
  CircuitOpenError,
  ModeMismatchError,
  GatewayHttpError,
} from './errors.js';
export type {
  CredentialsConfig,
  CredentialMode,
  GetRequest,
  GetResponse,
  ProxyRequest,
  ProxyResponse,
  ProxyTarget,
  MagicLinkRequest,
  MagicLinkResponse,
  ListRequest,
  CredentialEntry,
} from './types.js';
