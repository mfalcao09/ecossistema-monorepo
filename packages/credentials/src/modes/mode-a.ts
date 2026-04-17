import type { ClientHttp } from '../http.js';
import { CredentialNotFoundError } from '../errors.js';
import { TTLCache } from '../cache.js';
import type { GetRequest, GetResponse } from '../types.js';

export class ModeA {
  private cache = new TTLCache<string, string>();

  constructor(
    private http: ClientHttp,
    private cacheTtlMs: number,
  ) {}

  async get(req: GetRequest): Promise<string> {
    const key = `${req.credential_name}:${req.project}:${req.environment}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const resp = await this.http.post<GetResponse>(
      '/functions/v1/credential-gateway-v2/get',
      req,
    );

    if (!resp.value) throw new CredentialNotFoundError(req);

    this.cache.set(key, resp.value, this.cacheTtlMs);
    return resp.value;
  }

  invalidate(req: Pick<GetRequest, 'credential_name' | 'project' | 'environment'>): void {
    this.cache.delete(`${req.credential_name}:${req.project}:${req.environment}`);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
