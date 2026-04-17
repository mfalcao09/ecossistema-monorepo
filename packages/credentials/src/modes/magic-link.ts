import type { ClientHttp } from '../http.js';
import type { MagicLinkRequest, MagicLinkResponse } from '../types.js';

export class MagicLink {
  constructor(private http: ClientHttp) {}

  async request(req: MagicLinkRequest): Promise<MagicLinkResponse> {
    return this.http.post<MagicLinkResponse>(
      '/functions/v1/credential-gateway-v2/magic-link',
      req,
    );
  }
}
