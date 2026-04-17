import { ClientHttp } from './http.js';
import { ModeA } from './modes/mode-a.js';
import { ModeB } from './modes/mode-b.js';
import { MagicLink } from './modes/magic-link.js';
import { ModeMismatchError } from './errors.js';
import type {
  CredentialsConfig,
  GetRequest,
  ProxyRequest,
  ProxyResponse,
  MagicLinkRequest,
  MagicLinkResponse,
  ListRequest,
  CredentialEntry,
  CredentialMode,
} from './types.js';

export class CredentialsClient {
  private readonly mode: CredentialMode;
  private readonly http: ClientHttp;
  private readonly modeA: ModeA;
  private readonly modeB: ModeB;
  private readonly magicLink: MagicLink;

  constructor(config: CredentialsConfig) {
    this.mode = config.mode ?? 'B';
    this.http = new ClientHttp({
      baseUrl: config.gatewayUrl,
      authToken: config.agentJwt,
      timeout: config.timeout ?? 10_000,
      retry: config.retry ?? { max: 2, backoffMs: 500 },
      circuitBreaker: config.circuitBreaker ?? { failureThreshold: 5, resetMs: 30_000 },
    });
    this.modeA = new ModeA(this.http, config.cacheTtlMs ?? 60_000);
    this.modeB = new ModeB(this.http);
    this.magicLink = new MagicLink(this.http);
  }

  async get(req: GetRequest): Promise<string> {
    if (this.mode === 'B') throw new ModeMismatchError('get');
    return this.modeA.get(req);
  }

  async proxy<T = unknown>(req: ProxyRequest): Promise<ProxyResponse<T>> {
    return this.modeB.proxy<T>(req);
  }

  async requestViaMagicLink(req: MagicLinkRequest): Promise<MagicLinkResponse> {
    return this.magicLink.request(req);
  }

  async list(req: ListRequest): Promise<CredentialEntry[]> {
    return this.http.post<CredentialEntry[]>(
      '/functions/v1/credential-gateway-v2/list',
      req,
    );
  }

  invalidateCache(req: Pick<GetRequest, 'credential_name' | 'project' | 'environment'>): void {
    this.modeA.invalidate(req);
  }

  clearCache(): void {
    this.modeA.clearCache();
  }

  isCircuitOpen(): boolean {
    return this.http.isCircuitOpen();
  }
}
