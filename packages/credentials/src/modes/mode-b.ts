import type { ClientHttp } from '../http.js';
import type { ProxyRequest, ProxyResponse } from '../types.js';

export class ModeB {
  constructor(private http: ClientHttp) {}

  async proxy<T = unknown>(req: ProxyRequest): Promise<ProxyResponse<T>> {
    return this.http.post<ProxyResponse<T>>(
      '/functions/v1/credential-gateway-v2/proxy',
      req,
    );
  }
}
