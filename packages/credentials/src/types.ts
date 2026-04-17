export type CredentialMode = 'A' | 'B';

export interface CredentialsConfig {
  gatewayUrl: string;
  agentJwt: string;
  mode?: CredentialMode;
  cacheTtlMs?: number;
  timeout?: number;
  retry?: { max: number; backoffMs: number };
  circuitBreaker?: { failureThreshold: number; resetMs: number };
}

export interface GetRequest {
  credential_name: string;
  project: string;
  environment: 'dev' | 'staging' | 'prod';
}

export interface GetResponse {
  credential_name: string;
  value: string;
  expires_at?: string;
}

export interface ProxyTarget {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ProxyRequest {
  credential_name: string;
  project: string;
  target: ProxyTarget;
}

export interface ProxyResponse<T = unknown> {
  status: number;
  body: T;
  duration_ms: number;
}

export interface MagicLinkRequest {
  credential_name: string;
  project: string;
  scope_description: string;
}

export interface MagicLinkResponse {
  url: string;
  expires_at: string;
}

export interface ListRequest {
  project: string;
}

export interface CredentialEntry {
  name: string;
  acl_match: boolean;
}

export interface GatewayErrorBody {
  error: { code: string; message: string; details?: unknown };
}
